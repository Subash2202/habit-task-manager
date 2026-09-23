let profileData = null;

(async function init() {
  const user = await requireSession();
  setSessionUser(user);
      renderSidebar("profile.html", user);
  await loadProfile();
  wireProfileForm();
  wirePasswordForm();
})();

async function loadProfile() {
  profileData = await api("/profile");
  const { user, stats } = profileData;
  const initials = (user.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  document.getElementById("profile-avatar").textContent = initials;
  document.getElementById("profile-display-name").textContent = user.name;
  document.getElementById("profile-display-email").textContent = user.email;
  document.getElementById("profile-member-since").textContent = `Member since ${formatMemberDate(user.created_at)}`;
  document.getElementById("profile-name").value = user.name;
  document.getElementById("profile-email").value = user.email;

  document.getElementById("stat-tasks").textContent = stats.tasks_completed;
  document.getElementById("stat-habits").textContent = stats.habits_active;
  document.getElementById("stat-goals").textContent = stats.goals_active;
  document.getElementById("summary-task-total").textContent = stats.tasks_total;
  document.getElementById("summary-task-completed").textContent = stats.tasks_completed;
  document.getElementById("summary-habit-total").textContent = stats.habits_total;
  document.getElementById("summary-habit-active").textContent = stats.habits_active;
  document.getElementById("summary-goal-total").textContent = stats.goals_total;
  document.getElementById("summary-goal-completed").textContent = stats.goals_completed;
}

function formatMemberDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function setMessage(id, message, success = false) {
  const el = document.getElementById(id);
  el.textContent = message || "";
  el.classList.toggle("show", Boolean(message));
  el.classList.toggle("success", success);
}

function clearMessages(...ids) { ids.forEach((id) => setMessage(id, "")); }

function wireProfileForm() {
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages("profile-error", "profile-success");
    const name = document.getElementById("profile-name").value.trim();
    const email = document.getElementById("profile-email").value.trim();
    try {
      const user = await api("/profile", { method: "PUT", body: { name, email } });
      document.getElementById("profile-display-name").textContent = user.name;
      document.getElementById("profile-display-email").textContent = user.email;
      document.getElementById("profile-avatar").textContent = user.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
      setMessage("profile-success", "Profile updated successfully.", true);
      // Refresh the shared navigation so the sidebar/mobile profile reflects the new name.
      setSessionUser(user);
      renderSidebar("profile.html", user);
    } catch (err) {
      setMessage("profile-error", err.message);
    }
  });
}

function wirePasswordForm() {
  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages("password-error", "password-success");
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    try {
      await api("/profile/password", { method: "PUT", body: { currentPassword, newPassword } });
      document.getElementById("password-form").reset();
      setMessage("password-success", "Password changed successfully.", true);
    } catch (err) {
      setMessage("password-error", err.message);
    }
  });
}
