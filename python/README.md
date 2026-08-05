# weinc

**WeInc AI website builder API client** for Python. Pure standard library (`urllib` only), zero dependencies, Python 3.8+.

WeInc ([we.inc](https://we.inc)) is an AI website builder: describe an app in natural language and get a live, deployable React + Vite + Tailwind site. This package is a thin, honest client for the WeInc v1 REST API — it wraps five endpoints and adds nothing else.

- API docs: <https://my.we.inc/docs/api>
- OpenAPI spec: <https://my.we.inc/api/v1/docs>
- Website: <https://we.inc>

## Install

```bash
pip install weinc
```

## Quickstart

Get an API key (starts with `wk_`) from your WeInc agency dashboard.

```python
import os
from weinc import WeIncClient

weinc = WeIncClient(api_key=os.environ["WEINC_API_KEY"])

# 1. List your projects
result = weinc.list_projects(limit=10)
projects, total = result["projects"], result["total"]

# 2. Fetch one project
project = weinc.get_project(projects[0]["id"])["project"]

# 3. Where is it live?
preview = weinc.get_preview(project["id"])
print(preview["published_url"])  # None if never published

# 4. List its domains
domains = weinc.list_domains(project["id"])

# 5. Publish built site files (WeInc builds run client-side, so you
#    provide the built dist/ output as {path: content})
deploy = weinc.publish_site(project["id"], {
    "index.html": "<!doctype html><h1>Hello</h1>",
})
print(deploy["url"], deploy["status"])  # "https://..." "ready" | "pending"
```

## API

All methods raise `WeIncError` on any failure (with `.status` and `.body` when the server responded).

| Method | Endpoint | Returns |
|---|---|---|
| `list_projects(limit, offset, client_id, status)` | `GET /projects` | `{"projects": [...], "total": int}` |
| `get_project(project_id)` | `GET /projects/:id` | `{"project": {...}}` |
| `publish_site(project_id, built_files)` | `POST /projects/:id/publish` | `{"url", "vercelUrl", "deployId", "status"}` |
| `get_preview(project_id)` | `GET /projects/:id/preview` | `{"published_url", "has_published", "embed_preview_path"}` |
| `list_domains(project_id)` | `GET /projects/:id/domains` | `[{...domain records...}]` |

An escape hatch is included for endpoints this client does not wrap:

```python
clients = weinc.request("GET", "/clients", query={"limit": 5})
```

## Notes on accuracy

- `list_projects` and `get_project` match the published OpenAPI spec at <https://my.we.inc/api/v1/docs>.
- `publish_site`, `get_preview`, and `list_domains` are implemented by the API but **not yet listed in the OpenAPI document**; their request/response shapes were verified against the WeInc server source on 2026-08-04. If the spec later documents them differently, the spec wins.
- Authentication: `Authorization: Bearer wk_...` org API key. The API also accepts embed session tokens (`embt_`) on the same endpoints; this client just sends whatever key you give it.

## Testing

```bash
python3 -m unittest discover -s tests   # or: python3 -m pytest tests
```

Tests use `unittest.mock` to patch `urllib` — no live API calls are made.

## License

MIT
