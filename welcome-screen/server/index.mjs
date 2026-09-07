import express from 'express';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { pool } from './db.mjs';
import {
  buildStats,
  buildCard,
  publicStudent,
  setAttendance,
  teacherStudent,
  sqlTime,
  parseJSON,
} from './service.mjs';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  next();
});
const adminUser = process.env.ADMIN_USER || 'admin';
if (!process.env.ADMIN_PASSWORD) throw Error('Set ADMIN_PASSWORD in .env');
// Sessions live in MySQL so a login survives server restarts. A session is
// valid for one year and slides forward when less than half its life remains.
const SESSION_TTL_MS = 365 * 24 * 3600 * 1000;
const attempts = new Map(),
  clients = new Set();
const sessionKey = (token) => createHash('sha256').update(token).digest('hex');
function readToken(req) {
  return (req.headers.cookie || '')
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('welcome_session='))
    ?.slice(16);
}
async function getSession(req) {
  const token = readToken(req);
  if (!token) return null;
  const key = sessionKey(token);
  const [[row]] = await pool
    .execute('SELECT username, major, expires_ms FROM sessions WHERE token_hash=?', [
      key,
    ])
    .catch(() => [[]]);
  if (!row) return null;
  if (Number(row.expires_ms) <= Date.now()) {
    await pool
      .execute('DELETE FROM sessions WHERE token_hash=?', [key])
      .catch(() => {});
    return null;
  }
  if (Number(row.expires_ms) - Date.now() < SESSION_TTL_MS / 2)
    await pool
      .execute('UPDATE sessions SET expires_ms=? WHERE token_hash=?', [
        Date.now() + SESSION_TTL_MS,
        key,
      ])
      .catch(() => {});
  return { key, user: row.username, major: row.major };
}
async function auth(req, res, next) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: '请先登录教师工作台' });
  req.teacher = session.user;
  req.teacherMajor = session.major; // null = 全部专业
  req.sessionKey = session.key;
  next();
}
// A major-scoped teacher may only touch their own major's students.
async function assertScope(id, major, action) {
  if (!major) return;
  const [[s]] = await pool.execute('SELECT major FROM students WHERE id=?', [
    id,
  ]);
  if (!s) throw Object.assign(Error('找不到该学生'), { status: 404 });
  if (s.major !== major)
    throw Object.assign(Error(`${action}失败：该学生不属于您负责的专业`), {
      status: 403,
    });
}
// Require same-origin JSON for every mutation. Cookies are never readable by page scripts.
app.use((req, res, next) => {
  if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) return next();
  const origin = req.headers.origin,
    host = req.headers['x-welcome-original-host'] || req.headers.host;
  if (origin) {
    try {
      if (new URL(origin).host !== host)
        return res.status(403).json({ error: '不允许跨站操作' });
    } catch {
      return res.status(403).json({ error: '无效请求来源' });
    }
  }
  if (!req.is('application/json'))
    return res.status(415).json({ error: '请使用 JSON 请求' });
  next();
});
app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: 'mysql' });
});
app.post('/api/login', async (req, res) => {
  const ip = req.socket.remoteAddress;
  const old = attempts.get(ip);
  const attempt =
    old && old.until > Date.now()
      ? old
      : { count: 0, until: Date.now() + 60000 };
  if (attempt.count >= 10)
    return res.status(429).json({ error: '尝试次数过多，请一分钟后重试' });
  const { username, password } = req.body || {};
  const [[teacher]] = await pool
    .execute('SELECT username,pwd,salt,major FROM teachers WHERE username=?', [
      typeof username === 'string' ? username.slice(0, 40) : '',
    ])
    .catch(() => [[]]);
  if (
    typeof password !== 'string' ||
    password.length > 200 ||
    !teacher ||
    !timingSafeEqual(
      scryptSync(password, Buffer.from(teacher.salt, 'hex'), 64),
      Buffer.from(teacher.pwd, 'hex'),
    )
  ) {
    attempt.count++;
    attempts.set(ip, attempt);
    return res.status(401).json({ error: '账号或密码不正确' });
  }
  attempts.delete(ip);
  const token = randomBytes(32).toString('hex');
  await pool.execute(
    `INSERT INTO sessions (token_hash, username, major, expires_ms) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE username=VALUES(username), major=VALUES(major), expires_ms=VALUES(expires_ms)`,
    [sessionKey(token), teacher.username, teacher.major, Date.now() + SESSION_TTL_MS],
  );
  res.setHeader(
    'Set-Cookie',
    `welcome_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  );
  res.json({ user: teacher.username, major: teacher.major });
});
app.post('/api/logout', auth, async (req, res) => {
  const key = req.sessionKey;
  await pool
    .execute('DELETE FROM sessions WHERE token_hash=?', [key])
    .catch((e) => console.error('logout delete failed:', e.code, e.message, 'key=', key));
  res.setHeader(
    'Set-Cookie',
    'welcome_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
  );
  res.json({ ok: true });
});
app.get('/api/session', auth, (req, res) =>
  res.json({ user: req.teacher, major: req.teacherMajor }),
);
app.get('/api/stats', async (req, res) => res.json(await buildStats()));
// Full check-in history for the screen's scrollable arrivals panel; the same
// public fields as "recent", ordered newest first.
app.get('/api/arrivals', async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM students WHERE status='checked_in' ORDER BY checked_in_at DESC, ordinal DESC",
  );
  res.json({ arrivals: rows.map(publicStudent) });
});
// Commemorative card is public like the screen itself, but only for students
// who have actually checked in (same eligibility as the photo push).
app.get('/api/card/:id', async (req, res) => {
  if (!/^\d{2}-\d{3}$/.test(req.params.id))
    return res.status(400).json({ error: '无效的名册编号' });
  const card = await buildCard(req.params.id);
  if (card.student.checkedInAt === null || card.student.ordinal === null)
    return res.status(409).json({ error: '该学生尚未报到' });
  res.json(card);
});
let publishQueue = Promise.resolve();
function broadcast() {
  publishQueue = publishQueue
    .catch(() => {})
    .then(async () => {
      if (!clients.size) return;
      const packet = `event: stats\ndata: ${JSON.stringify(await buildStats())}\n\n`;
      for (const client of clients)
        if (!client.writableEnded) client.write(packet);
    });
  return publishQueue;
}
app.get('/api/events', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 2500\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
  await broadcast();
});
const heartbeat = setInterval(() => {
  for (const c of clients) c.write(': heartbeat\n\n');
  broadcast().catch(() => {
    for (const c of clients) c.end();
    clients.clear();
  });
}, 3000);
// Expired sessions are swept from MySQL hourly.
const sessionSweeper = setInterval(() => {
  pool
    .execute('DELETE FROM sessions WHERE expires_ms < ?', [Date.now()])
    .catch(() => {});
}, 3600 * 1000);
sessionSweeper.unref?.();
app.get('/api/students', auth, async (req, res) => {
  const { q = '', major = '', className = '', status = '' } = req.query;
  const conditions = [],
    values = [];
  // Major-scoped teachers always see only their own major.
  if (req.teacherMajor) {
    conditions.push('major=?');
    values.push(req.teacherMajor);
  }
  for (const [column, value] of [
    ['major', major],
    ['class_name', className],
    ['status', status],
  ])
    if (typeof value === 'string' && value) {
      conditions.push(`${column}=?`);
      values.push(value);
    }
  if (typeof q === 'string' && q.trim()) {
    conditions.push('(name LIKE ? OR id LIKE ? OR school LIKE ?)');
    const term = '%' + q.trim().replace(/[\\%_]/g, '\\$&') + '%';
    values.push(term, term, term);
  }
  const [rows] = await pool.execute(
    `SELECT * FROM students ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY id`,
    values,
  );
  res.json({ students: rows.map(teacherStudent), total: rows.length });
});
// One-click attendance export to Excel. Follows the same filters and the same
// major scoping as /api/students; major-scoped teachers can only export their
// own major's roster.
app.get('/api/export', auth, async (req, res) => {
  const { q = '', major = '', className = '', status = '' } = req.query;
  const conditions = [],
    values = [];
  if (req.teacherMajor) {
    conditions.push('major=?');
    values.push(req.teacherMajor);
  }
  for (const [column, value] of [
    ['major', major],
    ['class_name', className],
    ['status', status],
  ])
    if (typeof value === 'string' && value) {
      conditions.push(`${column}=?`);
      values.push(value);
    }
  if (typeof q === 'string' && q.trim()) {
    conditions.push('(name LIKE ? OR id LIKE ? OR school LIKE ?)');
    const term = '%' + q.trim().replace(/[\\%_]/g, '\\$&') + '%';
    values.push(term, term, term);
  }
  const [rows] = await pool.execute(
    `SELECT * FROM students ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY id`,
    values,
  );
  const STATUS_TEXT = {
    pending: '待报到',
    checked_in: '已报到',
    leave: '请假',
    withdrawn: '退学',
  };
  const STATUS_FILL = {
    checked_in: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F6EC' } },
    leave: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E0' } },
    withdrawn: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF1F1' } },
  };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '数智科技产业学院 · 教师工作台';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('报到详情', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const HEADERS = [
    ['名册编号', 10],
    ['姓名', 10],
    ['性别', 6],
    ['专业', 18],
    ['班级', 22],
    ['省份', 12],
    ['城市', 12],
    ['区县', 12],
    ['生源学校', 28],
    ['星座', 9],
    ['爱好', 22],
    ['报到状态', 10],
    ['报到序号', 10],
    ['报到时间', 17],
  ];
  sheet.columns = HEADERS.map(([header, width]) => ({
    header,
    width,
    style: { alignment: { vertical: 'middle' } },
  }));
  const headRow = sheet.getRow(1);
  headRow.height = 22;
  headRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3B4E' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };
  for (const s of rows) {
    const row = sheet.addRow([
      s.id,
      s.name,
      s.gender || '',
      s.major,
      s.class_name,
      s.province || '',
      s.city || '',
      s.district || '',
      s.school || '',
      s.zodiac || '',
      parseJSON(s.hobbies).join('、'),
      STATUS_TEXT[s.status] || s.status,
      s.ordinal ?? '',
      s.checked_in_at ? String(s.checked_in_at).slice(0, 16) : '',
    ]);
    const statusCell = row.getCell(12);
    const fill = STATUS_FILL[s.status];
    if (fill) statusCell.fill = fill;
    if (s.status === 'checked_in')
      statusCell.font = { color: { argb: 'FF1A7F37' }, bold: true };
  }
  const scopeName = req.teacherMajor || (typeof major === 'string' && major) || '全院';
  const stamp = sqlTime().slice(0, 10).replace(/-/g, '');
  const filename = `2026级新生报到详情_${scopeName}_${stamp}.xlsx`;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  res.set({
    'Content-Type':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
  res.send(buffer);
});
app.post('/api/attendance', auth, async (req, res) => {
  const { ids, status } = req.body || {};
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 100 ||
    ids.some((id) => typeof id !== 'string' || !/^\d{2}-\d{3}$/.test(id)) ||
    !['pending', 'checked_in', 'leave', 'withdrawn'].includes(status)
  )
    return res
      .status(400)
      .json({ error: '请选择 1–100 名学生及有效状态（报到/待报到/请假/退学）' });
  for (const id of [...new Set(ids)])
    await assertScope(id, req.teacherMajor, '状态修改');
  const students = await setAttendance(ids, status, req.teacher);
  await broadcast();
  res.json({ students });
});
const divisions = JSON.parse(readFileSync(new URL('../lib/china-regions.json', import.meta.url), 'utf8'));
app.patch('/api/students/:id/profile', auth, async (req, res) => {
  const { city, district, school } = req.body || {};
  const province = req.body?.province ?? (city ? divisions.find(p => p.children.some(c => c.name === city))?.name : null);
  const region = divisions.find(p => p.name === province);
  if (
    !(province === null || region) ||
    !(city === null || region?.children.some(c => c.name === city)) ||
    typeof district !== 'string' ||
    district.length > 80 ||
    typeof school !== 'string' ||
    school.length > 180
  )
    return res
      .status(400)
      .json({ error: '请选择对应省份和城市，区县不超过80字，学校不超过180字' });
  const db = await pool.getConnection();
  try {
    await assertScope(req.params.id, req.teacherMajor, '资料修改');
    await db.beginTransaction();
    const [[s]] = await db.execute(
      'SELECT * FROM students WHERE id=? FOR UPDATE',
      [req.params.id],
    );
    if (!s) throw Object.assign(Error('找不到该学生'), { status: 404 });
    await db.execute(
      'UPDATE students SET province=?,city=?,district=?,district_code=?,geography_source=?,school=? WHERE id=?',
      [province, city, district.trim() || null,
        region?.children.find(c => c.name === city)?.children.find(d => d.name === district.trim())?.code || null,
        province !== s.province || city !== s.city || (district.trim() || null) !== s.district ? 'manual' : s.geography_source,
        school.trim() || null, req.params.id],
    );
    await db.execute(
      'INSERT INTO audit_log(student_id,action,actor,details,created_at) VALUES (?,?,?,?,?)',
      [
        s.id,
        'update_profile',
        req.teacher,
        JSON.stringify({
          before: { province: s.province, city: s.city, district: s.district, school: s.school },
          after: { province, city, district, school },
        }),
        sqlTime(),
      ],
    );
    await db.commit();
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    db.release();
  }
  await broadcast();
  res.json({ ok: true });
});
app.post('/api/photo', auth, async (req, res) => {
  const { studentId } = req.body || {};
  if (studentId !== null && typeof studentId !== 'string')
    return res.status(400).json({ error: '请选择已报到学生' });
  if (studentId) {
    const [[s]] = await pool.execute('SELECT status FROM students WHERE id=?', [
      studentId,
    ]);
    if (!s || s.status !== 'checked_in')
      return res.status(409).json({ error: '该学生尚未报到，请先确认报到' });
  }
  await pool.execute("UPDATE settings SET value=? WHERE name='photo'", [
    JSON.stringify(
      studentId ? { studentId, expiresAt: Date.now() + 120000 } : null,
    ),
  ]);
  await broadcast();
  res.json({ ok: true, durationSeconds: studentId ? 120 : 0 });
});
app.get('/api/audit', auth, async (req, res) => {
  const [logs] = req.teacherMajor
    ? await pool.execute(
        'SELECT a.id,a.action,a.actor,a.created_at,a.details,s.name,s.class_name FROM audit_log a LEFT JOIN students s ON s.id=a.student_id WHERE s.major=? ORDER BY a.id DESC LIMIT 100',
        [req.teacherMajor],
      )
    : await pool.query(
        'SELECT a.id,a.action,a.actor,a.created_at,a.details,s.name,s.class_name FROM audit_log a LEFT JOIN students s ON s.id=a.student_id ORDER BY a.id DESC LIMIT 100',
      );
  res.json({ logs });
});
app.use((err, req, res, next) => {
  if (res.headersSent) {
    res.end();
    return;
  }
  console.error('API error:', err.code || err.message);
  res
    .status(err.status || 500)
    .json({
      error: err.status
        ? err.message
        : '服务暂时不可用，请检查本机 MySQL 服务后重试',
    });
});
const port = Number(process.env.API_PORT || 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`Welcome API: http://127.0.0.1:${port} (MySQL)`),
);
async function shutdown() {
  clearInterval(heartbeat);
  for (const c of clients) c.end();
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
