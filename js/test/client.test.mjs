import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { WeIncClient, WeIncError, DEFAULT_BASE_URL } from "../index.mjs";

const API_KEY = "wk_test_key";

/**
 * Build a mock fetch that records calls and returns a canned response.
 * No live network calls are made anywhere in this suite.
 */
function mockFetch(responseBody, { status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const text =
      typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    };
  };
  return { fetchImpl, calls };
}

function makeClient(fetchImpl) {
  return new WeIncClient({ apiKey: API_KEY, fetch: fetchImpl });
}

describe("constructor", () => {
  test("requires an apiKey", () => {
    assert.throws(() => new WeIncClient({}), WeIncError);
    assert.throws(() => new WeIncClient(), WeIncError);
  });

  test("uses the documented default base URL", () => {
    const { fetchImpl } = mockFetch({});
    const client = makeClient(fetchImpl);
    assert.equal(client.baseUrl, "https://my.we.inc/api/v1");
    assert.equal(DEFAULT_BASE_URL, "https://my.we.inc/api/v1");
  });

  test("strips trailing slashes from a custom baseUrl", () => {
    const { fetchImpl } = mockFetch({});
    const client = new WeIncClient({ apiKey: API_KEY, baseUrl: "https://example.test/api/v1//", fetch: fetchImpl });
    assert.equal(client.baseUrl, "https://example.test/api/v1");
  });
});

describe("auth header", () => {
  test("sends the key as a Bearer token on every call", async () => {
    const { fetchImpl, calls } = mockFetch({ projects: [], total: 0 });
    await makeClient(fetchImpl).listProjects();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.headers.authorization, `Bearer ${API_KEY}`);
  });
});

describe("listProjects", () => {
  test("GETs /projects and returns { projects, total }", async () => {
    const payload = {
      projects: [{ id: "p1", user_id: "u1", name: "Site", description: null, status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
      total: 1,
    };
    const { fetchImpl, calls } = mockFetch(payload);
    const result = await makeClient(fetchImpl).listProjects();
    assert.deepEqual(result, payload);
    assert.equal(calls[0].init.method, "GET");
    assert.equal(new URL(calls[0].url).pathname, "/api/v1/projects");
  });

  test("passes limit/offset/clientId/status as query params", async () => {
    const { fetchImpl, calls } = mockFetch({ projects: [], total: 0 });
    await makeClient(fetchImpl).listProjects({ limit: 10, offset: 20, clientId: "c-1", status: "active" });
    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("offset"), "20");
    assert.equal(url.searchParams.get("client_id"), "c-1");
    assert.equal(url.searchParams.get("status"), "active");
  });

  test("omits undefined query params", async () => {
    const { fetchImpl, calls } = mockFetch({ projects: [], total: 0 });
    await makeClient(fetchImpl).listProjects({ limit: 5 });
    const url = new URL(calls[0].url);
    assert.equal([...url.searchParams.keys()].join(","), "limit");
  });
});

describe("getProject", () => {
  test("GETs /projects/:id and returns { project }", async () => {
    const payload = { project: { id: "p1", name: "Site" } };
    const { fetchImpl, calls } = mockFetch(payload);
    const result = await makeClient(fetchImpl).getProject("p1");
    assert.deepEqual(result, payload);
    assert.equal(new URL(calls[0].url).pathname, "/api/v1/projects/p1");
  });

  test("URL-encodes the project id", async () => {
    const { fetchImpl, calls } = mockFetch({ project: {} });
    await makeClient(fetchImpl).getProject("a/b");
    assert.equal(new URL(calls[0].url).pathname, "/api/v1/projects/a%2Fb");
  });

  test("rejects an empty project id without calling fetch", async () => {
    const { fetchImpl, calls } = mockFetch({});
    await assert.rejects(() => makeClient(fetchImpl).getProject(""), WeIncError);
    assert.equal(calls.length, 0);
  });
});

describe("publishSite", () => {
  test("POSTs builtFiles to /projects/:id/publish and returns the deploy result", async () => {
    const payload = { url: "https://demo.we.inc", vercelUrl: "https://x.vercel.app", deployId: "d1", status: "ready" };
    const { fetchImpl, calls } = mockFetch(payload);
    const builtFiles = { "index.html": "<!doctype html><h1>hi</h1>" };
    const result = await makeClient(fetchImpl).publishSite("p1", builtFiles);
    assert.deepEqual(result, payload);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(new URL(calls[0].url).pathname, "/api/v1/projects/p1/publish");
    assert.equal(calls[0].init.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].init.body), { builtFiles });
  });

  test("rejects non-object builtFiles without calling fetch", async () => {
    const { fetchImpl, calls } = mockFetch({});
    const client = makeClient(fetchImpl);
    await assert.rejects(() => client.publishSite("p1", null), WeIncError);
    await assert.rejects(() => client.publishSite("p1", ["a"]), WeIncError);
    assert.equal(calls.length, 0);
  });
});

describe("getPreview", () => {
  test("GETs /projects/:id/preview and returns preview info", async () => {
    const payload = { published_url: "https://demo.we.inc", has_published: true, embed_preview_path: "/builder/embed?project=p1" };
    const { fetchImpl, calls } = mockFetch(payload);
    const result = await makeClient(fetchImpl).getPreview("p1");
    assert.deepEqual(result, payload);
    assert.equal(new URL(calls[0].url).pathname, "/api/v1/projects/p1/preview");
  });
});

describe("listDomains", () => {
  test("GETs /projects/:id/domains and returns the array", async () => {
    const payload = [{ id: "d1", project_id: "p1", domain: "example.com", subdomain: null, status: "active", dns_records: [], ssl_status: "active", verified_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }];
    const { fetchImpl, calls } = mockFetch(payload);
    const result = await makeClient(fetchImpl).listDomains("p1");
    assert.deepEqual(result, payload);
    assert.equal(new URL(calls[0].url).pathname, "/api/v1/projects/p1/domains");
  });
});

describe("error handling", () => {
  test("throws WeIncError with status and server message on non-2xx", async () => {
    const { fetchImpl } = mockFetch({ error: "Unauthorized" }, { status: 401 });
    await assert.rejects(
      () => makeClient(fetchImpl).listProjects(),
      (err) => {
        assert.ok(err instanceof WeIncError);
        assert.equal(err.status, 401);
        assert.match(err.message, /Unauthorized/);
        assert.deepEqual(err.body, { error: "Unauthorized" });
        return true;
      },
    );
  });

  test("handles non-JSON error bodies", async () => {
    const { fetchImpl } = mockFetch("Bad Gateway", { status: 502 });
    await assert.rejects(
      () => makeClient(fetchImpl).listProjects(),
      (err) => {
        assert.ok(err instanceof WeIncError);
        assert.equal(err.status, 502);
        assert.equal(err.body, "Bad Gateway");
        return true;
      },
    );
  });

  test("wraps network failures in WeIncError", async () => {
    const failingFetch = async () => {
      throw new Error("socket hang up");
    };
    await assert.rejects(
      () => makeClient(failingFetch).listProjects(),
      (err) => {
        assert.ok(err instanceof WeIncError);
        assert.match(err.message, /socket hang up/);
        assert.equal(err.status, undefined);
        return true;
      },
    );
  });
});

describe("module formats", () => {
  test("CJS require exposes the same client", async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const cjs = require("../index.cjs");
    assert.equal(cjs.WeIncClient, WeIncClient);
    assert.equal(cjs.WeIncError, WeIncError);
  });
});
