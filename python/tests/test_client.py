"""Unit tests for the weinc client.

All transport is mocked (urllib.request.urlopen is patched) — no live API
calls are made anywhere in this suite. Run with either:

    python3 -m unittest discover -s tests
    python3 -m pytest tests
"""

import io
import json
import unittest
from unittest import mock
from urllib import error as urllib_error
from urllib import parse as urllib_parse

from weinc import DEFAULT_BASE_URL, WeIncClient, WeIncError

API_KEY = "wk_test_key"
URLOPEN = "weinc.client.urllib_request.urlopen"


class _FakeResponse:
    """Minimal stand-in for the object urlopen yields as a context manager."""

    def __init__(self, payload, raw=None):
        self._raw = raw if raw is not None else json.dumps(payload).encode("utf-8")

    def read(self):
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False


def _sent_request(mock_urlopen):
    """Return the urllib Request object passed to the mocked urlopen."""
    return mock_urlopen.call_args[0][0]


class ConstructorTests(unittest.TestCase):
    def test_requires_api_key(self):
        with self.assertRaises(WeIncError):
            WeIncClient(api_key="")
        with self.assertRaises(WeIncError):
            WeIncClient(api_key=None)  # type: ignore[arg-type]

    def test_default_base_url(self):
        client = WeIncClient(api_key=API_KEY)
        self.assertEqual(client.base_url, "https://my.we.inc/api/v1")
        self.assertEqual(DEFAULT_BASE_URL, "https://my.we.inc/api/v1")

    def test_strips_trailing_slash(self):
        client = WeIncClient(api_key=API_KEY, base_url="https://example.test/api/v1//")
        self.assertEqual(client.base_url, "https://example.test/api/v1")


class AuthTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_sends_bearer_token(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResponse({"projects": [], "total": 0})
        WeIncClient(api_key=API_KEY).list_projects()
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.headers["Authorization"], "Bearer %s" % API_KEY)


class ListProjectsTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_gets_projects_and_returns_payload(self, mock_urlopen):
        payload = {
            "projects": [
                {
                    "id": "p1",
                    "user_id": "u1",
                    "name": "Site",
                    "description": None,
                    "status": "active",
                    "created_at": "2026-01-01T00:00:00Z",
                    "updated_at": "2026-01-01T00:00:00Z",
                }
            ],
            "total": 1,
        }
        mock_urlopen.return_value = _FakeResponse(payload)
        result = WeIncClient(api_key=API_KEY).list_projects()
        self.assertEqual(result, payload)
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.get_method(), "GET")
        self.assertEqual(req.full_url, "https://my.we.inc/api/v1/projects")

    @mock.patch(URLOPEN)
    def test_passes_query_params(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResponse({"projects": [], "total": 0})
        WeIncClient(api_key=API_KEY).list_projects(
            limit=10, offset=20, client_id="c-1", status="active"
        )
        req = _sent_request(mock_urlopen)
        query = dict(
            urllib_parse.parse_qsl(urllib_parse.urlsplit(req.full_url).query)
        )
        self.assertEqual(
            query, {"limit": "10", "offset": "20", "client_id": "c-1", "status": "active"}
        )

    @mock.patch(URLOPEN)
    def test_omits_none_query_params(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResponse({"projects": [], "total": 0})
        WeIncClient(api_key=API_KEY).list_projects(limit=5)
        req = _sent_request(mock_urlopen)
        self.assertEqual(urllib_parse.urlsplit(req.full_url).query, "limit=5")


class GetProjectTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_gets_project_by_id(self, mock_urlopen):
        payload = {"project": {"id": "p1", "name": "Site"}}
        mock_urlopen.return_value = _FakeResponse(payload)
        result = WeIncClient(api_key=API_KEY).get_project("p1")
        self.assertEqual(result, payload)
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.full_url, "https://my.we.inc/api/v1/projects/p1")

    @mock.patch(URLOPEN)
    def test_url_encodes_project_id(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResponse({"project": {}})
        WeIncClient(api_key=API_KEY).get_project("a/b")
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.full_url, "https://my.we.inc/api/v1/projects/a%2Fb")

    @mock.patch(URLOPEN)
    def test_rejects_empty_id_without_network_call(self, mock_urlopen):
        with self.assertRaises(WeIncError):
            WeIncClient(api_key=API_KEY).get_project("")
        mock_urlopen.assert_not_called()


class PublishSiteTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_posts_built_files(self, mock_urlopen):
        payload = {
            "url": "https://demo.we.inc",
            "vercelUrl": "https://x.vercel.app",
            "deployId": "d1",
            "status": "ready",
        }
        mock_urlopen.return_value = _FakeResponse(payload)
        built_files = {"index.html": "<!doctype html><h1>hi</h1>"}
        result = WeIncClient(api_key=API_KEY).publish_site("p1", built_files)
        self.assertEqual(result, payload)
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.full_url, "https://my.we.inc/api/v1/projects/p1/publish")
        self.assertEqual(req.headers["Content-type"], "application/json")
        self.assertEqual(json.loads(req.data.decode("utf-8")), {"builtFiles": built_files})

    @mock.patch(URLOPEN)
    def test_rejects_non_dict_built_files(self, mock_urlopen):
        client = WeIncClient(api_key=API_KEY)
        with self.assertRaises(WeIncError):
            client.publish_site("p1", None)  # type: ignore[arg-type]
        with self.assertRaises(WeIncError):
            client.publish_site("p1", ["a"])  # type: ignore[arg-type]
        mock_urlopen.assert_not_called()


class GetPreviewTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_gets_preview_info(self, mock_urlopen):
        payload = {
            "published_url": "https://demo.we.inc",
            "has_published": True,
            "embed_preview_path": "/builder/embed?project=p1",
        }
        mock_urlopen.return_value = _FakeResponse(payload)
        result = WeIncClient(api_key=API_KEY).get_preview("p1")
        self.assertEqual(result, payload)
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.full_url, "https://my.we.inc/api/v1/projects/p1/preview")


class ListDomainsTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_gets_domain_list(self, mock_urlopen):
        payload = [
            {
                "id": "d1",
                "project_id": "p1",
                "domain": "example.com",
                "subdomain": None,
                "status": "active",
                "dns_records": [],
                "ssl_status": "active",
                "verified_at": None,
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
            }
        ]
        mock_urlopen.return_value = _FakeResponse(payload)
        result = WeIncClient(api_key=API_KEY).list_domains("p1")
        self.assertEqual(result, payload)
        req = _sent_request(mock_urlopen)
        self.assertEqual(req.full_url, "https://my.we.inc/api/v1/projects/p1/domains")


class ErrorHandlingTests(unittest.TestCase):
    @mock.patch(URLOPEN)
    def test_http_error_with_json_body(self, mock_urlopen):
        mock_urlopen.side_effect = urllib_error.HTTPError(
            url="https://my.we.inc/api/v1/projects",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=io.BytesIO(b'{"error": "Unauthorized"}'),
        )
        with self.assertRaises(WeIncError) as ctx:
            WeIncClient(api_key=API_KEY).list_projects()
        err = ctx.exception
        self.assertEqual(err.status, 401)
        self.assertEqual(err.body, {"error": "Unauthorized"})
        self.assertIn("Unauthorized", str(err))

    @mock.patch(URLOPEN)
    def test_http_error_with_non_json_body(self, mock_urlopen):
        mock_urlopen.side_effect = urllib_error.HTTPError(
            url="https://my.we.inc/api/v1/projects",
            code=502,
            msg="Bad Gateway",
            hdrs=None,
            fp=io.BytesIO(b"Bad Gateway"),
        )
        with self.assertRaises(WeIncError) as ctx:
            WeIncClient(api_key=API_KEY).list_projects()
        err = ctx.exception
        self.assertEqual(err.status, 502)
        self.assertEqual(err.body, "Bad Gateway")

    @mock.patch(URLOPEN)
    def test_network_error(self, mock_urlopen):
        mock_urlopen.side_effect = urllib_error.URLError("connection refused")
        with self.assertRaises(WeIncError) as ctx:
            WeIncClient(api_key=API_KEY).list_projects()
        err = ctx.exception
        self.assertIsNone(err.status)
        self.assertIn("connection refused", str(err))


if __name__ == "__main__":
    unittest.main()
