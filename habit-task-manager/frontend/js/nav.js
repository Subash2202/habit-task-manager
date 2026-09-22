const NAV_ITEMS = [
  { href: "dashboard.html", label: "Overview", icon: "grid" },
  { href: "tasks.html", label: "Tasks", icon: "check" },
  { href: "habits.html", label: "Habits", icon: "repeat" },
  { href: "goals.html", label: "Goals", icon: "target" },
];

const NAV_ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 12.5l3 3 6-6"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 2l4 4-4 4"/><path d="M3 12v-2a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 12v2a4 4 0 01-4 4H3"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
};

function renderSidebar(activePage, user) {
  const mount = document.getElementById("sidebar-mount");
  if (!mount) return;

  const items = NAV_ITEMS.map((item) => {
    const isActive = item.href === activePage;
    return `<li>
      <a class="nav-link${isActive ? " active" : ""}" href="${item.href}">
        ${NAV_ICONS[item.icon]}<span>${item.label}</span>
      </a>
    </li>`;
  }).join("");

  const initials = (user?.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  mount.innerHTML = `
    <div class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 17l5-5 4 4 7-9"/></svg>
      </div>
      <div class="brand-name">Northline<span>Habit & task manager</span></div>
    </div>
    <ul class="nav-list">${items}</ul>
    <div class="sidebar-foot">
      <div class="user-chip">${initials || "?"}</div>
      <div class="who">
        <div class="name">${user?.name || ""}</div>
        <div class="email">${user?.email || ""}</div>
      </div>
      <button class="icon-btn" id="logout-btn" title="Log out">${NAV_ICONS.logout}</button>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" });
    window.location.href = "/index.html";
  });
}
