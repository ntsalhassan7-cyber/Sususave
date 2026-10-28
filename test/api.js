/* API smoke test: an admin starts a group, two members join, cash gets recorded. */
const app = require('../src/server.js');
const srv = app.listen(0);
const base = 'http://127.0.0.1:' + srv.address().port;
const jars = {};
async function call(as, method, path, body) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: jars[as] || '' }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) jars[as] = sc.map((c) => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({}));
  return { s: r.status, j };
}
function ok(c, m) { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok ', m); }
(async () => {
  let r = await call('a', 'POST', '/api/admin/signup', { username: 'boss', password: 'longpass1', groupName: 'Test Susu' });
  ok(r.s === 200 && r.j.me.role === 'admin' && r.j.group.code.length === 6, 'admin signup ' + (r.j.group && r.j.group.code));
  const code = r.j.group.code;
  r = await call('m1', 'POST', '/api/member/signup', { code, fullName: 'Ama Mensah', username: 'ama', password: 'secret1', avatar: 2 });
  ok(r.s === 409, 'join before setup refused: ' + r.j.error);
  r = await call('a', 'PUT', '/api/settings', { name: 'Test Susu', n: 3, base: 50, every: 1, unit: 'weeks', start: '2026-10-01', cycles: 1, fee: 0, self: true });
  ok(r.s === 200 && r.j.group.settings.n === 3, 'settings saved');
  r = await call('m1', 'POST', '/api/member/signup', { code, fullName: 'Ama Mensah', username: 'ama', password: 'secret1', avatar: 2 });
  ok(r.s === 200 && r.j.me.role === 'member', 'member 1 joined');
  r = await call('m2', 'POST', '/api/member/signup', { code, fullName: 'Kofi Boateng', username: 'kofi', password: 'secret2', avatar: 5 });
  ok(r.s === 200, 'member 2 joined');
  r = await call('m2', 'POST', '/api/member/signup', { code, fullName: 'Dup', username: 'kofi', password: 'secret2', avatar: 5 });
  ok(r.s === 409, 'duplicate username refused');
  r = await call('m1', 'POST', '/api/member/login', { code, username: 'ama', password: 'wrong' });
  ok(r.s === 401, 'wrong password refused');
  r = await call('m1', 'POST', '/api/member/login', { code: code.toLowerCase(), username: 'AMA', password: 'secret1' });
  ok(r.s === 200, 'member login');
  r = await call('m2', 'POST', '/api/payments/cash', { r: 0, uid: r.j.me.uid, on: true });
  ok(r.s === 403, 'non-collector cannot record cash: ' + r.j.error);
  r = await call('a', 'POST', '/api/payments/cash', { r: 0, uid: '2', on: true });
  ok(r.s === 200 && r.j.payments['0_2'] && r.j.payments['0_2'].status === 'paid', 'admin recorded cash for member 2 round 0');
  r = await call('m1', 'POST', '/api/payments/cash', { r: 0, uid: '1', on: true });
  ok(r.s === 200 && r.j.payments['0_1'], 'collector (member 1) recorded own cash for round 0');
  r = await call('m1', 'POST', '/api/payouts/cash', { r: 0 });
  ok(r.s === 200 && r.j.payouts['0'] && r.j.payouts['0'].status === 'paid', 'collector confirmed receiving round 0');
  r = await call('a', 'POST', '/api/payments/all', { r: 1, on: true });
  ok(r.s === 200 && Object.keys(r.j.payments).length === 4, 'mark all round 1: ' + Object.keys(r.j.payments).join(','));
  r = await call('a', 'DELETE', '/api/members/1');
  ok(r.s === 409, 'cannot remove member with payments');
  r = await call('m1', 'POST', '/api/payments/momo/start', { r: 2 });
  ok(r.s === 503, 'momo off without key: ' + r.j.error);
  r = await call('m1', 'PUT', '/api/me', { phone: '0241234567', provider: 'mtn' });
  ok(r.s === 200 && r.j.me.phone === '0241234567', 'saved momo number');
  r = await call('a', 'GET', '/api/state');
  ok(r.s === 200 && r.j.members.length === 2 && r.j.members[0].phone === '0241234567', 'admin state has members');
  r = await call('x', 'GET', '/api/state');
  ok(r.s === 200 && r.j.me === null, 'no session -> me null');
  r = await call('a', 'POST', '/api/logout');
  r = await call('a', 'GET', '/api/state');
  ok(r.s === 200 && r.j.me === null, 'logout clears session');
  r = await call('x', 'POST', '/api/paystack/webhook', { event: 'charge.success', data: {} });
  ok(r.s === 401, 'webhook without signature refused');
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
