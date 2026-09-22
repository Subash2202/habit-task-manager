const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l4 4L19 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16l-2 9H6L4 4z"/><path d="M4 4L2 4M20 4h2M3 13v5a2 2 0 002 2h14a2 2 0 002-2v-5"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-2 4-2 7a3 3 0 006 0c1.5 1.5 2 3.5 2 5a6 6 0 11-12 0c0-4 3-7 6-12z"/></svg>',
};

let currentUser = null;

(async function init() {
  currentUser = await requireSession();
  renderSidebar("dashboard.html", currentUser);
  document.getElementById("today-label").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
  await loadDashboard();
  wireQuickAdd();
  wireDeferModal();
})();

async function loadDashboard() {
  const data = await api("/dashboard");

  document.getElementById("stat-due-today").textContent = data.due_today.length;
  document.getElementById("stat-overdue").textContent = data.overdue.length;
  document.getElementById("stat-deferred").textContent = data.deferred.length;
  document.getElementById("stat-habits").textContent =
    data.habits_today.filter((h) => h.status_today === "done").length + " / " + data.habits_today.length;

  renderTodayList(data.overdue, data.due_today);
  renderHabitsToday(data.habits_today);
  renderDeferredList(data.deferred);
  renderGoalsList(data.active_goals);
}

function renderTodayList(overdue, dueToday) {
  const all = [...overdue.map((t) => ({ ...t, _overdue: true })), ...dueToday];
  document.getElementById("today-count").textContent = all.length;
  const list = document.getElementById("today-list");

  if (all.length === 0) {
    list.innerHTML = emptyState("check", "Nothing due today", "Add a task to get your day started.");
    return;
  }

  list.innerHTML = all.map((t) => `
    <div class="item-row" data-id="${t.id}">
      <button class="check-toggle" data-action="complete" data-id="${t.id}">${ICONS.check}</button>
      <div class="item-main">
        <div class="item-title">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          <span class="pill pill-${t.priority}">${t.priority}</span>
          ${t.due_date ? `<span class="date-chip ${t._overdue ? "overdue" : ""}">${t._overdue ? "Overdue · " : "Due "}${formatDate(t.due_date)}</span>` : ""}
          <span class="text-silver" style="font-size:11.5px;">${escapeHtml(t.category)}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" data-action="defer" data-id="${t.id}">Not today</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll('[data-action="complete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/tasks/${btn.dataset.id}/status`, { method: "PATCH", body: { status: "done" } });
      await loadDashboard();
    });
  });
  list.querySelectorAll('[data-action="defer"]').forEach((btn) => {
    btn.addEventListener("click", () => openDeferModal(btn.dataset.id));
  });
}

function renderHabitsToday(habits) {
  document.getElementById("habits-count").textContent = habits.length;
  const list = document.getElementById("habits-today-list");

  if (habits.length === 0) {
    list.innerHTML = emptyState("target", "No habits yet", "Habits you add will show up here every day.");
    return;
  }

  list.innerHTML = habits.map((h) => `
    <div class="item-row">
      <button class="check-toggle ${h.status_today === "done" ? "done" : ""}" data-id="${h.id}" data-status="${h.status_today}">${ICONS.check}</button>
      <div class="item-main">
        <div class="item-title ${h.status_today === "done" ? "done" : ""}">${escapeHtml(h.name)}</div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".check-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const today = todayISO();
      if (btn.dataset.status === "done") {
        await api(`/habits/${btn.dataset.id}/log/${today}`, { method: "DELETE" });
      } else {
        await api(`/habits/${btn.dataset.id}/log`, { method: "POST", body: { date: today, status: "done" } });
      }
      await loadDashboard();
    });
  });
}

function renderDeferredList(deferred) {
  document.getElementById("deferred-count").textContent = deferred.length;
  const list = document.getElementById("deferred-list");

  if (deferred.length === 0) {
    list.innerHTML = emptyState("clock", "Nothing deferred", "Tasks you push to a later day land here.");
    return;
  }

  list.innerHTML = deferred.map((t) => `
    <div class="item-row">
      <div class="item-main">
        <div class="item-title">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          <span class="date-chip">Back on ${formatDate(t.deferred_to)}</span>
        </div>
        ${t.defer_reason ? `<div class="item-desc">${escapeHtml(t.defer_reason)}</div>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" data-action="resume" data-id="${t.id}">Do it now</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll('[data-action="resume"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/tasks/${btn.dataset.id}/status`, { method: "PATCH", body: { status: "in_progress" } });
      await loadDashboard();
    });
  });
}

function renderGoalsList(goals) {
  document.getElementById("goals-count").textContent = goals.length;
  const list = document.getElementById("goals-list");

  if (goals.length === 0) {
    list.innerHTML = emptyState("target", "No active goals", "Set a weekly, monthly or yearly goal from the Goals page.");
    return;
  }

  list.innerHTML = goals.slice(0, 5).map((g) => {
    const pct = Math.min(100, Math.round((g.current_value / g.target_value) * 100));
    return `
      <div class="goal-card">
        <div class="goal-top">
          <div>
            <div class="goal-title">${escapeHtml(g.title)}</div>
            <div class="goal-period">${g.period_type} · through ${formatDate(g.period_end)}</div>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill ${pct >= 100 ? "complete" : ""}" style="width:${pct}%;"></div></div>
        <div class="goal-progress-label"><span>${g.current_value} / ${g.target_value} ${g.unit}</span><span>${pct}%</span></div>
      </div>
    `;
  }).join("");
}

function emptyState(icon, title, hint) {
  return `<div class="empty-state">
    <div class="icon">${ICONS[icon]}</div>
    <div class="title">${title}</div>
    <div class="hint">${hint}</div>
  </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ---------- Quick add task modal ---------- */
function wireQuickAdd() {
  const modal = document.getElementById("task-modal");
  const form = document.getElementById("task-form");
  const priorityGroup = document.getElementById("task-priority");
  let selectedPriority = "medium";

  document.getElementById("quick-add-task").addEventListener("click", () => {
    form.reset();
    selectedPriority = "medium";
    priorityGroup.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === "medium"));
    document.getElementById("task-form-error").classList.remove("show");
    modal.showModal();
  });
  document.getElementById("task-modal-close").addEventListener("click", () => modal.close());
  document.getElementById("task-cancel").addEventListener("click", () => modal.close());

  priorityGroup.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      selectedPriority = b.dataset.value;
      priorityGroup.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      title: document.getElementById("task-title").value.trim(),
      description: document.getElementById("task-desc").value.trim(),
      category: document.getElementById("task-category").value.trim(),
      due_date: document.getElementById("task-due").value || null,
      priority: selectedPriority,
    };
    try {
      await api("/tasks", { method: "POST", body });
      modal.close();
      await loadDashboard();
    } catch (err) {
      const el = document.getElementById("task-form-error");
      el.textContent = err.message;
      el.classList.add("show");
    }
  });
}

/* ---------- Defer modal ---------- */
function wireDeferModal() {
  const modal = document.getElementById("defer-modal");
  const form = document.getElementById("defer-form");

  document.getElementById("defer-modal-close").addEventListener("click", () => modal.close());
  document.getElementById("defer-cancel").addEventListener("click", () => modal.close());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const taskId = form.dataset.taskId;
    const body = {
      status: "deferred",
      deferred_to: document.getElementById("defer-date").value,
      defer_reason: document.getElementById("defer-reason").value.trim(),
    };
    try {
      await api(`/tasks/${taskId}/status`, { method: "PATCH", body });
      modal.close();
      await loadDashboard();
    } catch (err) {
      const el = document.getElementById("defer-form-error");
      el.textContent = err.message;
      el.classList.add("show");
    }
  });
}

function openDeferModal(taskId) {
  const modal = document.getElementById("defer-modal");
  const form = document.getElementById("defer-form");
  form.reset();
  form.dataset.taskId = taskId;
  document.getElementById("defer-form-error").classList.remove("show");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("defer-date").min = todayISO();
  document.getElementById("defer-date").value = tomorrow.toISOString().slice(0, 10);
  modal.showModal();
}
