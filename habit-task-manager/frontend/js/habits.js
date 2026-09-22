const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l4 4L19 6"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-2 4-2 7a3 3 0 006 0c1.5 1.5 2 3.5 2 5a6 6 0 11-12 0c0-4 3-7 6-12z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 2l4 4-4 4"/><path d="M3 12v-2a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 12v2a4 4 0 01-4 4H3"/></svg>',
};

const COLORS = ["#2F6FED", "#35B37E", "#E0A72E", "#E5595F", "#8B93A5", "#C084FC"];
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

let selectedFrequency = "daily";
let selectedCustomDays = new Set();
let selectedColor = COLORS[0];
let editingHabitId = null;

(async function init() {
  const user = await requireSession();
  renderSidebar("habits.html", user);
  buildColorPicker();
  buildCustomDaysPicker();
  wireModal();
  await loadHabits();
})();

function buildColorPicker() {
  const el = document.getElementById("habit-color-picker");
  el.innerHTML = COLORS.map((c) => `<button type="button" class="chip-toggle" data-color="${c}" style="width:28px;height:28px;padding:0;border-radius:50%;background:${c};border-color:${c};"></button>`).join("");
  el.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      selectedColor = b.dataset.color;
      el.querySelectorAll("button").forEach((x) => x.style.outline = "none");
      b.style.outline = `2px solid var(--white)`;
      b.style.outlineOffset = "2px";
    });
  });
}

function buildCustomDaysPicker() {
  const el = document.getElementById("habit-custom-days");
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  el.innerHTML = names.map((n) => `<button type="button" class="chip-toggle" data-day="${n}">${n}</button>`).join("");
  el.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      b.classList.toggle("active");
      if (b.classList.contains("active")) selectedCustomDays.add(b.dataset.day);
      else selectedCustomDays.delete(b.dataset.day);
    });
  });
}

async function loadHabits() {
  const habits = await api("/habits");
  document.getElementById("habit-count").textContent = habits.length;
  renderHabitList(habits);
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function renderHabitList(habits) {
  const list = document.getElementById("habit-list");
  if (habits.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${ICONS.repeat}</div>
      <div class="title">No habits yet</div>
      <div class="hint">Add one you want to do daily, on weekdays, or on custom days.</div>
    </div>`;
    return;
  }

  const days = last7Days();
  const today = todayISO();

  list.innerHTML = habits.map((h) => {
    const logByDate = new Map(h.recent_logs.map((l) => [l.log_date, l.status]));
    const cells = days.map((date) => {
      const status = logByDate.get(date);
      const dow = DOW_LABELS[new Date(date + "T00:00:00").getDay()];
      const cls = status === "done" ? "done" : status === "missed" ? "missed" : "";
      const isToday = date === today;
      return `
        <div class="day-cell">
          <span class="dow">${dow}</span>
          <button class="day-box ${cls} ${isToday ? "today" : ""}" data-habit="${h.id}" data-date="${date}" data-status="${status || ""}">
            ${status === "done" ? ICONS.check : status === "missed" ? ICONS.cross : ""}
          </button>
        </div>`;
    }).join("");

    return `
      <div class="habit-row" data-id="${h.id}">
        <div class="habit-top">
          <div class="habit-name">
            <span class="habit-dot" style="background:${h.color}"></span>
            ${escapeHtml(h.name)}
            ${h.streak > 0 ? `<span class="habit-streak">${ICONS.flame}${h.streak}</span>` : ""}
          </div>
          <div class="item-actions">
            <button class="icon-btn" data-action="edit" data-id="${h.id}" title="Edit">${ICONS.edit}</button>
            <button class="icon-btn" data-action="delete" data-id="${h.id}" title="Delete">${ICONS.trash}</button>
          </div>
        </div>
        ${h.description ? `<div class="item-desc" style="margin-bottom:10px;">${escapeHtml(h.description)}</div>` : ""}
        <div class="week-grid">${cells}</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".day-box").forEach((box) => {
    box.addEventListener("click", async () => {
      const { habit, date, status } = box.dataset;
      const next = status === "" ? "done" : status === "done" ? "missed" : "";
      if (next === "") {
        await api(`/habits/${habit}/log/${date}`, { method: "DELETE" });
      } else {
        await api(`/habits/${habit}/log`, { method: "POST", body: { date, status: next } });
      }
      await loadHabits();
    });
  });

  list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const habits = await api("/habits");
      const habit = habits.find((h) => String(h.id) === btn.dataset.id);
      openHabitModal(habit);
    });
  });
  list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this habit and all its history? This can't be undone.")) return;
      await api(`/habits/${btn.dataset.id}`, { method: "DELETE" });
      await loadHabits();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function wireModal() {
  const modal = document.getElementById("habit-modal");
  const form = document.getElementById("habit-form");
  const freqGroup = document.getElementById("habit-frequency");
  const customField = document.getElementById("habit-custom-days-field");

  document.getElementById("add-habit-btn").addEventListener("click", () => openHabitModal(null));
  document.getElementById("habit-modal-close").addEventListener("click", () => modal.close());
  document.getElementById("habit-cancel").addEventListener("click", () => modal.close());

  freqGroup.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      selectedFrequency = b.dataset.value;
      freqGroup.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      customField.style.display = selectedFrequency === "custom" ? "flex" : "none";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById("habit-name").value.trim(),
      description: document.getElementById("habit-desc").value.trim(),
      frequency: selectedFrequency,
      custom_days: Array.from(selectedCustomDays).join(","),
      target_per_week: Number(document.getElementById("habit-target").value) || 7,
      color: selectedColor,
    };
    try {
      if (editingHabitId) {
        await api(`/habits/${editingHabitId}`, { method: "PUT", body });
      } else {
        await api("/habits", { method: "POST", body });
      }
      modal.close();
      await loadHabits();
    } catch (err) {
      const el = document.getElementById("habit-form-error");
      el.textContent = err.message;
      el.classList.add("show");
    }
  });
}

function openHabitModal(habit) {
  editingHabitId = habit ? habit.id : null;
  document.getElementById("habit-modal-title").textContent = habit ? "Edit habit" : "New habit";
  document.getElementById("habit-form-error").classList.remove("show");
  document.getElementById("habit-name").value = habit?.name || "";
  document.getElementById("habit-desc").value = habit?.description || "";
  document.getElementById("habit-target").value = habit?.target_per_week || 7;

  selectedFrequency = habit?.frequency || "daily";
  const freqGroup = document.getElementById("habit-frequency");
  freqGroup.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === selectedFrequency));
  document.getElementById("habit-custom-days-field").style.display = selectedFrequency === "custom" ? "flex" : "none";

  selectedCustomDays = new Set((habit?.custom_days || "").split(",").filter(Boolean));
  document.querySelectorAll("#habit-custom-days button").forEach((b) => {
    b.classList.toggle("active", selectedCustomDays.has(b.dataset.day));
  });

  selectedColor = habit?.color || COLORS[0];
  document.querySelectorAll("#habit-color-picker button").forEach((b) => {
    const on = b.dataset.color === selectedColor;
    b.style.outline = on ? "2px solid var(--white)" : "none";
    b.style.outlineOffset = on ? "2px" : "0";
  });

  document.getElementById("habit-modal").showModal();
}
