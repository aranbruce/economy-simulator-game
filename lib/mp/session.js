/** Persist multiplayer session for reconnect after refresh. */

const KEY = "econ-mp-session";

export function saveMpSession(session) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!session || !session.code || !session.token) {
      localStorage.removeItem(KEY);
      return;
    }
    localStorage.setItem(
      KEY,
      JSON.stringify({
        code: session.code,
        token: session.token,
        role: session.role,
        name: session.name,
        homeIso: session.homeIso,
      })
    );
  } catch {
    /* private mode / quota */
  }
}

export function loadMpSession() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.code || !data.token) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearMpSession() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
