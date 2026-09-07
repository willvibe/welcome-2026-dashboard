import assert from 'node:assert/strict';
import 'dotenv/config';
const base = process.argv[2] || 'http://127.0.0.1:3000';
const home = await fetch(base + '/');
assert.equal(home.status, 200);
assert.match(await home.text(), /2026/);
const admin = await fetch(base + '/admin');
assert.equal(admin.status, 200);
const health = await fetch(base + '/api/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).database, 'mysql');
const before = await (await fetch(base + '/api/stats')).json();
assert.equal(before.total, 450);
const login = await fetch(base + '/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({
    username: process.env.ADMIN_USER,
    password: process.env.ADMIN_PASSWORD,
  }),
});
assert.equal(login.status, 200, await login.clone().text());
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie);
const students = await fetch(base + '/api/students', {
  headers: { Cookie: cookie },
});
assert.equal(students.status, 200);
assert.equal((await students.json()).total, 450);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
const events = await fetch(base + '/api/events', { signal: controller.signal });
assert.equal(events.status, 200);
const reader = events.body.getReader();
let stream = '';
try {
  while (!stream.includes('event: stats')) {
    const chunk = await reader.read();
    if (chunk.done) break;
    stream += new TextDecoder().decode(chunk.value);
  }
  assert.match(stream, /event: stats/);
} finally {
  await reader.cancel();
  controller.abort();
  clearTimeout(timeout);
}
const logout = await fetch(base + '/api/logout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base },
  body: '{}',
});
assert.equal(logout.status, 200);
const after = await (await fetch(base + '/api/stats')).json();
assert.equal(after.checkedIn, before.checkedIn);
console.log(
  `Production verified at ${base}: dashboard, teacher route, MySQL, login cookie, protected roster, streaming events, logout. Attendance unchanged (${after.checkedIn}/${after.total}).`,
);
