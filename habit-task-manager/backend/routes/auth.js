const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });
}
function setAuthCookie(res, token) {
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000 });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are all required." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    const normalizedEmail = email.toLowerCase().trim();
    if (await db.get("SELECT id FROM users WHERE email = ?", normalizedEmail)) return res.status(409).json({ error: "An account with that email already exists." });
    const passwordHash = bcrypt.hashSync(password, 10);
    const info = await db.run("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id", name.trim(), normalizedEmail, passwordHash);
    const id = info.lastInsertRowid;
    setAuthCookie(res, signToken(id));
    res.status(201).json({ id, name: name.trim(), email: normalizedEmail });
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const user = await db.get("SELECT * FROM users WHERE email = ?", email.toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "Incorrect email or password." });
    setAuthCookie(res, signToken(user.id));
    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (err) { next(err); }
});

router.post("/logout", (req, res) => { res.clearCookie("token"); res.json({ ok: true }); });

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await db.get("SELECT id, name, email, created_at FROM users WHERE id = ?", req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
