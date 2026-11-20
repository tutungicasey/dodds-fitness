// End-to-end smoke test + screenshots:  BASE_URL=http://localhost:3100 node scripts/e2e.mjs
import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };

async function login(page, email, pw) {
  await page.goto(BASE + '/login');
  await page.fill('#email', email); await page.fill('#password', pw);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login')), page.click('button:has-text("Log in")')]);
}
const flash = async (page) => (await page.locator('.flash').allInnerTexts()).join(' | ');

// ---- Member flow (desktop) ----
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await login(page, 'member@doddsfitness.demo', 'DemoMember!2026');
ok('member sign-in lands on dashboard', page.url().includes('/dashboard'), page.url());
const cookies = await ctx.cookies();
const sc = cookies.find((c) => c.name === 'df_session');
ok('session cookie HttpOnly+SameSite', sc?.httpOnly && sc?.sameSite === 'Lax', JSON.stringify({ httpOnly: sc?.httpOnly, sameSite: sc?.sameSite, secure: sc?.secure }));

await page.goto(BASE + '/timetable?view=list&w=1');
const bookBtn = page.locator('button:has-text("Book")').first();
await bookBtn.click(); await page.waitForLoadState('networkidle');
ok('book a class', (await flash(page)).includes('Booked'), await flash(page));
await page.goto(BASE + '/timetable?view=list&w=0');
let wl = page.locator('button:has-text("Join waitlist")').first();
if (!(await wl.count())) { await page.goto(BASE + '/timetable?view=list&w=1'); wl = page.locator('button:has-text("Join waitlist")').first(); }
ok('a full class offers waitlist', (await wl.count()) > 0);
if (await wl.count()) {
  await wl.click(); await page.waitForLoadState('networkidle');
  ok('join waitlist when full', (await flash(page)).includes('waitlist'), await flash(page));
  await page.locator('button:has-text("Leave waitlist")').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll('.flash')].some((f) => f.innerText.includes('cancelled')), null, { timeout: 8000 }).catch(() => {});
  ok('leave waitlist', (await flash(page)).includes('cancelled'), await flash(page));
}
// CSRF: tamper with the hidden token, the server must reject the action
await page.goto(BASE + '/diary?tab=notes');
await page.evaluate(() => document.querySelectorAll('input[name=csrf]').forEach((i) => (i.value = 'x'.repeat(i.value.length))));
await page.fill('textarea[name=body]', 'should be rejected');
await page.click('button:has-text("Save note")'); await page.waitForLoadState('networkidle');
ok('CSRF token tampering rejected', (await flash(page)).includes('CSRF') && !(await page.content()).includes('should be rejected</li>'), await flash(page));
await page.goto(BASE + '/bookings');
ok('booking appears in My bookings', (await page.locator('.pill.booked').count()) > 0);

await page.goto(BASE + '/diary?tab=workouts');
await page.fill('input[name=title]', 'E2E test workout');
await page.fill('input[name=exercise_0]', 'Deadlift'); await page.fill('input[name=sets_0]', '3'); await page.fill('input[name=reps_0]', '5'); await page.fill('input[name=weight_0]', '100');
await page.click('button:has-text("Save workout")'); await page.waitForLoadState('networkidle');
ok('diary workout entry', (await flash(page)).includes('Workout saved') && (await page.content()).includes('E2E test workout'), await flash(page));
await page.goto(BASE + '/diary?tab=food');
await page.fill('input[name=description]', 'E2E banana'); await page.fill('input[name=calories]', '105');
await page.click('button:has-text("Save food")'); await page.waitForLoadState('networkidle');
ok('diary food entry', (await flash(page)).includes('Food entry saved'), await flash(page));

await page.goto(BASE + '/diary?tab=measurements');
ok('no body-weight field in measurements form', (await page.locator('input[name=weight]').count()) === 0);
await page.fill('input[name=waist]', '84.5'); await page.fill('input[name=bf]', '20.1');
await page.click('button:has-text("Save measurements")'); await page.waitForLoadState('networkidle');
ok('measurement entry (no weight)', (await flash(page)).includes('Measurements saved'), await flash(page));
const noWeight = async (path) => { await page.goto(BASE + path); const t = (await page.locator('main').innerText()).toLowerCase(); return !/body weight|latest weight|weight trend|weight kg/.test(t); };
ok('no body weight on dashboard', await noWeight('/dashboard'));
ok('no body weight on diary progress', await noWeight('/diary'));
ok('kg lifted still shown in workouts', (await (async () => { await page.goto(BASE + '/diary?tab=workouts'); return (await page.locator('main').innerText()).includes('@ 100 kg'); })()));
await page.goto(BASE + '/membership');
await page.locator('.plan', { hasText: 'Casual Class' }).locator('button').click();
await page.waitForURL(/\/checkout\/demo\//);
ok('demo checkout page clearly labelled', (await page.content()).includes('Demo payment'));
await page.click('button:has-text("Complete demo payment")'); await page.waitForURL(/\/membership/);
ok('mock payment completes', (await flash(page)).includes('DEMO payment complete'), await flash(page));

// Access control: member cannot open admin/trainer pages or other clients
await page.goto(BASE + '/admin');
ok('member blocked from /admin', page.url().includes('/dashboard'), page.url());
await page.goto(BASE + '/trainer/clients/5');
ok('member blocked from client records', !page.url().includes('/trainer/clients'), page.url());
// CSRF: post a server action with a bad token via fetch should not succeed -> check by forging a form
const exportRes = await page.request.get(BASE + '/api/me/export');
const exp = await exportRes.json();
ok('data export returns only own data', exp.profile.email === 'member@doddsfitness.demo' && !JSON.stringify(exp).includes('example.demo'));
ok('export has no body weight', exp.measurements.every((m) => !('weight_kg' in m)) && exp.workouts.some((w) => w.sets.some((x) => x.weight_kg)));

await page.goto(BASE + '/timetable?view=calendar');
await page.screenshot({ path: 'screenshots/02-timetable-calendar.png', fullPage: false });
await ctx.close();

// ---- Mobile member screenshots ----
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await login(mp, 'member@doddsfitness.demo', 'DemoMember!2026');
await mp.screenshot({ path: 'screenshots/03-member-dashboard-mobile.png', fullPage: false });
await mp.goto(BASE + '/diary');
await mp.screenshot({ path: 'screenshots/04-diary-progress-mobile.png', fullPage: false });
await m.close();

// ---- Admin ----
const a = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
const ap = await a.newPage();
await login(ap, 'admin@doddsfitness.demo', 'DemoAdmin!2026');
ok('admin lands on admin dashboard', ap.url().includes('/admin'), ap.url());
const html = await ap.content();
ok('admin dashboard shows popular classes chart', html.includes('Most popular classes') && html.includes('Busiest times') && html.includes('HIIT'));
await ap.screenshot({ path: 'screenshots/01-admin-dashboard.png', fullPage: true });
await ap.goto(BASE + '/trainer/clients/3');
ok('no body weight in trainer client view', !/body weight|weight kg/.test((await ap.locator('main').innerText()).toLowerCase()));
await ap.goto(BASE + '/admin/audit');
ok('audit log records staff login', (await ap.content()).includes('staff.login'));
await a.close();

// ---- Login rate limiting ----
const r = await browser.newContext();
const rp = await r.newPage();
let limited = false;
for (let i = 0; i < 7; i++) {
  await rp.goto(BASE + '/login');
  await rp.fill('#email', 'ratelimit-test@example.demo'); await rp.fill('#password', 'wrong-password-1');
  await rp.click('button:has-text("Log in")'); await rp.waitForLoadState('networkidle');
  if ((await flash(rp)).includes('Too many')) { limited = true; break; }
}
ok('login rate limiting kicks in', limited);
await r.close();
await browser.close();

for (const [s, n, e] of results) console.log(`${s}  ${n}${e && s === 'FAIL' ? '  -> ' + e : ''}`);
process.exit(results.some((x) => x[0] === 'FAIL') ? 1 : 0);
