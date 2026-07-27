/** Thin fetch helpers for the in-memory multiplayer API. */

async function req(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function createMpRoom(body) {
  return req("/api/mp/rooms", { method: "POST", body: JSON.stringify(body) });
}

export function getMpRoom(code, token) {
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return req(`/api/mp/rooms/${encodeURIComponent(code)}${q}`);
}

export function joinMpRoom(code, body) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startMpRoom(code, body) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/start`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitMpBill(code, body) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function unsubmitMpBill(code, body) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/unsubmit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function leaveMpRoom(code, body) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/leave`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function chooseMpEvent(code, body) {
  return req(`/api/mp/rooms/${encodeURIComponent(code)}/event`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
