const ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l4 4L19 6"/></svg>',
};

let currentPeriodFilter = "";
let selectedPeriod = "weekly";
let editingGoalId = null;
let habitsCache = [];
let goalsCache = [];

(async function init() {
  const user = await requireSession();
  renderSidebar("goals.html", user);
  const [habits] = await Promise.all([
    api("/habits"),
    loadGoals(),
  ]);
  habitsCache = habits;
  populateHabitSelect();
  wireFilterBar();
  wireGoalModal();
  wireProgressModal();
})();

function populateHabitSelect() {
  const select = document.getElementById("goal-habit");
  select.innerHTML = '<option value="">None</option>' +
    habitsCache.map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join("");
}

function wireFilterBar() {
  const bar = document.getElementById("period-filter");
  bar.querySelectorAll(".chip-toggle").forEach((chip) => {
    chip.addEventListener("click", async () => {
      bar.querySelectorAll(".chip-toggle").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentPeriodFilter = chip.dataset.value;
      await loadGoals();
    });
  });
}

async function loadGoals() {
  const qs = currentPeriodFilter ? `?type=${currentPeriodFilter}` : "";
  const goals = await api("/goals" + qs);
  goalsCache = goals;
  document.getElementById("goal-count").textContent = goals.length;
  renderGoalList(goals);
}

function renderGoalList(goals) {
  const list = document.getElementById("goal-list");
  if (goals.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${ICONS.target}</div>
      <div class="title">No goals here</div>
      <div class="hint">Set a weekly, monthly or yearly target to track.</div>
    </div>`;
    return;
  }

  list.innerHTML = goals.map((g) => {
    const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
    return `
      <div class="goal-card" data-id="${g.id}">
        <div class="goal-top">
          <div>
            <div class="goal-title">${escapeHtml(g.title)}</div>
            <div class="goal-period">${g.period_type} · ${formatDate(g.period_start)} – ${formatDate(g.period_end)}</div>
            ${g.description ? `<div class="item-desc" style="margin-top:6px;">${escapeHtml(g.description)}</div>` : ""}
          </div>
          <div class="item-actions">
            <span class="pill pill-${g.status === "completed" ? "done" : g.status === "missed" ? "high" : "in_progress"}">${g.status}</span>
            <button class="icon-btn" data-action="edit" data-id="${g.id}" title="Edit">${ICONS.edit}</button>
            <button class="icon-btn" data-action="delete" data-id="${g.id}" title="Delete">${ICONS.trash}</button>
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill ${pct >= 100 ? "complete" : ""}" style="width:${pct}%;"></div></div>
        <div class="goal-progress-label">
          <span>${g.current_value} / ${g.target_value} ${escapeHtml(g.unit)}</span>
          <span>${pct}%</span>
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn-ghost btn-sm" data-action="progress" data-id="${g.id}" data-current="${g.current_value}">Update progress</button>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      openGoalModal(goalsCache.find((g) => String(g.id) === btn.dataset.id));
    });
  });
  list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this goal?")) return;
      await api(`/goals/${btn.dataset.id}`, { method: "DELETE" });
      await loadGoals();
    });
  });
  list.querySelectorAll('[data-action="progress"]').forEach((btn) => {
    btn.addEventListener("click", () => openProgressModal(btn.dataset.id, btn.dataset.current));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ---------- Add/edit modal ---------- */
function wireGoalModal() {
  const modal = document.getElementById("goal-modal");
  const form = document.getElementById("goal-form");
  const periodGroup = document.getElementById("goal-period");

  document.getElementById("add-goal-btn").addEventListener("click", () => openGoalModal(null));
  document.getElementById("goal-modal-close").addEventListener("click", () => modal.close());
  document.getElementById("goal-cancel").addEventListener("click", () => modal.close());

  periodGroup.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      selectedPeriod = b.dataset.value;
      periodGroup.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      title: document.getElementById("goal-title").value.trim(),
      description: document.getElementById("goal-desc").value.trim(),
      period_type: selectedPeriod,
      target_value: Number(document.getElementById("goal-target").value) || 100,
      unit: document.getElementById("goal-unit").value.trim() || "%",
      linked_habit_id: document.getElementById("goal-habit").value || null,
    };
    try {
      if (editingGoalId) {
        await api(`/goals/${editingGoalId}`, { method: "PUT", body });
      } else {
        await api("/goals", { method: "POST", body });
      }
      modal.close();
      await loadGoals();
    } catch (err) {
      const el = document.getElementById("goal-form-error");
      el.textContent = err.message;
      el.classList.add("show");
    }
  });
}

function openGoalModal(goal) {
  editingGoalId = goal ? goal.id : null;
  document.getElementById("goal-modal-title").textContent = goal ? "Edit goal" : "New goal";
  document.getElementById("goal-form-error").classList.remove("show");
  document.getElementById("goal-title").value = goal?.title || "";
  document.getElementById("goal-desc").value = goal?.description || "";
  document.getElementById("goal-target").value = goal?.target_value ?? 100;
  document.getElementById("goal-unit").value = goal?.unit || "%";
  document.getElementById("goal-habit").value = goal?.linked_habit_id || "";

  selectedPeriod = goal?.period_type || "weekly";
  const periodGroup = document.getElementById("goal-period");
  periodGroup.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === selectedPeriod));
  // Period type can't be changed once a goal exists, since it drives the date range.
  periodGroup.querySelectorAll("button").forEach((b) => (b.disabled = !!goal));

  document.getElementById("goal-modal").showModal();
}

/* ---------- Progress modal ---------- */
function wireProgressModal() {
  const modal = document.getElementById("progress-modal");
  const form = document.getElementById("progress-form");

  document.getElementById("progress-modal-close").addEventListener("click", () => modal.close());
  document.getElementById("progress-cancel").addEventListener("click", () => modal.close());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const goalId = form.dataset.goalId;
    const body = { current_value: Number(document.getElementById("progress-value").value) };
    try {
      await api(`/goals/${goalId}/progress`, { method: "PATCH", body });
      modal.close();
      await loadGoals();
    } catch (err) {
      const el = document.getElementById("progress-form-error");
      el.textContent = err.message;
      el.classList.add("show");
    }
  });
}

function openProgressModal(goalId, current) {
  const modal = document.getElementById("progress-modal");
  const form = document.getElementById("progress-form");
  form.dataset.goalId = goalId;
  document.getElementById("progress-value").value = current;
  document.getElementById("progress-form-error").classList.remove("show");
  modal.showModal();
}
