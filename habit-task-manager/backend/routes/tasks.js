const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
router.use(requireAuth);
const STATUSES = ["todo", "in_progress", "done", "deferred"];
const PRIORITIES = ["low", "medium", "high"];

router.get("/", async (req, res, next) => {
  try {
    const { status, priority, category } = req.query;
    let sql = "SELECT * FROM tasks WHERE user_id = ?"; const params = [req.userId];
    if (status && STATUSES.includes(status)) { sql += " AND status = ?"; params.push(status); }
    if (priority && PRIORITIES.includes(priority)) { sql += " AND priority = ?"; params.push(priority); }
    if (category) { sql += " AND category = ?"; params.push(category); }
    sql += " ORDER BY (due_date IS NULL), due_date ASC, created_at DESC";
    res.json(await db.all(sql, ...params));
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, description, category, priority, due_date, status } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "A task needs a title." });
    const info = await db.run(`INSERT INTO tasks (user_id, title, description, category, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`, req.userId, title.trim(), description || "", category && category.trim() ? category.trim() : "General", PRIORITIES.includes(priority) ? priority : "medium", due_date || null, STATUSES.includes(status) ? status : "todo");
    res.status(201).json(await db.get("SELECT * FROM tasks WHERE id = ?", info.lastInsertRowid));
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const task = await db.get("SELECT * FROM tasks WHERE id = ? AND user_id = ?", req.params.id, req.userId);
    if (!task) return res.status(404).json({ error: "Task not found." });
    const { title, description, category, priority, due_date } = req.body || {};
    await db.run(`UPDATE tasks SET title = ?, description = ?, category = ?, priority = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?`, title !== undefined && title.trim() ? title.trim() : task.title, description !== undefined ? description : task.description, category !== undefined && category.trim() ? category.trim() : task.category, PRIORITIES.includes(priority) ? priority : task.priority, due_date !== undefined ? due_date : task.due_date, task.id);
    res.json(await db.get("SELECT * FROM tasks WHERE id = ?", task.id));
  } catch (err) { next(err); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const task = await db.get("SELECT * FROM tasks WHERE id = ? AND user_id = ?", req.params.id, req.userId);
    if (!task) return res.status(404).json({ error: "Task not found." });
    const { status, deferred_to, defer_reason } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Status must be one of: " + STATUSES.join(", ") });
    if (status === "deferred" && !deferred_to) return res.status(400).json({ error: "Pick the date you plan to come back to this task." });
    const completedAt = status === "done" ? new Date().toISOString() : null;
    await db.run(`UPDATE tasks SET status = ?, deferred_to = ?, defer_reason = ?, completed_at = ?, updated_at = datetime('now') WHERE id = ?`, status, status === "deferred" ? deferred_to : null, status === "deferred" ? defer_reason || "" : "", completedAt, task.id);
    res.json(await db.get("SELECT * FROM tasks WHERE id = ?", task.id));
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const info = await db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", req.params.id, req.userId);
    if (info.changes === 0) return res.status(404).json({ error: "Task not found." });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
module.exports = router;
