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

// Sends the visitor back to the login page if their session isn't valid.
// Every protected page calls this first; returns the current user on success.
async function requireSession() {
  try {
    return await api("/auth/me");
  } catch (err) {
    window.location.href = "/index.html";
    throw err;
  }
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
