// Thin wrapper around fetch(): always sends the login cookie, always sends/
// expects JSON, and throws a plain Error with a readable message on failure.
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-JSON response */ }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Cache the current user for the browser session. Every protected page used to
// make a fresh /auth/me request, adding an extra database round-trip on every
// navigation. The cache is refreshed when profile data changes and cleared on logout.
const SESSION_CACHE_KEY = "northline_current_user";

async function requireSession() {
  try {
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const user = await api("/auth/me");
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    window.location.href = "/index.html";
    throw err;
  }
}

function setSessionUser(user) {
  if (user) sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_CACHE_KEY);
  return user;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(iso) {
  if (!iso) return false;
  return iso < todayISO();
}
