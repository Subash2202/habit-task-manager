require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const db = require("./db");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET. Copy .env.example to .env and set a value before starting the server.");
  process.exit(1);
}

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const habitRoutes = require("./routes/habits");
const goalRoutes = require("./routes/goals");
const dashboardRoutes = require("./routes/dashboard");
const profileRoutes = require("./routes/profile");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);

// Serve the frontend
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendDir, "index.html"));
});

// Fallback error handler so unexpected errors return JSON, not an HTML stack trace
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Habit & Task Manager running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });
