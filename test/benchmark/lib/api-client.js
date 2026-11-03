// Thin client for the SecureScanAI backend HTTP API. The harness drives the
// backend exactly like the frontend does, so results reflect the real system
// (Docker or local) rather than calling service functions directly.

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createApiClient({ baseUrl, requestTimeoutMs = 600_000 }) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(method, pathname, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    try {
      response = await fetch(`${root}${pathname}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err.name === 'AbortError' ? `timed out after ${requestTimeoutMs / 1000}s` : err.message;
      throw new ApiError(`${method} ${pathname} failed: ${reason}`, 0, null);
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON body (e.g. proxy error page); surfaced via message below
    }
    if (!response.ok) {
      throw new ApiError(json?.error ?? `${method} ${pathname} -> HTTP ${response.status}: ${text.slice(0, 300)}`, response.status, json);
    }
    return json;
  }

  return {
    health: () => request('GET', '/health'),
    submit: (repoUrl) => request('POST', '/scan/submit', { repo_url: repoUrl }),
    status: (scanId) => request('GET', `/scan/status/${encodeURIComponent(scanId)}`),
    report: (scanId) => request('GET', `/scan/report/${encodeURIComponent(scanId)}`),
    fix: (scanId, findingIndex) => request('POST', `/scan/fix/${encodeURIComponent(scanId)}`, { finding_index: findingIndex }),
    verify: (scanId, findingIndex) =>
      request('POST', `/scan/verify/${encodeURIComponent(scanId)}/${findingIndex}`),

    /** Polls until COMPLETED/FAILED, returning the final status plus the observed state timeline. */
    async waitForScan(scanId, { pollMs = 2000, timeoutMs = 1_800_000, onStatus } = {}) {
      const started = Date.now();
      const timeline = [];
      let last = null;
      while (Date.now() - started < timeoutMs) {
        const state = await request('GET', `/scan/status/${encodeURIComponent(scanId)}`);
        if (state.status !== last) {
          timeline.push({ status: state.status, at_ms: Date.now() - started });
          last = state.status;
          onStatus?.(state.status);
        }
        if (state.status === 'COMPLETED' || state.status === 'FAILED') return { state, timeline };
        await sleep(pollMs);
      }
      throw new ApiError(`Scan ${scanId} did not finish within ${timeoutMs / 1000}s (last status ${last})`, 0, null);
    },
  };
}
