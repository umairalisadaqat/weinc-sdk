"""Client for the WeInc v1 REST API.

Base URL: https://my.we.inc/api/v1
Auth: org API key passed as ``Authorization: Bearer wk_...``

Endpoint shapes were taken from the live OpenAPI spec
(https://my.we.inc/api/v1/docs) where available. The publish, preview, and
domains endpoints are implemented by the API but not yet listed in the OpenAPI
document; their shapes were verified against the server source on 2026-08-04
and are documented on each method below.

Pure standard library: uses :mod:`urllib` only.
"""

import json
from typing import Any, Dict, List, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

DEFAULT_BASE_URL = "https://my.we.inc/api/v1"
_USER_AGENT = "weinc-python/0.1.0"


class WeIncError(Exception):
    """Raised for every failed request (non-2xx response, network failure,
    or invalid input).

    Attributes:
        status: HTTP status code, if a response was received, else ``None``.
        body: Parsed response body (dict/list if JSON, else raw text), if any.
    """

    def __init__(self, message: str, status: Optional[int] = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


def _require_non_empty_str(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value:
        raise WeIncError("%s must be a non-empty string" % name)
    return value


class WeIncClient:
    """WeInc v1 API client.

    Example:
        >>> from weinc import WeIncClient
        >>> weinc = WeIncClient(api_key="wk_...")
        >>> result = weinc.list_projects(limit=10)
        >>> result["projects"], result["total"]
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
    ):
        """
        Args:
            api_key: Org API key from the agency dashboard (starts with ``wk_``).
            base_url: Override the API base URL. Defaults to
                ``https://my.we.inc/api/v1``.
            timeout: Per-request timeout in seconds.
        """
        _require_non_empty_str(api_key, "api_key")
        self._api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    # ------------------------------------------------------------------ #
    # Transport
    # ------------------------------------------------------------------ #

    def request(
        self,
        method: str,
        path: str,
        query: Optional[Dict[str, Any]] = None,
        body: Any = None,
    ) -> Any:
        """Perform an authenticated JSON request.

        Exposed for calling endpoints this client does not wrap yet.

        Args:
            method: HTTP method, e.g. ``"GET"``.
            path: Path relative to the base URL, e.g. ``"/projects"``.
            query: Optional query parameters; ``None`` values are omitted.
            body: Optional JSON-serialisable request body.

        Returns:
            The parsed JSON response body.

        Raises:
            WeIncError: On any non-2xx response or network failure.
        """
        url = self.base_url + path
        params = {k: v for k, v in (query or {}).items() if v is not None}
        if params:
            url = url + "?" + urllib_parse.urlencode(params)

        headers = {
            "Authorization": "Bearer %s" % self._api_key,
            "Accept": "application/json",
            "User-Agent": _USER_AGENT,
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        req = urllib_request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib_request.urlopen(req, timeout=self.timeout) as response:
                return self._parse_body(response.read())
        except urllib_error.HTTPError as exc:
            parsed = self._parse_body(exc.read())
            message = "HTTP %d" % exc.code
            if isinstance(parsed, dict) and isinstance(parsed.get("error"), str):
                message = parsed["error"]
            raise WeIncError(
                "%s %s failed: %s" % (method, path, message),
                status=exc.code,
                body=parsed,
            ) from exc
        except urllib_error.URLError as exc:
            raise WeIncError(
                "Network error calling %s %s: %s" % (method, path, exc.reason)
            ) from exc

    @staticmethod
    def _parse_body(raw: bytes) -> Any:
        if not raw:
            return None
        text = raw.decode("utf-8", errors="replace")
        try:
            return json.loads(text)
        except ValueError:
            return text

    # ------------------------------------------------------------------ #
    # Methods
    # ------------------------------------------------------------------ #

    def list_projects(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        client_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List projects in your org.

        ``GET /projects`` (in the OpenAPI spec).

        Args:
            limit: Max results (server default 50).
            offset: Pagination offset.
            client_id: Filter by client UUID.
            status: Filter by project status.

        Returns:
            ``{"projects": [...], "total": int}`` where each project has
            ``id``, ``user_id``, ``name``, ``description``, ``status``,
            ``created_at``, ``updated_at``.
        """
        return self.request(
            "GET",
            "/projects",
            query={
                "limit": limit,
                "offset": offset,
                "client_id": client_id,
                "status": status,
            },
        )

    def get_project(self, project_id: str) -> Dict[str, Any]:
        """Get one project by ID.

        ``GET /projects/{projectId}`` (in the OpenAPI spec).

        Returns:
            ``{"project": {...}}``.
        """
        _require_non_empty_str(project_id, "project_id")
        return self.request(
            "GET", "/projects/%s" % urllib_parse.quote(project_id, safe="")
        )

    def publish_site(
        self, project_id: str, built_files: Dict[str, str]
    ) -> Dict[str, Any]:
        """Publish a project's built site.

        ``POST /projects/{projectId}/publish`` — implemented by the API but
        not yet in the OpenAPI spec (shape verified against server source
        2026-08-04).

        WeInc builds run client-side (in WebContainers), so the caller must
        provide the already-built ``dist/`` output as a mapping of file path
        to file content, e.g. ``{"index.html": "<!doctype html>..."}``.

        Returns:
            ``{"url": str, "vercelUrl": str, "deployId": str,
            "status": "ready" | "pending"}`` plus ``"dns_pending": True``
            when DNS has not propagated yet.
        """
        _require_non_empty_str(project_id, "project_id")
        if not isinstance(built_files, dict):
            raise WeIncError(
                "built_files must be a dict mapping file paths to file contents"
            )
        return self.request(
            "POST",
            "/projects/%s/publish" % urllib_parse.quote(project_id, safe=""),
            body={"builtFiles": built_files},
        )

    def get_preview(self, project_id: str) -> Dict[str, Any]:
        """Get preview / published URLs for a project.

        ``GET /projects/{projectId}/preview`` — implemented by the API but
        not yet in the OpenAPI spec (shape verified against server source
        2026-08-04).

        Returns:
            ``{"published_url": str | None, "has_published": bool,
            "embed_preview_path": str}``.
        """
        _require_non_empty_str(project_id, "project_id")
        return self.request(
            "GET", "/projects/%s/preview" % urllib_parse.quote(project_id, safe="")
        )

    def list_domains(self, project_id: str) -> List[Dict[str, Any]]:
        """List domains attached to a project.

        ``GET /projects/{projectId}/domains`` — implemented by the API but
        not yet in the OpenAPI spec. Returns a plain list of domain records
        (shape matches the server's ``project_domains`` table, verified
        2026-08-04): ``id``, ``project_id``, ``domain``, ``subdomain``,
        ``status``, ``dns_records``, ``ssl_status``, ``verified_at``,
        ``created_at``, ``updated_at``.
        """
        _require_non_empty_str(project_id, "project_id")
        return self.request(
            "GET", "/projects/%s/domains" % urllib_parse.quote(project_id, safe="")
        )
