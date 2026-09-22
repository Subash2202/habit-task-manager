const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l4 4L19 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16l-2 9H6L4 4z"/><path d="M4 4L2 4M20 4h2M3 13v5a2 2 0 002 2h14a2 2 0 002-2v-5"/></svg>',
};

let currentStatusFilter = "";
let editingTaskId = null;
let selectedPriority = "medium";

(async function init() {
  const user = await requireSession();
  renderSidebar("tasks.html", user);
  wireFilterBar();
  wireTaskModal();
  wireDeferModal();
  await loadTasks();
})();

function wireFilterBar() {
  const bar = document.getElementById("status-filter");
  bar.querySelectorAll(".chip-toggle").forEach((chip) => {
    chip.addEventListener("click", async () => {
      bar.querySelectorAll(".chip-toggle").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentStatusFilter = chip.dataset.value;
      await loadTasks();
    });
  });
}

async function loadTasks() {
  const qs = currentStatusFilter ? `?status=${currentStatusFilter}` : "";
  const tasks = await api("/tasks" + qs);
  document.getElementById("task-count").textContent = tasks.length;
  renderTaskList(tasks);
}

function renderTaskList(tasks) {
  const list = document.getElementById("task-list");
  if (tasks.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${ICONS.inbox}</div>
      <div class="title">No tasks here</div>
      <div class="hint">Try a different filter, or add a new task.</div>
    </div>`;
    return;
  }

  list.innerHTML = tasks.map((t) => {
    const overdue = t.status !== "done" && t.status !== "deferred" && isOverdue(t.due_date);
    return `
    <div class="item-row" data-id="${t.id}">
      <button class="check-toggle ${t.status === "done" ? "done" : ""}" data-action="toggle-done" data-id="${t.id}" data-status="${t.status}">${ICONS.check}</button>
      <div class="item-main">
        <div class="item-title ${t.status === "done" ? "done" : ""}">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="item-desc">${escapeHtml(t.description)}</div>` : ""}
        <div class="item-meta">
          <span class="pill pill-${t.status}">${statusLabel(t.status)}</span>
          <span class="pill pill-${t.priority}">${t.priority}</span>
          <span class="text-silver" style="font-size:11.5px;">${escapeHtml(t.category)}</span>
          ${t.due_date ? `<span class="date-chip ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : "Due "}${formatDate(t.due_date)}</span>` : ""}
          ${t.status === "deferred" ? `<span class="date-chip">Back on ${formatDate(t.deferred_to)}</span>` : ""}
        </div>
        ${t.status === "deferred" && t.defer_reason ? `<div class="item-desc">Reason: ${escapeHtml(t.defer_reason)}</div>` : ""}
      </div>
      <div class="item-actions">
        ${t.status !== "done" && t.status !== "deferred" ? `<button class="btn btn-ghost btn-sm" data-action="defer" data-id="${t.id}">Not today</button>` : ""}
        ${t.status === "deferred" ? `<button class="btn btn-ghost btn-sm" data-action="resume" data-id="${t.id}">Resume</button>` : ""}
        <button class="icon-btn" data-action="edit" data-id="${t.id}" title="Edit">${ICONS.edit}</button>
        <button class="icon-btn" data-action="delete" data-id="${t.id}" title="Delete">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll('[data-action="toggle-done"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const newStatus = btn.dataset.status === "done" ? "todo" : "done";
      await api(`/tasks/${btn.dataset.id}/status`, { method: "PATCH", body: { status: newStatus } });
      await loadTasks();
    });
  });
  list.querySelectorAll('[data-action="defer"]').forEach((btn) => {
    btn.addEventListener("click", () => openDeferModal(btn.dataset.id));
  });
  list.querySelectorAll('[data-action="resume"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/tasks/${btn.dataset.id}/status`, { method: "PATCH", body: { status: "in_progress" } });
      await loadTasks();
    });
  });
  list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tasks = await api("/tasks");
      const task = tasks.find((t) => String(t.id) === btn.dataset.id);
      openTaskModal(task);
    });
  });
  list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this task? This can't be undone.")) return;
      await api(`/tasks/${btn.dataset.id}`, { method: "DELETE" });
      await loadTasks();
    });
  });
}

function statusLabel(status) {
  return { todo: "To do", in_progress: "In progress", done: "Done", deferred: "Deferred" }[status] || status;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ---------- Add/edit modal ---------- */
function wireTaskModal() {
  const modal = document.getElementById("task-modal");
  const form = document.getElementById("task-form");
  const priorityGroup = document.getElementById("task-priority");

  document.getElementById("add-task-btn").addEventListener("click", () => openTaskModal(null));
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
      if (editingTaskId) {
        await api(`/tasks/${editingTaskId}`, { method: "PUT", body });
      } else {
        await api("/tasks", { method: "POST", body });
      }
      modal.close();
      await loadTasks();
    } catch (err) {
      const el = document.getElementById("task-form-error");
      el.textContent = err.message;
      el.classList.add("show");
    }
  });
}

function openTaskModal(task) {
  editingTaskId = task ? task.id : null;
  document.getElementById("task-modal-title").textContent = task ? "Edit task" : "New task";
  document.getElementById("task-form-error").classList.remove("show");
  document.getElementById("task-title").value = task?.title || "";
  document.getElementById("task-desc").value = task?.description || "";
  document.getElementById("task-category").value = task?.category === "General" ? "" : (task?.category || "");
  document.getElementById("task-due").value = task?.due_date || "";
  selectedPriority = task?.priority || "medium";
  const priorityGroup = document.getElementById("task-priority");
  priorityGroup.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === selectedPriority));
  document.getElementById("task-modal").showModal();
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
      await loadTasks();
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
