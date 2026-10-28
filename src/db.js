/* Database: libSQL, which is SQLite that can also live in the cloud.
   - Locally, with nothing set, it is a file at data/susu.db.
   - On Vercel (no disk), set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from a free Turso database.
   Tables are created on first use. */
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

let url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
if (!url) {
  const file = path.join(__dirname, '..', 'data', 'susu.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  url = 'file:' + file;
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });

const SCHEMA = [
`CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  desc TEXT NOT NULL DEFAULT '',
  cur TEXT NOT NULL DEFAULT 'GH₵',
  base REAL NOT NULL DEFAULT 50,
  every INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'weeks',
  start TEXT NOT NULL,
  cycles INTEGER NOT NULL DEFAULT 1,
  n INTEGER NOT NULL DEFAULT 4,
  fee REAL NOT NULL DEFAULT 0,
  self INTEGER NOT NULL DEFAULT 1,
  open INTEGER NOT NULL DEFAULT 1,
  setup INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
)`,
`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  pw_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`,
`CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  avatar INTEGER NOT NULL DEFAULT 0,
  phone TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  joined_at INTEGER NOT NULL,
  UNIQUE(group_id, username)
)`,
`CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  amount REAL NOT NULL,
  reference TEXT UNIQUE,
  recorded_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  UNIQUE(group_id, round, member_id)
)`,
`CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  amount REAL NOT NULL,
  reference TEXT UNIQUE,
  transfer_code TEXT,
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  UNIQUE(group_id, round)
)`,
`CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  who TEXT NOT NULL,
  what TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL
)`,
'CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id)',
'CREATE INDEX IF NOT EXISTS idx_payouts_group ON payouts(group_id)',
'CREATE INDEX IF NOT EXISTS idx_audit_group ON audit(group_id, at)'
];

let readyP = null;
function ready() {
  if (!readyP) readyP = (async () => { for (const s of SCHEMA) await client.execute(s); })();
  return readyP;
}

/* Small helpers: get one row, all rows, or run a write (returns the new row id). */
async function get(sql, args) { await ready(); const r = await client.execute({ sql, args: args || [] }); return r.rows[0] || null; }
async function all(sql, args) { await ready(); const r = await client.execute({ sql, args: args || [] }); return r.rows; }
async function run(sql, args) { await ready(); const r = await client.execute({ sql, args: args || [] }); return { id: r.lastInsertRowid === undefined ? null : Number(r.lastInsertRowid), changes: r.rowsAffected }; }
/* Several writes that must all happen or none. */
async function batch(stmts) { await ready(); return client.batch(stmts.map((s) => (typeof s === 'string' ? s : { sql: s[0], args: s[1] || [] })), 'write'); }

module.exports = { client, ready, get, all, run, batch };
