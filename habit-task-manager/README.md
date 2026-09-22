# Northline — Personal Habit & Task Manager

A full-stack web app for tracking daily tasks, recurring habits, and
weekly/monthly/yearly goals. Email + password login, all data stored
server-side per account.

## What's included

- **Tasks** — title, description, category, priority, due date, status
  (to do / in progress / done / **deferred**). Deferred is the "I can't do
  it today, but I will later" state: you pick a comeback date and,
  optionally, a reason. Deferred tasks show up in their own list on the
  dashboard until you resume them.
- **Habits** — daily / weekdays / custom-day habits with a 7-day check-in
  grid and an automatically computed streak.
- **Goals** — weekly, monthly or yearly targets with a numeric progress bar
  (e.g. "run 20 km this week"), and an optional link to a habit.
- **Dashboard** — today's and overdue tasks, today's habit checklist,
  deferred items waiting for their comeback date, and active goal progress,
  in one view.
- **Accounts** — register/login with email + password (hashed with bcrypt),
  session kept in an httpOnly cookie so the token can't be read by page
  scripts.

## Tech stack, and why

| Layer    | Choice                          | Why |
|----------|----------------------------------|-----|
| Backend  | Node.js + Express                | Small, well-documented, runs on almost any host |
| Database | SQLite (`better-sqlite3`)        | See below |
| Auth     | bcrypt password hashes + JWT in an httpOnly cookie | Standard, no third-party auth service needed |
| Frontend | Plain HTML/CSS/JS (no build step)| Easiest to host anywhere, nothing to compile |

**On storage:** you mentioned Google Sheets — it's fine for a quick log,
but it's not built for this. Every read/write goes over the Sheets API
(slow for small per-field updates like "mark this task done"), there's no
real indexing, and concurrent writes can silently overwrite each other.
SQLite instead gives you real indexes (fast lookups by user/status/date),
proper relations (a habit's logs and a user's tasks are linked by ID, not
by matching text), and it's a single file — easy to back up, easy to
inspect, easy to move. For a personal tool like this it's the efficient
option. If you later want your data to *also* land in a spreadsheet (for
sharing or reporting), that's a small addition we can make once this is
hosted — the database stays the source of truth, and a "Sync to Sheets"
button just calls the Sheets API on top of it.

## Project structure

```
habit-task-manager/
├── backend/
│   ├── server.js          # Express app entry point
│   ├── db/index.js        # SQLite connection + schema (auto-created on first run)
│   ├── middleware/auth.js # Verifies the login cookie on protected routes
│   └── routes/
│       ├── auth.js        # register, login, logout, /me
│       ├── tasks.js       # task CRUD + status/defer updates
│       ├── habits.js      # habit CRUD + daily check-ins + streaks
│       ├── goals.js       # goal CRUD + progress updates
│       └── dashboard.js   # aggregated summary for the overview page
├── frontend/
│   ├── index.html         # login / create account
│   ├── dashboard.html
│   ├── tasks.html
│   ├── habits.html
│   ├── goals.html
│   ├── css/style.css
│   └── js/                # one file per page, plus api.js and nav.js
├── package.json
└── .env.example
```

## Running it locally

Requires Node 18+.

```bash
cd habit-task-manager
npm install
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a random string (the file explains how
to generate one). Then:

```bash
npm start
```

Open **http://localhost:3000**, create an account, and start adding tasks
and habits. The database file is created automatically at
`data/app.db` the first time you run it — nothing else to set up.

## A few implementation notes

- Every `/api/*` route except `/api/auth/*` requires a valid login cookie;
  each query is scoped to `user_id`, so one account can never see another's
  data.
- Passwords are hashed with bcrypt before they touch the database — the
  plain password is never stored.
- The habit streak is computed on read (consecutive "done" days counting
  back from today), not stored, so it's always correct even if you edit
  old entries.
- A goal's date range (e.g. "this week") is computed automatically from
  its period type when you create it, using a Monday-start week.

## Next: hosting

This is ready to deploy as-is to any Node host (Render, Railway, Fly.io, a
VPS, etc.). The one thing worth deciding first is whether you want to stay
with a single SQLite file (simplest, works great for one person) or move
to a hosted database like Postgres if you'll have multiple users or want
the data off the server's disk. Let's talk through your hosting options
next.
