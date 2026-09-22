// Decorative hero grid: a scatter of "on" cells to echo the habit-tracking
// grid used later in the app, without needing any real data on this page.
(function buildHeroGrid() {
  const grid = document.getElementById("hero-grid");
  if (!grid) return;
  const pattern = [1,0,1,1,0,0,1, 0,1,1,0,1,0,0, 1,1,0,0,1,1,0, 1,0,1,1,0,1,1, 0,0,1,0,1,1,0];
  grid.innerHTML = pattern.map((on) => `<div class="cell ${on ? "on" : "dim"}"></div>`).join("");
})();

// If already logged in, skip straight to the dashboard.
api("/auth/me").then(() => { window.location.href = "dashboard.html"; }).catch(() => {});

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const panelLogin = document.getElementById("panel-login");
const panelRegister = document.getElementById("panel-register");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  panelLogin.classList.remove("hidden");
  panelRegister.classList.add("hidden");
});
tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  panelRegister.classList.remove("hidden");
  panelLogin.classList.add("hidden");
});

function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.add("show");
}
function clearError(id) {
  document.getElementById(id).classList.remove("show");
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("login-error");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await api("/auth/login", { method: "POST", body: { email, password } });
    window.location.href = "dashboard.html";
  } catch (err) {
    showError("login-error", err.message);
  }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("register-error");
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  try {
    await api("/auth/register", { method: "POST", body: { name, email, password } });
    window.location.href = "dashboard.html";
  } catch (err) {
    showError("register-error", err.message);
  }
});
