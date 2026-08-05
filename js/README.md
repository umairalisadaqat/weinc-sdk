# weinc

**WeInc AI website builder API client** for JavaScript / Node.js. Zero dependencies, works with both `import` (ESM) and `require` (CommonJS), typed via JSDoc.

WeInc ([we.inc](https://we.inc)) is an AI website builder: describe an app in natural language and get a live, deployable React + Vite + Tailwind site. This package is a thin, honest client for the WeInc v1 REST API — it wraps five endpoints and adds nothing else.

- API docs: <https://my.we.inc/docs/api>
- OpenAPI spec: <https://my.we.inc/api/v1/docs>
- Website: <https://we.inc>

> The package name is `weinc`. If you ever find it unavailable on your registry mirror, the fallback name is `@weinc/sdk` — as of 2026-08-04 `weinc` is unclaimed on npmjs.com and this package uses it.

## Install

```bash
npm install weinc
```

Requires Node.js 18+ (uses the built-in `fetch`).

## Quickstart

Get an API key (starts with `wk_`) from your WeInc agency dashboard.

```js
import { WeIncClient } from "weinc";
// or: const { WeIncClient } = require("weinc");

const weinc = new WeIncClient({ apiKey: process.env.WEINC_API_KEY });

// 1. List your projects
const { projects, total } = await weinc.listProjects({ limit: 10 });

// 2. Fetch one project
const { project } = await weinc.getProject(projects[0].id);

// 3. Where is it live?
const preview = await weinc.getPreview(project.id);
console.log(preview.published_url); // null if never published

// 4. List its domains
const domains = await weinc.listDomains(project.id);

// 5. Publish built site files (WeInc builds run client-side, so you
//    provide the built dist/ output as { path: content })
const result = await weinc.publishSite(project.id, {
  "index.html": "<!doctype html><h1>Hello</h1>",
});
console.log(result.url, result.status); // "https://..." "ready" | "pending"
```

## API

All methods return Promises and throw `WeIncError` on any failure (with `.status` and `.body` when the server responded).

| Method | Endpoint | Returns |
|---|---|---|
| `listProjects({ limit, offset, clientId, status })` | `GET /projects` | `{ projects, total }` |
| `getProject(projectId)` | `GET /projects/:id` | `{ project }` |
| `publishSite(projectId, builtFiles)` | `POST /projects/:id/publish` | `{ url, vercelUrl, deployId, status, dns_pending? }` |
| `getPreview(projectId)` | `GET /projects/:id/preview` | `{ published_url, has_published, embed_preview_path }` |
| `listDomains(projectId)` | `GET /projects/:id/domains` | `Domain[]` |

An escape hatch is included for endpoints this client does not wrap:

```js
const clients = await weinc.request("GET", "/clients", { query: { limit: 5 } });
```

## Notes on accuracy

- `listProjects` and `getProject` match the published OpenAPI spec at <https://my.we.inc/api/v1/docs>.
- `publishSite`, `getPreview`, and `listDomains` are implemented by the API but **not yet listed in the OpenAPI document**; their request/response shapes were verified against the WeInc server source on 2026-08-04. If the spec later documents them differently, the spec wins.
- Authentication: `Authorization: Bearer wk_...` org API key. The API also accepts embed session tokens (`embt_`) on the same endpoints; this client just sends whatever key you give it.

## Testing

```bash
npm test
```

Tests use `node:test` with a mocked `fetch` — no live API calls are made.

## License

MIT
