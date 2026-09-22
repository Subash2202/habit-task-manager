const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in .env for local development or Render Environment Variables.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

function toPg(sql) {
  let i = 0;
  return sql
    .replace(/datetime\('now'\)/g, "CURRENT_TIMESTAMP")
    .replace(/\?/g, () => `$${++i}`);
}

async function all(sql, ...params) {
  const result = await pool.query(toPg(sql), params);
  return result.rows;
}

async function get(sql, ...params) {
  const result = await pool.query(toPg(sql), params);
  return result.rows[0];
}

async function run(sql, ...params) {
  const result = await pool.query(toPg(sql), params);
  return {
    changes: result.rowCount,
    rows: result.rows,
    lastInsertRowid: result.rows[0]?.id,
  };
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      description   TEXT DEFAULT '',
      category      TEXT DEFAULT 'General',
      priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
      status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','deferred')),
      due_date      TEXT,
      deferred_to   TEXT,
      defer_reason  TEXT DEFAULT '',
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at  TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);

    CREATE TABLE IF NOT EXISTS habits (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      description    TEXT DEFAULT '',
      frequency      TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','custom')),
      custom_days    TEXT DEFAULT '',
      target_per_week INTEGER DEFAULT 7,
      color          TEXT DEFAULT '#2F6FED',
      archived       INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived);

    CREATE TABLE IF NOT EXISTS habit_logs (
      id         SERIAL PRIMARY KEY,
      habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done','missed','skipped')),
      notes      TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(habit_id, log_date)
    );
    CREATE INDEX IF NOT EXISTS idx_habitlogs_habit_date ON habit_logs(habit_id, log_date);
    CREATE INDEX IF NOT EXISTS idx_habitlogs_user_date ON habit_logs(user_id, log_date);

    CREATE TABLE IF NOT EXISTS goals (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      description    TEXT DEFAULT '',
      period_type    TEXT NOT NULL CHECK (period_type IN ('weekly','monthly','yearly')),
      period_start   TEXT NOT NULL,
      period_end     TEXT NOT NULL,
      target_value   REAL DEFAULT 100,
      current_value  REAL DEFAULT 0,
      unit           TEXT DEFAULT '%',
      status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','missed')),
      linked_habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL,
      created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_goals_user_period ON goals(user_id, period_type, status);
  `);
}

module.exports = { pool, all, get, run, init };
