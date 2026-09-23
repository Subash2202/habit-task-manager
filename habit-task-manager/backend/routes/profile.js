const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const user = await db.get(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      req.userId
    );
    if (!user) return res.status(404).json({ error: "User not found." });

    const [taskStats, habitStats, goalStats] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'done')::int AS completed
        FROM tasks WHERE user_id = ?
      `, req.userId),
      db.get(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE archived = 0)::int AS active
        FROM habits WHERE user_id = ?
      `, req.userId),
      db.get(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'active')::int AS active,
               COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM goals WHERE user_id = ?
      `, req.userId),
    ]);

    res.json({
      user,
      stats: {
        tasks_total: taskStats?.total || 0,
        tasks_completed: taskStats?.completed || 0,
        habits_total: habitStats?.total || 0,
        habits_active: habitStats?.active || 0,
        goals_total: goalStats?.total || 0,
        goals_active: goalStats?.active || 0,
        goals_completed: goalStats?.completed || 0,
      },
    });
  } catch (err) { next(err); }
});

router.put("/", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!name || !email) return res.status(400).json({ error: "Name and email are required." });
    if (name.length > 80) return res.status(400).json({ error: "Name must be 80 characters or fewer." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });

    const existing = await db.get(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      email, req.userId
    );
    if (existing) return res.status(409).json({ error: "That email is already in use." });

    const result = await db.get(
      "UPDATE users SET name = ?, email = ? WHERE id = ? RETURNING id, name, email, created_at",
      name, email, req.userId
    );
    if (!result) return res.status(404).json({ error: "User not found." });

    res.json(result);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email is already in use." });
    next(err);
  }
});

router.put("/password", async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    const user = await db.get("SELECT password_hash FROM users WHERE id = ?", req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, req.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
