# weinc-sdk

Official client libraries for the **WeInc AI website builder API** — small, honest, zero-dependency wrappers around the WeInc v1 REST API (`https://my.we.inc/api/v1`).

WeInc ([we.inc](https://we.inc)) is an AI website builder: describe an app in natural language and get a live, deployable React + Vite + Tailwind site.

| Package | Registry | Folder | Runtime |
|---|---|---|---|
| [`weinc`](./js) | npm | [`js/`](./js) | Node.js 18+ (ESM + CJS, zero deps) |
| [`weinc`](./python) | PyPI | [`python/`](./python) | Python 3.8+ (stdlib only) |

Both clients cover the same five operations:

- **listProjects / list_projects** — `GET /projects`
- **getProject / get_project** — `GET /projects/{id}`
- **publishSite / publish_site** — `POST /projects/{id}/publish`
- **getPreview / get_preview** — `GET /projects/{id}/preview`
- **listDomains / list_domains** — `GET /projects/{id}/domains`

Auth is an org API key from your WeInc agency dashboard, sent as `Authorization: Bearer wk_...`.

## Docs

- API overview: <https://my.we.inc/docs/api>
- OpenAPI spec: <https://my.we.inc/api/v1/docs>
- Product: <https://we.inc>

## Accuracy

The projects endpoints match the published OpenAPI spec. The publish, preview, and domains endpoints are live in the API but not yet in the OpenAPI document; their shapes were verified against the WeInc server source on 2026-08-04 and are documented inline in both clients. Where this repo and the spec ever disagree, the spec wins.

## Development

```bash
# JavaScript
cd js && npm test

# Python
cd python && python3 -m unittest discover -s tests
```

All tests run against mocked transports — no live API calls, no API key needed.

## License

MIT
