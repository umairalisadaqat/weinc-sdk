"use strict";

/**
 * weinc — zero-dependency client for the WeInc v1 REST API.
 *
 * Base URL: https://my.we.inc/api/v1
 * Auth: org API key passed as `Authorization: Bearer wk_...`
 *
 * Endpoint shapes were taken from the live OpenAPI spec
 * (https://my.we.inc/api/v1/docs) where available. The publish, preview, and
 * domains endpoints are implemented by the API but not yet listed in the
 * OpenAPI document; their shapes were verified against the server source on
 * 2026-08-04 and are documented on each method below.
 */

const DEFAULT_BASE_URL = "https://my.we.inc/api/v1";

/**
 * Error thrown for every failed request (non-2xx response, network failure,
 * or invalid input).
 */
class WeIncError extends Error {
  /**
   * @param {string} message Human-readable description of the failure.
   * @param {{ status?: number, body?: unknown }} [details]
   */
  constructor(message, details) {
    super(message);
    this.name = "WeIncError";
    /** @type {number | undefined} HTTP status code, if a response was received. */
    this.status = details ? details.status : undefined;
    /** @type {unknown} Parsed response body (object if JSON, else raw text). */
    this.body = details ? details.body : undefined;
  }
}

/**
 * @typedef {object} Project
 * @property {string} id UUID
 * @property {string} user_id UUID of the owning (client) user
 * @property {string} name
 * @property {string | null} description
 * @property {string} status
 * @property {string} created_at ISO 8601 timestamp
 * @property {string} updated_at ISO 8601 timestamp
 */

/**
 * @typedef {object} ProjectList
 * @property {Project[]} projects
 * @property {number} total
 */

/**
 * @typedef {object} PublishResult
 * @property {string} url Public URL of the published site.
 * @property {string} vercelUrl Underlying deployment URL.
 * @property {string} deployId
 * @property {"ready" | "pending"} status
 * @property {boolean} [dns_pending] Present (true) when DNS has not propagated yet.
 */

/**
 * @typedef {object} Preview
 * @property {string | null} published_url Live site URL, or null if never published.
 * @property {boolean} has_published
 * @property {string} embed_preview_path Path to mount in an iframe for a live editable preview.
 */

/**
 * @typedef {object} Domain
 * @property {string} id UUID
 * @property {string} project_id UUID
 * @property {string} domain
 * @property {string | null} subdomain
 * @property {string} status e.g. "pending", "active"
 * @property {Array<object>} dns_records DNS records the owner must create.
 * @property {string} ssl_status
 * @property {string | null} verified_at ISO 8601 timestamp or null
 * @property {string} created_at ISO 8601 timestamp
 * @property {string} updated_at ISO 8601 timestamp
 */

/**
 * @param {string} value
 * @param {string} name
 * @returns {string}
 */
function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new WeIncError(`${name} must be a non-empty string`);
  }
  return value;
}

/**
 * WeInc v1 API client.
 *
 * @example
 * const { WeIncClient } = require("weinc");
 * const weinc = new WeIncClient({ apiKey: process.env.WEINC_API_KEY });
 * const { projects } = await weinc.listProjects();
 */
class WeIncClient {
  /**
   * @param {object} options
   * @param {string} options.apiKey Org API key from the agency dashboard (starts with `wk_`).
   * @param {string} [options.baseUrl] Override the API base URL. Defaults to `https://my.we.inc/api/v1`.
   * @param {typeof fetch} [options.fetch] Custom fetch implementation (used in tests; defaults to global fetch, built into Node 18+).
   */
  constructor(options) {
    const { apiKey, baseUrl, fetch: fetchImpl } = options || {};
    requireNonEmptyString(apiKey, "apiKey");
    const resolvedFetch =
      fetchImpl || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
    if (typeof resolvedFetch !== "function") {
      throw new WeIncError(
        "No fetch implementation available. Use Node 18+ or pass options.fetch.",
      );
    }
    /** @type {string} */
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    /** @private */
    this._apiKey = apiKey;
    /** @private */
    this._fetch = resolvedFetch;
  }

  /**
   * Perform an authenticated JSON request. Exposed for calling endpoints this
   * client does not wrap yet.
   *
   * @param {string} method HTTP method.
   * @param {string} path Path relative to the base URL, e.g. `/projects`.
   * @param {{ query?: Record<string, string | number | undefined>, body?: unknown }} [options]
   * @returns {Promise<unknown>} Parsed JSON response body.
   */
  async request(method, path, options) {
    const { query, body } = options || {};
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    /** @type {Record<string, string>} */
    const headers = {
      authorization: `Bearer ${this._apiKey}`,
      accept: "application/json",
    };
    /** @type {RequestInit} */
    const init = { method, headers };
    if (body !== undefined) {
      init.headers = { ...headers, "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await this._fetch(url.toString(), init);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new WeIncError(`Network error calling ${method} ${url.pathname}: ${reason}`);
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const serverMessage =
        data && typeof data === "object" && typeof (/** @type {any} */ (data).error) === "string"
          ? /** @type {any} */ (data).error
          : `HTTP ${response.status}`;
      throw new WeIncError(`${method} ${url.pathname} failed: ${serverMessage}`, {
        status: response.status,
        body: data,
      });
    }

    return data;
  }

  /**
   * List projects in your org.
   *
   * `GET /projects` (in the OpenAPI spec).
   *
   * @param {object} [params]
   * @param {number} [params.limit] Max results (server default 50).
   * @param {number} [params.offset] Pagination offset.
   * @param {string} [params.clientId] Filter by client UUID (sent as `client_id`).
   * @param {string} [params.status] Filter by project status.
   * @returns {Promise<ProjectList>}
   */
  async listProjects(params) {
    const { limit, offset, clientId, status } = params || {};
    return /** @type {Promise<ProjectList>} */ (
      this.request("GET", "/projects", {
        query: { limit, offset, client_id: clientId, status },
      })
    );
  }

  /**
   * Get one project by ID.
   *
   * `GET /projects/{projectId}` (in the OpenAPI spec).
   *
   * @param {string} projectId Project UUID.
   * @returns {Promise<{ project: Project }>}
   */
  async getProject(projectId) {
    requireNonEmptyString(projectId, "projectId");
    return /** @type {Promise<{ project: Project }>} */ (
      this.request("GET", `/projects/${encodeURIComponent(projectId)}`)
    );
  }

  /**
   * Publish a project's built site.
   *
   * `POST /projects/{projectId}/publish` — implemented by the API but not yet
   * in the OpenAPI spec (shape verified against server source 2026-08-04).
   *
   * WeInc builds run client-side (in WebContainers), so the caller must
   * provide the already-built `dist/` output as a map of file path to file
   * content, e.g. `{ "index.html": "<!doctype html>..." }`.
   *
   * @param {string} projectId Project UUID.
   * @param {Record<string, string>} builtFiles Map of built file path to file content.
   * @returns {Promise<PublishResult>}
   */
  async publishSite(projectId, builtFiles) {
    requireNonEmptyString(projectId, "projectId");
    if (builtFiles === null || typeof builtFiles !== "object" || Array.isArray(builtFiles)) {
      throw new WeIncError("builtFiles must be an object mapping file paths to file contents");
    }
    return /** @type {Promise<PublishResult>} */ (
      this.request("POST", `/projects/${encodeURIComponent(projectId)}/publish`, {
        body: { builtFiles },
      })
    );
  }

  /**
   * Get preview / published URLs for a project.
   *
   * `GET /projects/{projectId}/preview` — implemented by the API but not yet
   * in the OpenAPI spec (shape verified against server source 2026-08-04).
   *
   * @param {string} projectId Project UUID.
   * @returns {Promise<Preview>}
   */
  async getPreview(projectId) {
    requireNonEmptyString(projectId, "projectId");
    return /** @type {Promise<Preview>} */ (
      this.request("GET", `/projects/${encodeURIComponent(projectId)}/preview`)
    );
  }

  /**
   * List domains attached to a project.
   *
   * `GET /projects/{projectId}/domains` — implemented by the API but not yet
   * in the OpenAPI spec. Returns a plain array of domain records (shape
   * matches the server's `project_domains` table, verified 2026-08-04).
   *
   * @param {string} projectId Project UUID.
   * @returns {Promise<Domain[]>}
   */
  async listDomains(projectId) {
    requireNonEmptyString(projectId, "projectId");
    return /** @type {Promise<Domain[]>} */ (
      this.request("GET", `/projects/${encodeURIComponent(projectId)}/domains`)
    );
  }
}

module.exports = { WeIncClient, WeIncError, DEFAULT_BASE_URL };
