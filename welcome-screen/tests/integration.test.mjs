import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { connection, pool } from '../server/db.mjs';

test(
  'MySQL attendance lifecycle, concurrent teachers, SSE, profile and photo',
  { timeout: 90000 },
  async () => {
    const dbName = 'welcome2026_test_' + randomBytes(6).toString('hex');
    const testPort = 3101;
    const env = {
      ...process.env,
      DB_NAME: dbName,
      API_PORT: String(testPort),
      ADMIN_PASSWORD: 'test-only-password',
      WELCOME_ACCOUNTS_QUIET: '1',
    };
    let server,
      db,
      cookie = '';
    const base = `http://127.0.0.1:${testPort}`;
    const request = async (
      path,
      { method = 'GET', body, authenticated = true, origin } = {},
    ) => {
      const response = await fetch(base + '/api' + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(authenticated && cookie ? { Cookie: cookie } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, data: await response.json(), response };
    };
    try {
      const setup = spawnSync(process.execPath, ['server/setup.mjs'], {
        env,
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(setup.status, 0, setup.stderr);
      db = await mysql.createConnection({ ...connection, database: dbName });
      server = spawn(process.execPath, ['server/index.mjs'], {
        env,
        stdio: 'pipe',
        windowsHide: true,
      });
      let errorLog = '';
      server.stderr.on('data', (d) => {
        errorLog += d;
      });
      let ready = false;
      for (let i = 0; i < 50; i++) {
        try {
          const r = await request('/health');
          if (r.status === 200) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready, errorLog);
      // Prove this listener is attached to the isolated database, never the live roster.
      const [[initial]] = await db.query('SELECT COUNT(*) AS n FROM students');
      assert.equal(initial.n, 450);
      assert.equal(
        (await request('/students', { authenticated: false })).status,
        401,
      );
      assert.equal(
        (
          await request('/attendance', {
            method: 'POST',
            body: { ids: ['01-001'], status: 'checked_in' },
            authenticated: false,
          })
        ).status,
        401,
      );
      const login = await request('/login', {
        method: 'POST',
        body: { username: 'admin', password: 'test-only-password' },
        authenticated: false,
      });
      assert.equal(login.status, 200);
      cookie = login.response.headers.get('set-cookie').split(';')[0];
      assert.match(login.response.headers.get('set-cookie'), /HttpOnly/);
      assert.equal(
        (
          await request('/attendance', {
            method: 'POST',
            body: { ids: ['01-001'], status: 'checked_in' },
            origin: 'http://untrusted.invalid',
          })
        ).status,
        403,
      );
      const initialStats = (await request('/stats')).data;
      assert.equal(initialStats.total, 450);
      assert.equal(initialStats.checkedIn, 0);
      // Geography and gender splits vary with the imported roster, so expect
      // them to mirror the test database instead of one fixed dataset.
      const [[geo]] = await db.query(
        "SELECT COUNT(*) AS known FROM students WHERE city IS NOT NULL AND city <> ''",
      );
      assert.equal(initialStats.quality.cityKnown, geo.known);
      assert.equal(initialStats.quality.cityMissing, 450 - geo.known);
      assert.equal(initialStats.majors.length, 4);
      assert.equal(initialStats.classes.length, 11);
      assert.equal(initialStats.lastHour, 0);
      assert.equal(initialStats.portraits.length, 5);
      assert.equal(initialStats.portraits[0].total, 450);
      const [[genders]] = await db.query(
        "SELECT SUM(gender='男') AS male, SUM(gender='女') AS female, SUM(gender IS NULL OR gender='') AS unknown FROM students",
      );
      assert.deepEqual(initialStats.portraits[0].gender, {
        male: Number(genders.male),
        female: Number(genders.female),
        unknown: Number(genders.unknown),
      });
      for (const portrait of initialStats.portraits) {
        assert.equal(
          portrait.gender.male +
            portrait.gender.female +
            portrait.gender.unknown,
          portrait.total,
        );
        assert.equal(
          portrait.zodiacs.reduce((n, word) => n + word.value, 0),
          portrait.total,
        );
      }
      assert.equal(
        initialStats.portraits.slice(1).reduce((n, p) => n + p.total, 0),
        450,
      );
      assert.equal(
        initialStats.zodiacs.reduce((n, w) => n + w.value, 0),
        450,
      );
      assert.equal(
        initialStats.nameWords.reduce((n, w) => n + w.value, 0),
        450,
      );
      assert.equal(
        initialStats.cities.reduce((n, c) => n + c.total, 0),
        geo.known,
      );
      assert.ok(!JSON.stringify(initialStats).includes('"birthday":'));
      assert.ok(!JSON.stringify(initialStats).includes('"hobbies_raw":'));
      const list = (
        await request('/students?q=' + encodeURIComponent('李可欣'))
      ).data.students;
      assert.equal(list.length, 3);
      assert.equal(new Set(list.map((s) => s.id)).size, 3);
      assert.equal(
        (await request('/students?q=' + encodeURIComponent("' OR 1=1 --"))).data
          .total,
        0,
      );
      const all = (await request('/students')).data.students;
      const ids = all.slice(0, 8).map((s) => s.id);
      const streamAbort = new AbortController();
      const eventResponse = await fetch(base + '/api/events', {
        signal: streamAbort.signal,
      });
      assert.match(
        eventResponse.headers.get('content-type'),
        /text\/event-stream/,
      );
      const reader = eventResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      async function waitForStats(count) {
        const end = Date.now() + 7000;
        while (Date.now() < end) {
          const { value, done } = await reader.read();
          if (done) throw Error('SSE closed unexpectedly');
          buffer += decoder.decode(value, { stream: true });
          let separator;
          while ((separator = buffer.indexOf('\n\n')) >= 0) {
            const packet = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            const data = packet.split('\n').find((l) => l.startsWith('data: '));
            if (data && JSON.parse(data.slice(6)).checkedIn === count) return;
          }
        }
        throw Error('No matching SSE snapshot');
      }
      await waitForStats(0);
      const concurrent = await Promise.all(
        ids.map((id) =>
          request('/attendance', {
            method: 'POST',
            body: { ids: [id], status: 'checked_in' },
          }),
        ),
      );
      for (const r of concurrent) assert.equal(r.status, 200);
      const ordinals = concurrent.map((r) => r.data.students[0].ordinal);
      assert.equal(new Set(ordinals).size, 8);
      assert.deepEqual(
        [...ordinals].sort((a, b) => a - b),
        [1, 2, 3, 4, 5, 6, 7, 8],
      );
      await waitForStats(8);
      await reader.cancel();
      streamAbort.abort();
      const duplicate = await request('/attendance', {
        method: 'POST',
        body: { ids: [ids[0], ids[0]], status: 'checked_in' },
      });
      assert.equal(duplicate.data.students.length, 1);
      assert.equal(duplicate.data.students[0].ordinal, ordinals[0]);
      const after = (await request('/stats')).data;
      assert.equal(after.checkedIn, 8);
      assert.equal(after.pending, 442);
      assert.equal(after.recent.length, 5);
      const history = await request('/arrivals', { authenticated: false });
      assert.equal(history.status, 200);
      assert.equal(history.data.arrivals.length, 8);
      assert.deepEqual(history.data.arrivals.slice(0, 5), after.recent);
      assert.deepEqual(
        new Set(history.data.arrivals.map((s) => s.id)),
        new Set(ids),
      );
      for (const student of history.data.arrivals) {
        assert.deepEqual(
          Object.keys(student).sort(),
          [
            'id',
            'name',
            'major',
            'className',
            'city',
            'ordinal',
            'checkedInAt',
          ].sort(),
        );
      }
      // Every older row must lead to the existing personalized card, beyond the latest five.
      for (const student of history.data.arrivals.slice(5)) {
        const card = await request('/card/' + student.id, {
          authenticated: false,
        });
        assert.equal(card.status, 200);
        assert.equal(card.data.student.id, student.id);
        assert.equal(card.data.student.ordinal, student.ordinal);
        assert.equal(typeof card.data.message, 'string');
      }
      assert.equal(after.today, 8);
      assert.equal(after.lastHour, 8);
      const [[originalArrival]] = await db.execute(
        'SELECT checked_in_at FROM students WHERE id=?',
        [ids[0]],
      );
      await db.execute(
        'UPDATE students SET checked_in_at=UTC_TIMESTAMP(3)-INTERVAL 61 MINUTE WHERE id=?',
        [ids[0]],
      );
      assert.equal((await request('/stats')).data.lastHour, 7);
      await db.execute('UPDATE students SET checked_in_at=? WHERE id=?', [
        originalArrival.checked_in_at,
        ids[0],
      ]);
      assert.equal(after.rate, 1.8);
      assert.equal(
        after.majors.reduce((n, g) => n + g.checkedIn, 0),
        8,
      );
      assert.equal(
        after.classes.reduce((n, g) => n + g.checkedIn, 0),
        8,
      );
      assert.equal(
        after.hourly.reduce((n, h) => n + h.count, 0),
        8,
      );
      const bad = await request('/attendance', {
        method: 'POST',
        body: { ids: [all[20].id, '99-999'], status: 'checked_in' },
      });
      assert.equal(bad.status, 404);
      assert.equal((await request('/stats')).data.checkedIn, 8);
      await request('/attendance', {
        method: 'POST',
        body: { ids: [ids[0]], status: 'pending' },
      });
      assert.equal((await request('/stats')).data.checkedIn, 7);
      const undoneHistory = (
        await request('/arrivals', { authenticated: false })
      ).data.arrivals;
      assert.equal(undoneHistory.length, 7);
      assert.ok(!undoneHistory.some((s) => s.id === ids[0]));
      assert.equal(
        (await request('/card/' + ids[0], { authenticated: false })).status,
        409,
      );
      const redone = await request('/attendance', {
        method: 'POST',
        body: { ids: [ids[0]], status: 'checked_in' },
      });
      // Undo clears the ordinal, so a re-check draws a fresh number instead
      // of resurrecting the old one.
      assert.equal(redone.data.students[0].ordinal, Math.max(...ordinals) + 1);
      const refreshedHistory = (
        await request('/arrivals', { authenticated: false })
      ).data.arrivals;
      assert.equal(refreshedHistory.length, 8);
      assert.equal(refreshedHistory[0].id, ids[0]);
      assert.equal(refreshedHistory[0].ordinal, Math.max(...ordinals) + 1);
      await request('/attendance', {
        method: 'POST',
        body: { ids: [ids[0]], status: 'pending' },
      });
      assert.equal(
        (
          await request('/photo', {
            method: 'POST',
            body: { studentId: ids[0] },
          })
        ).status,
        409,
      );
      await request('/attendance', {
        method: 'POST',
        body: { ids: [ids[0]], status: 'checked_in' },
      });
      assert.equal(
        (
          await request('/photo', {
            method: 'POST',
            body: { studentId: ids[0] },
          })
        ).status,
        200,
      );
      assert.equal((await request('/stats')).data.photo.id, ids[0]);
      await request('/photo', { method: 'POST', body: { studentId: null } });
      assert.equal((await request('/stats')).data.photo, null);
      // Exercise the geography PATCH on a student without a city when the
      // roster has one, otherwise on any student — the expected cityKnown
      // count shifts only when the target lacked a city before the edit.
      const unknown = all.find((s) => !s.city);
      const target = unknown || all[0];
      const expectedKnown = geo.known + (unknown ? 1 : 0);
      const profile = await request('/students/' + target.id + '/profile', {
        method: 'PATCH',
        body: { city: '济南市', district: '测试区', school: '测试生源学校' },
      });
      assert.equal(profile.status, 200);
      const updated = (await request('/stats')).data;
      assert.equal(updated.quality.cityKnown, expectedKnown);
      assert.ok(
        updated.cities
          .find((c) => c.name === '济南市')
          .schools.some((s) => s.name === '测试生源学校'),
      );
      const rerun = spawnSync(process.execPath, ['server/setup.mjs'], {
        env,
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(rerun.status, 0, rerun.stderr);
      assert.equal((await request('/stats')).data.checkedIn, 8);
      assert.equal((await request('/stats')).data.quality.cityKnown, expectedKnown);
      const audit = (await request('/audit')).data.logs;
      assert.ok(audit.some((l) => l.action === 'undo_check_in'));
      assert.ok(audit.some((l) => l.action === 'update_profile'));
      await request('/logout', { method: 'POST', body: {} });
      assert.equal((await request('/students')).status, 401);
      console.log(
        'Verified: 450-row import, private API auth, same-origin mutations, duplicate names, SQL input, concurrent numbering, idempotency, atomic rollback, undo/recheck, 5 recent arrivals, complete public history and older personalized cards, SSE updates, photo eligibility, geography edits, audit, repeat import preservation.',
      );
    } finally {
      if (server) {
        server.kill();
        await new Promise((resolve) => {
          server.once('exit', resolve);
          setTimeout(resolve, 1000);
        });
      }
      if (db) await db.end();
      const cleanup = await mysql.createConnection(connection);
      assert.match(dbName, /^welcome2026_test_[a-f0-9]{12}$/);
      await cleanup.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      await cleanup.end();
      await pool.end();
    }
  },
);
