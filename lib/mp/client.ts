/** Thin fetch helpers for the multiplayer API. */

export class MpApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "MpApiError";
    this.status = status;
    this.data = data;
  }
}

interface ReqOpts extends RequestInit {
  timeoutMs?: number;
}

async function req(path: string, opts: ReqOpts = {}) {
  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 12000;
  const { timeoutMs: _t, ...fetchOpts } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      ...fetchOpts,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(fetchOpts.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new MpApiError(
        data.error || res.statusText || "Request failed",
        res.status,
        data,
      );
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new MpApiError(
        "Timed out — check your connection or Redis settings",
        408,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function createMpRoom(body: unknown) {
  return req("/api/mp/rooms", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 8000,
  });
}

export function getMpRoom(code: string, token?: string | null) {
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return req(`/api/mp/rooms/${encodeURIComponent(code)}${q}`);
}

export function joinMpRoom(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startMpRoom(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/start`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitMpBill(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function unsubmitMpBill(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/unsubmit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function leaveMpRoom(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/leave`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function chooseMpEvent(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/event`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function applyMpDiplo(code: string, body: unknown) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/diplo`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Subscribe to room version bumps via SSE. Returns a close() function.
 * onEvent receives parsed payloads like { version, q }.
 */
export function openMpRoomStream(
  code: string,
  token: string,
  onEvent: (data: any) => void,
) {
  const url =
    `/api/mp/rooms/${encodeURIComponent(code)}/stream` +
    `?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);
  let closed = false;

  es.onmessage = (ev) => {
    if (!ev.data) return;
    try {
      const data = JSON.parse(ev.data);
      if (typeof onEvent === "function") onEvent(data);
    } catch {
      /* ignore malformed */
    }
  };

  es.addEventListener("end", () => {
    close();
  });

  es.onerror = () => {
    /* Browser will retry; caller may also reopen after close. */
  };

  function close() {
    if (closed) return;
    closed = true;
    try {
      es.close();
    } catch {
      /* ignore */
    }
  }

  return close;
}
