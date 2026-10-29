/* Susu server: accounts, groups, the schedule and cash records.
   Runs as a normal Node server (node src/server.js) and as a Vercel function (api/index.js). */
'use strict';
require('./env');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const db = require('./db');
const L = require('../public/shared/logic.js');

const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const SESSION_SECRET = process.env.SESSION_SECRET || (PROD ? '' : 'dev-only-secret-change-me');
if (!SESSION_SECRET) throw new Error('Set SESSION_SECRET (any long random string) before starting in production.');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '64kb' }));
app.use(cookieSession({
  name: 'susu',
  keys: [SESSION_SECRET],
  maxAge: 30 * 24 * 3600 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: PROD
}));

/* ---------- helpers ---------- */
const now = () => Date.now();
const today = () => L.iso(new Date());
const bad = (res, status, msg) => res.status(status).json({ error: msg });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function log(gid, who, what, detail) {
  return db.run('INSERT INTO audit(group_id,who,what,detail,at) VALUES (?,?,?,?,?)', [gid, who, what, detail ? JSON.stringify(detail) : '', now()]);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!(await db.get('SELECT 1 FROM groups WHERE code=?', [c]))) return c;
  }
}
const normCode = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const normUser = (u) => L.normUser(u);

/* A few failed logins in a row from one address slow the next attempts down. */
const tries = new Map();
function throttle(req, res, next) {
  const t = tries.get(req.ip);
  if (t && t.until > now()) return bad(res, 429, 'Too many attempts. Wait a minute and try again.');
  next();
}
function failed(req) {
  const t = tries.get(req.ip) || { n: 0, until: 0 };
  t.n++; if (t.n >= 8) { t.until = now() + 60000; t.n = 0; }
  tries.set(req.ip, t);
}
function clear(req) { tries.delete(req.ip); }

/* Group settings in the shape the apps use. */
function settingsOf(g) {
  return {
    name: g.name, desc: g.desc, cur: g.cur, base: g.base, every: g.every, unit: g.unit, start: g.start,
    cycles: g.cycles, n: g.n, fee: g.fee, self: !!g.self, open: !!g.open
  };
}
function memberOut(m) {
  return { uid: String(m.id), fullName: m.full_name, username: m.username, avatar: m.avatar, joinedAt: m.joined_at, slot: m.slot === undefined ? null : m.slot };
}
async function ctx(gid) {
  const g = await db.get('SELECT * FROM groups WHERE id=?', [gid]);
  if (!g) return null;
  const members = (await db.all('SELECT * FROM members WHERE group_id=? ORDER BY joined_at, id', [gid])).map(memberOut);
  const st = g.setup ? settingsOf(g) : null;
  const sched = st ? L.buildSchedule(L.toSched(st)) : [];
  const slots = st ? L.rosterSlots(members, st.n).slots : [];
  return { g, st, members, sched, slots };
}
function slotOf(c, uid) { return c.slots.findIndex((m) => m && m.uid === String(uid)); }
const countMembers = async (gid) => (await db.get('SELECT COUNT(*) AS n FROM members WHERE group_id=?', [gid])).n;

/* ---------- auth guards ---------- */
async function who(req) {
  const s = req.session || {};
  if (s.role === 'admin' && s.id) {
    const a = await db.get('SELECT * FROM admins WHERE id=?', [s.id]);
    if (a) return { role: 'admin', id: a.id, gid: a.group_id, name: a.username };
  }
  if (s.role === 'member' && s.id) {
    const m = await db.get('SELECT * FROM members WHERE id=?', [s.id]);
    if (m) return { role: 'member', id: m.id, gid: m.group_id, name: m.full_name };
  }
  return null;
}
const signedIn = wrap(async (req, res, next) => {
  const u = await who(req);
  if (!u) { req.session = null; return bad(res, 401, 'Please sign in.'); }
  req.me = u; next();
});
const adminOnly = [signedIn, (req, res, next) => (req.me.role === 'admin' ? next() : bad(res, 403, 'Only the admin can do that.'))];

/* ---------- the state the apps render from ---------- */
async function stateFor(me) {
  const c = await ctx(me.gid);
  const pays = {}, outs = {};
  (await db.all('SELECT * FROM payments WHERE group_id=?', [me.gid])).forEach((p) => {
    pays[p.round + '_' + p.member_id] = { r: p.round, uid: String(p.member_id), status: p.status,
      amount: p.amount, at: p.paid_at || p.created_at, by: p.recorded_by };
  });
  (await db.all('SELECT * FROM payouts WHERE group_id=?', [me.gid])).forEach((o) => {
    outs[o.round] = { r: o.round, uid: String(o.member_id), status: o.status, amount: o.amount,
      at: o.paid_at || o.created_at, by: o.recorded_by };
  });
  return {
    me: { role: me.role, uid: String(me.id), name: me.name },
    group: { code: c.g.code, settings: c.st },
    members: c.members,
    payments: pays,
    payouts: outs,
    today: today()
  };
}
const sendState = async (req, res) => res.json(await stateFor(req.me || await who(req)));
/* Not signed in is a normal answer here, not an error, so the page can show the login door. */
app.get('/api/state', wrap(async (req, res) => { const me = await who(req); if (!me) { req.session = null; return res.json({ me: null }); } res.json(await stateFor(me)); }));
app.get('/api/health', wrap(async (req, res) => { await db.ready(); res.json({ ok: true }); }));

/* ---------- accounts ---------- */
const PW_MIN = 6, ADMIN_PW_MIN = 8;

/* Starting a new group makes its admin account and a join code for members. */
app.post('/api/admin/signup', throttle, wrap(async (req, res) => {
  const u = normUser(req.body.username), pw = String(req.body.password || ''), name = String(req.body.groupName || '').trim().slice(0, 60);
  if (!L.validUser(u)) return bad(res, 400, 'Use 3 to 20 letters, numbers, dots, dashes or underscores for the username.');
  if (pw.length < ADMIN_PW_MIN) return bad(res, 400, 'The admin password needs at least ' + ADMIN_PW_MIN + ' characters.');
  if (await db.get('SELECT 1 FROM admins WHERE username=?', [u])) return bad(res, 409, 'That admin username is taken. Choose another.');
  const hash = await bcrypt.hash(pw, 10), t = now();
  const gid = (await db.run('INSERT INTO groups(code,name,start,created_at) VALUES (?,?,?,?)', [await newCode(), name, today(), t])).id;
  const aid = (await db.run('INSERT INTO admins(group_id,username,pw_hash,created_at) VALUES (?,?,?,?)', [gid, u, hash, t])).id;
  req.session = { role: 'admin', id: aid };
  await log(gid, 'admin:' + u, 'group.create', { name });
  await sendState(req, res);
}));
app.post('/api/admin/login', throttle, wrap(async (req, res) => {
  const u = normUser(req.body.username), pw = String(req.body.password || '');
  const a = await db.get('SELECT * FROM admins WHERE username=?', [u]);
  if (!a || !(await bcrypt.compare(pw, a.pw_hash))) { failed(req); return bad(res, 401, !a ? 'That is not an admin username.' : 'That password is not right.'); }
  clear(req);
  req.session = { role: 'admin', id: a.id };
  await sendState(req, res);
}));

/* Members need the group's join code. */
app.get('/api/group/:code', wrap(async (req, res) => {
  const g = await db.get('SELECT * FROM groups WHERE code=?', [normCode(req.params.code)]);
  if (!g) return bad(res, 404, 'We cannot find a group with that code. Check it with your admin.');
  const count = await countMembers(g.id);
  res.json({ code: g.code, name: g.name, desc: g.desc, ready: !!g.setup, open: !!g.open && !!g.setup, n: g.n, joined: count, full: g.setup ? count >= g.n : false });
}));
app.get('/api/group/:code/username/:u', wrap(async (req, res) => {
  const g = await db.get('SELECT id FROM groups WHERE code=?', [normCode(req.params.code)]);
  if (!g) return bad(res, 404, 'No such group.');
  const taken = !!(await db.get('SELECT 1 FROM members WHERE group_id=? AND username=?', [g.id, normUser(req.params.u)]));
  res.json({ taken });
}));
app.post('/api/member/signup', throttle, wrap(async (req, res) => {
  const code = normCode(req.body.code), u = normUser(req.body.username), pw = String(req.body.password || '');
  const full = String(req.body.fullName || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const avatar = Math.min(19, Math.max(0, Math.round(Number(req.body.avatar)) || 0));
  const g = await db.get('SELECT * FROM groups WHERE code=?', [code]);
  if (!g) return bad(res, 404, 'We cannot find a group with that code.');
  if (!g.setup) return bad(res, 409, 'The admin has not finished setting up the group yet.');
  if (!g.open) return bad(res, 409, 'Sign-ups are closed. Ask the admin to open them again.');
  if (full.length < 2) return bad(res, 400, 'Type your full name.');
  if (!L.validUser(u)) return bad(res, 400, 'Choose a username with 3 to 20 letters or numbers.');
  if (pw.length < PW_MIN) return bad(res, 400, 'Your password needs at least ' + PW_MIN + ' characters.');
  if ((await countMembers(g.id)) >= g.n) return bad(res, 409, 'This group is full. All ' + g.n + ' places are taken.');
  if (await db.get('SELECT 1 FROM members WHERE group_id=? AND username=?', [g.id, u])) return bad(res, 409, 'That username is taken in this group. Try another.');
  const hash = await bcrypt.hash(pw, 10);
  const drawn = (await db.get('SELECT MAX(slot) AS m FROM members WHERE group_id=?', [g.id])).m;
  const slot = drawn === null || drawn === undefined ? null : drawn + 1;
  const id = (await db.run('INSERT INTO members(group_id,full_name,username,pw_hash,avatar,joined_at,slot) VALUES (?,?,?,?,?,?,?)', [g.id, full, u, hash, avatar, now(), slot])).id;
  req.session = { role: 'member', id };
  await log(g.id, 'member:' + u, 'member.join', { full });
  await sendState(req, res);
}));
app.post('/api/member/login', throttle, wrap(async (req, res) => {
  const code = normCode(req.body.code), u = normUser(req.body.username), pw = String(req.body.password || '');
  const g = await db.get('SELECT id FROM groups WHERE code=?', [code]);
  if (!g) { failed(req); return bad(res, 404, 'We cannot find a group with that code.'); }
  const m = await db.get('SELECT * FROM members WHERE group_id=? AND username=?', [g.id, u]);
  if (!m || !(await bcrypt.compare(pw, m.pw_hash))) { failed(req); return bad(res, 401, !m ? 'We cannot find that username in this group.' : 'That password is not right.'); }
  clear(req);
  req.session = { role: 'member', id: m.id };
  await sendState(req, res);
}));
app.post('/api/logout', (req, res) => { req.session = null; res.json({ ok: true }); });

app.put('/api/me/password', signedIn, wrap(async (req, res) => {
  const cur = String(req.body.current || ''), pw = String(req.body.password || '');
  const table = req.me.role === 'admin' ? 'admins' : 'members', min = req.me.role === 'admin' ? ADMIN_PW_MIN : PW_MIN;
  const row = await db.get('SELECT pw_hash FROM ' + table + ' WHERE id=?', [req.me.id]);
  if (!(await bcrypt.compare(cur, row.pw_hash))) return bad(res, 401, 'Your current password is not right.');
  if (pw.length < min) return bad(res, 400, 'The new password needs at least ' + min + ' characters.');
  await db.run('UPDATE ' + table + ' SET pw_hash=? WHERE id=?', [await bcrypt.hash(pw, 10), req.me.id]);
  res.json({ ok: true });
}));
/* The admin can set a new password for a member who forgot theirs. */
app.post('/api/members/:id/password', adminOnly, wrap(async (req, res) => {
  const m = await db.get('SELECT * FROM members WHERE id=? AND group_id=?', [Number(req.params.id), req.me.gid]);
  if (!m) return bad(res, 404, 'No such member.');
  const pw = String(req.body.password || '');
  if (pw.length < PW_MIN) return bad(res, 400, 'The new password needs at least ' + PW_MIN + ' characters.');
  await db.run('UPDATE members SET pw_hash=? WHERE id=?', [await bcrypt.hash(pw, 10), m.id]);
  await log(req.me.gid, 'admin:' + req.me.name, 'member.password_reset', { member: m.username });
  res.json({ ok: true });
}));

/* ---------- group settings (admin) ---------- */
app.put('/api/settings', adminOnly, wrap(async (req, res) => {
  const s = L.cleanSettings(req.body, today());
  const count = await countMembers(req.me.gid);
  if (count > s.n) return bad(res, 400, count + ' people have already joined, so the group cannot be smaller than that.');
  await db.run('UPDATE groups SET name=?,desc=?,cur=?,base=?,every=?,unit=?,start=?,cycles=?,n=?,fee=?,self=?,setup=1 WHERE id=?',
    [s.name, s.desc, s.cur, s.base, s.every, s.unit, s.start, s.cycles, s.n, s.fee, s.self ? 1 : 0, req.me.gid]);
  await log(req.me.gid, 'admin:' + req.me.name, 'settings.save', s);
  await sendState(req, res);
}));
app.post('/api/settings/open', adminOnly, wrap(async (req, res) => {
  const g = await db.get('SELECT open FROM groups WHERE id=?', [req.me.gid]);
  await db.run('UPDATE groups SET open=? WHERE id=?', [g.open ? 0 : 1, req.me.gid]);
  await sendState(req, res);
}));
/* Sign-in links: the admin sends a member their own link (WhatsApp, SMS). Tapping it signs
   them in on that phone, so nobody has to type a code, username or password. */
function siteUrl(req) { return req.protocol + '://' + req.get('host'); }
app.get('/api/members/:id/link', adminOnly, wrap(async (req, res) => {
  const m = await db.get('SELECT * FROM members WHERE id=? AND group_id=?', [Number(req.params.id), req.me.gid]);
  if (!m) return bad(res, 404, 'No such member.');
  let token = m.link_token;
  if (!token || req.query.reset === '1') {
    token = crypto.randomBytes(15).toString('base64url');
    await db.run('UPDATE members SET link_token=? WHERE id=?', [token, m.id]);
    await log(req.me.gid, 'admin:' + req.me.name, 'member.link', { member: m.username, reset: req.query.reset === '1' });
  }
  res.json({ url: siteUrl(req) + '/s/' + token, name: m.full_name });
}));
app.get('/s/:token', wrap(async (req, res) => {
  const t = String(req.params.token || '');
  const m = t.length >= 16 ? await db.get('SELECT id FROM members WHERE link_token=?', [t]) : null;
  if (!m) return res.redirect('/#login?bad-link');
  req.session = { role: 'member', id: m.id };
  res.redirect('/#home');
}));

/* Draw a random collection order. Allowed until the first pot has been handed over. */
app.post('/api/members/shuffle', adminOnly, wrap(async (req, res) => {
  const paidOut = (await db.get("SELECT COUNT(*) AS n FROM payouts WHERE group_id=? AND status='paid'", [req.me.gid])).n;
  if (paidOut) return bad(res, 409, 'A pot has already been handed over, so the order is fixed now.');
  const ids = (await db.all('SELECT id FROM members WHERE group_id=?', [req.me.gid])).map((m) => m.id);
  if (ids.length < 2) return bad(res, 409, 'At least two people need to have joined before you can shuffle.');
  for (let i = ids.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  await db.batch(ids.map((id, i) => ['UPDATE members SET slot=? WHERE id=?', [i, id]]));
  await log(req.me.gid, 'admin:' + req.me.name, 'members.shuffle', { order: ids });
  await sendState(req, res);
}));
app.delete('/api/members/:id', adminOnly, wrap(async (req, res) => {
  const m = await db.get('SELECT * FROM members WHERE id=? AND group_id=?', [Number(req.params.id), req.me.gid]);
  if (!m) return bad(res, 404, 'No such member.');
  const paid = (await db.get("SELECT COUNT(*) AS n FROM payments WHERE member_id=? AND status='paid'", [m.id])).n;
  if (paid) return bad(res, 409, m.full_name + ' has payments recorded, so they cannot be removed.');
  await db.run('DELETE FROM members WHERE id=?', [m.id]);
  await log(req.me.gid, 'admin:' + req.me.name, 'member.remove', { member: m.username });
  await sendState(req, res);
}));

/* ---------- who may record a round ----------
   The admin can record anything. The member who collects a round can record cash
   handed to them for that round and confirm that they received the pot. */
function roundFor(c, r) { return (c && c.sched[Number(r)]) || null; }
function mayRecord(me, c, rd) {
  if (me.role === 'admin') return true;
  const i = slotOf(c, me.id);
  return i >= 0 && rd.member === i;
}

/* ---------- cash ---------- */
const getPay = (gid, r, uid) => db.get('SELECT * FROM payments WHERE group_id=? AND round=? AND member_id=?', [gid, r, Number(uid)]);
const INS_PAY = 'INSERT INTO payments(group_id,round,member_id,method,status,amount,recorded_by,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?)';
async function recordCash(me, c, rd, uid, on) {
  const i = slotOf(c, uid);
  if (i < 0 || rd.contributors.indexOf(i) < 0) return 'That person does not pay in this round.';
  const cur = await getPay(c.g.id, rd.r, uid);
  if (on) {
    if (cur && cur.status === 'paid') return '';
    if (cur) await db.run('DELETE FROM payments WHERE id=?', [cur.id]);
    await db.run(INS_PAY, [c.g.id, rd.r, Number(uid), 'cash', 'paid', c.st.base, me.role + ':' + me.name, now(), now()]);
  } else {
    if (!cur) return '';
    await db.run('DELETE FROM payments WHERE id=?', [cur.id]);
  }
  return '';
}
app.post('/api/payments/cash', signedIn, wrap(async (req, res) => {
  const c = await ctx(req.me.gid), rd = c.st && roundFor(c, req.body.r);
  if (!rd) return bad(res, 400, 'No such round.');
  if (!mayRecord(req.me, c, rd)) return bad(res, 403, 'Only the admin or this round’s collector can record cash for it.');
  const on = req.body.on !== false;
  const err = await recordCash(req.me, c, rd, String(req.body.uid), on);
  if (err) return bad(res, 409, err);
  await log(c.g.id, req.me.role + ':' + req.me.name, on ? 'cash.paid' : 'cash.unpaid', { r: rd.r, uid: req.body.uid });
  await sendState(req, res);
}));
app.post('/api/payments/all', signedIn, wrap(async (req, res) => {
  const c = await ctx(req.me.gid), rd = c.st && roundFor(c, req.body.r);
  if (!rd) return bad(res, 400, 'No such round.');
  if (!mayRecord(req.me, c, rd)) return bad(res, 403, 'Only the admin or this round’s collector can record cash for it.');
  const on = req.body.on !== false;
  for (const i of rd.contributors) { const m = c.slots[i]; if (m) await recordCash(req.me, c, rd, m.uid, on); }
  await log(c.g.id, req.me.role + ':' + req.me.name, on ? 'cash.all_paid' : 'cash.all_cleared', { r: rd.r });
  await sendState(req, res);
}));

const getOut = (gid, r) => db.get('SELECT * FROM payouts WHERE group_id=? AND round=?', [gid, r]);
app.post('/api/payouts/cash', signedIn, wrap(async (req, res) => {
  const c = await ctx(req.me.gid), rd = c.st && roundFor(c, req.body.r);
  if (!rd) return bad(res, 400, 'No such round.');
  if (!mayRecord(req.me, c, rd)) return bad(res, 403, 'Only the admin or the collector can confirm the money was received.');
  const col = c.slots[rd.member];
  if (!col) return bad(res, 409, 'Nobody has taken that place yet.');
  const cur = await getOut(c.g.id, rd.r), on = req.body.on !== false;
  if (on) {
    if (cur && cur.status === 'paid') return sendState(req, res);
    if (cur) await db.run('DELETE FROM payouts WHERE id=?', [cur.id]);
    await db.run('INSERT INTO payouts(group_id,round,member_id,method,status,amount,recorded_by,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [c.g.id, rd.r, Number(col.uid), 'cash', 'paid', rd.net, req.me.role + ':' + req.me.name, now(), now()]);
  } else if (cur) {
    await db.run('DELETE FROM payouts WHERE id=?', [cur.id]);
  }
  await log(c.g.id, req.me.role + ':' + req.me.name, on ? 'payout.cash' : 'payout.cleared', { r: rd.r });
  await sendState(req, res);
}));

/* ---------- the apps ---------- */
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', extensions: ['html'] }));
app.use('/api', (req, res) => bad(res, 404, 'No such call.'));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return bad(res, 400, 'Bad request.');
  console.error(err);
  bad(res, 500, 'Something went wrong on the server.');
});

if (require.main === module) {
  app.listen(PORT, () => console.log('Susu listening on http://localhost:' + PORT + ''));
}
module.exports = app;
