/* End to end in a real browser: admin creates a group, two members join, cash is recorded. */
const { chromium } = require('playwright');
const path = require('path');
process.env.SESSION_SECRET = 'test';
const app = require('../src/server.js');
const srv = app.listen(0);
const base = 'http://127.0.0.1:' + srv.address().port;
const OUT = path.join(__dirname, '..', 'tmp');
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.error('FAIL', m); } else console.log('ok ', m); }
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }); }
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function ctx(w) { const c = await browser.newContext({ viewport: { width: w || 1360, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); return p; }

  /* admin creates the group */
  const a = await ctx();
  await a.goto(base + '/');
  await a.click('#tab-admin');
  await a.click('[data-act="to-create"]');
  await a.fill('#cr-group', 'Market Women Susu');
  await a.fill('#cr-user', 'boss');
  await a.fill('#cr-pw', 'longpass1');
  await a.fill('#cr-pw2', 'longpass1');
  await shot(a, 'login-create');
  await a.click('#cr-btn');
  await a.waitForURL(/#admin/);
  await a.waitForSelector('#setup:visible');
  ok(true, 'admin landed on group setup: ' + a.url());
  await a.fill('#group', 'Market Women Susu');
  await a.fill('#base', '50');
  const start = new Date(); start.setDate(start.getDate() - 7);
  await a.fill('#start', start.toISOString().slice(0, 10));
  await a.click('#n-minus');
  await a.click('#save');
  await a.waitForFunction(() => /Saved/.test(document.getElementById('save-status').textContent));
  const status = await a.textContent('#save-status');
  ok(/code [A-Z0-9]{6}/.test(status), 'saved with join code: ' + status);
  const code = status.match(/code ([A-Z0-9]{6})/)[1];
  await a.goto(base + '/#admin-people');
  await a.waitForSelector('#join-code');
  ok((await a.textContent('#join-code')) === code, 'join code shown on people page');
  await shot(a, 'admin-people-empty');

  /* two members join */
  async function join(name, user, pw, avatar) {
    const p = await ctx(1000);
    await p.goto(base + '/');
    await p.click('[data-act="to-signup"]');
    await p.fill('#su-code', code.toLowerCase());
    await p.waitForFunction(() => /Found/.test(document.getElementById('su-code-hint').textContent));
    await p.click('#su-btn');
    await p.fill('#su-name', name); await p.click('#su-btn');
    await p.fill('#su-user', user);
    await p.waitForFunction(() => /free/.test(document.getElementById('su-user-hint').textContent));
    await p.click('#su-btn');
    await p.fill('#su-pw', pw); await p.click('#su-btn');
    await p.check('input[name=avatar][value="' + avatar + '"]', { force: true });
    if (user === 'ama') await shot(p, 'login-join');
    await p.click('#su-btn');
    await p.waitForURL(/#home/);
    await p.waitForSelector('.card.hero');
    return p;
  }
  const m1 = await join('Ama Mensah', 'ama', 'secret1', 2);
  ok(/Good (morning|afternoon|evening), Ama/.test(await m1.textContent('#us-greet')), 'member 1 home greets by name');
  await shot(m1, 'user-home');
  const m2 = await join('Kofi Boateng', 'kofi', 'secret2', 5);

  /* admin records cash for round 0 */
  await a.goto(base + '/#admin-payments');
  await a.waitForSelector('.tile[data-act="paid"]');
  const tiles = await a.$$('.tile[data-act="paid"]');
  ok(tiles.length === 2, 'two member tiles in round 0');
  await tiles[1].click();
  await a.waitForFunction(() => document.querySelectorAll('.tile[aria-pressed="true"]').length === 1);
  ok(true, 'admin marked Kofi paid (cash)');
  await a.click('[data-act="all"]');
  await a.waitForFunction(() => document.querySelectorAll('.tile[aria-pressed="true"]').length === 2);
  ok(true, 'mark everyone paid');
  await a.click('[data-act="out"]');
  await a.waitForFunction(() => /received/i.test(document.querySelector('[data-act="out"]').textContent));
  ok(true, 'admin marked cash handed to collector');
  await shot(a, 'admin-payments');
  await a.goto(base + '/#admin-schedule'); await a.waitForSelector('#ad-sched-root .card'); await shot(a, 'admin-schedule');

  /* member sees it within a poll */
  await m1.goto(base + '/#payments');
  await m1.waitForFunction(() => /Paid/.test(document.querySelector('#us-pay-root').textContent), null, { timeout: 15000 });
  ok(true, 'member 1 sees payments');
  await m1.fill('#momo-phone', '0241234567');
  await m1.click('#momo-save');
  await m1.waitForFunction(() => /Saved\./.test(document.getElementById('momo-status').textContent));
  ok(true, 'member saved MoMo number');
  await shot(m1, 'user-payments');
  await m1.goto(base + '/#schedule'); await m1.waitForSelector('#us-sched-root .card'); await shot(m1, 'user-schedule');

  /* route guard: member cannot open admin; signed-out goes to login */
  await m2.goto(base + '/#admin-payments');
  await m2.waitForURL(/#home/);
  ok(true, 'member sent away from #admin');
  await m2.click('[data-act="signout"]');
  await m2.waitForSelector('#f-signin:visible');
  await m2.goto(base + '/#home');
  await m2.waitForSelector('#f-signin:visible');
  ok(true, 'signed-out member sees login for #home');
  await m2.fill('#si-code', code); await m2.fill('#si-user', 'kofi'); await m2.fill('#si-pw', 'secret2'); await m2.click('#si-btn');
  await m2.waitForURL(/#home/);
  ok(true, 'member sign in works');
  await a.goto(base + '/#home');
  await a.waitForURL(/#admin/);
  ok(true, 'admin sent to admin app from #home');
  const a2 = await ctx(400);
  await a2.goto(base + '/#admin-payments');
  await a2.waitForSelector('#f-signin:visible, #f-admin:visible');
  await shot(a2, 'login-mobile');

  ok(errors.length === 0, 'no browser errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); srv.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
