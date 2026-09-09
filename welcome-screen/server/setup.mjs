import mysql from 'mysql2/promise';
import { readFile, appendFile, access } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import { connection, database, pool } from './db.mjs';
import { importRegions } from './geography.mjs';

const bootstrap = await mysql.createConnection(connection);
await bootstrap.query(
  `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
await bootstrap.end();
// Widen the status enum for databases created before leave/withdrawn existed.
const [[statusColumn]] = await pool.execute(
  `SELECT COLUMN_TYPE t FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=? AND TABLE_NAME='students' AND COLUMN_NAME='status'`,
  [database],
);
if (statusColumn && !statusColumn.t.includes('withdrawn')) {
  await pool.query(
    "ALTER TABLE students MODIFY status ENUM('pending','checked_in','leave','withdrawn') NOT NULL DEFAULT 'pending'",
  );
}
const schema = [
  `CREATE TABLE IF NOT EXISTS students (
 id VARCHAR(20) PRIMARY KEY, name VARCHAR(80) NOT NULL, major VARCHAR(80) NOT NULL, class_name VARCHAR(120) NOT NULL,
 gender VARCHAR(10), birthday DATE, zodiac VARCHAR(20), hobbies JSON NOT NULL, hobbies_raw TEXT, last_character VARCHAR(8),
 student_no VARCHAR(20) UNIQUE, id_card CHAR(18),
 city VARCHAR(80), district VARCHAR(80), school VARCHAR(180), source_sheet VARCHAR(80), source_row INT,
 status ENUM('pending','checked_in','leave','withdrawn') NOT NULL DEFAULT 'pending', ordinal INT UNSIGNED UNIQUE,
 checked_in_at DATETIME(3), updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 INDEX idx_status(status), INDEX idx_name(name), INDEX idx_class(class_name)
) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS counters (name VARCHAR(50) PRIMARY KEY, value INT UNSIGNED NOT NULL DEFAULT 0) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS settings (name VARCHAR(50) PRIMARY KEY, value JSON NOT NULL) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS audit_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, student_id VARCHAR(20), action VARCHAR(40) NOT NULL, actor VARCHAR(80) NOT NULL, details JSON, created_at DATETIME(3) NOT NULL, INDEX idx_student(student_id)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS teachers (
 username VARCHAR(40) PRIMARY KEY, pwd VARCHAR(128) NOT NULL, salt VARCHAR(64) NOT NULL,
 major VARCHAR(80), display_name VARCHAR(80) NOT NULL, created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS sessions (
 token_hash VARCHAR(64) PRIMARY KEY, username VARCHAR(40) NOT NULL,
 major VARCHAR(80), expires_ms BIGINT NOT NULL, INDEX idx_expires(expires_ms)
) ENGINE=InnoDB`,
];
for (const sql of schema) await pool.query(sql);
// Widen pre-existing tables (idempotent): student number + ID card for lookup.
await pool
  .query('ALTER TABLE students ADD COLUMN student_no VARCHAR(20) UNIQUE')
  .catch((e) => {
    // 1060 = duplicate column: the column already exists.
    if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') throw e;
  });
await pool
  .query('ALTER TABLE students ADD COLUMN id_card CHAR(18)')
  .catch((e) => {
    if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') throw e;
  });
// Import student numbers and ID cards from the ID spreadsheet, name + class keyed.
try {
  const XLSX = await import('xlsx/xlsx.mjs');
  const buf = await readFile(new URL('../../学生身份证信息.xlsx', import.meta.url));
  const sheet = XLSX.read(buf).Sheets.Sheet1;
  const roster = XLSX.utils.sheet_to_json(sheet);
  let matchedNo = 0,
    matchedCard = 0;
  for (const row of roster) {
    const no = String(row['学号'] ?? '').trim();
    const card = String(row['证件号码'] ?? '').trim().toUpperCase();
    const name = String(row['姓名'] ?? '').trim();
    const cls = String(row['班级'] ?? '').trim();
    if (!name || !cls) continue;
    if (no) {
      const [result] = await pool.execute(
        'UPDATE students SET student_no=? WHERE name=? AND class_name=?',
        [no, name, cls],
      );
      matchedNo += result.affectedRows;
    }
    if (/^\d{17}[\dX]$/.test(card)) {
      const [result] = await pool.execute(
        'UPDATE students SET id_card=? WHERE name=? AND class_name=?',
        [card, name, cls],
      );
      matchedCard += result.affectedRows;
    }
  }
  console.log(
    `学号导入：${matchedNo}/${roster.length}，身份证导入：${matchedCard}/${roster.length}`,
  );
} catch {
  console.log('未找到 学生身份证信息.xlsx，跳过学号/身份证导入');
}
await pool.execute(
  "INSERT IGNORE INTO counters (name,value) VALUES ('registration',0)",
);
await pool.execute(
  "INSERT IGNORE INTO settings (name,value) VALUES ('photo','null')",
);
const students = JSON.parse(
  await readFile(new URL('../data/students.json', import.meta.url), 'utf8'),
);
const report = JSON.parse(
  await readFile(
    new URL('../data/import-report.json', import.meta.url),
    'utf8',
  ),
);
const db = await pool.getConnection();
let inserted = 0;
try {
  await db.beginTransaction();
  for (const s of students) {
    const [existing] = await db.execute(
      'SELECT name,major,class_name FROM students WHERE id=?',
      [s.id],
    );
    if (existing.length) {
      if (
        existing[0].name !== s.name ||
        existing[0].major !== s.major ||
        existing[0].class_name !== s.className
      )
        throw Error(
          `Source identity changed at ${s.id}; reconcile the roster before importing.`,
        );
      continue; // Never reset attendance or overwrite teachers' corrected profiles on repeat setup.
    }
    await db.execute(
      'INSERT INTO students (id,name,major,class_name,gender,birthday,zodiac,hobbies,hobbies_raw,last_character,city,district,school,source_sheet,source_row) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        s.id,
        s.name,
        s.major,
        s.className,
        s.gender,
        s.birthday,
        s.zodiac,
        JSON.stringify(s.hobbies),
        s.hobbiesRaw,
        s.lastCharacter,
        s.city,
        s.district,
        s.school,
        s.sourceSheet,
        s.sourceRow,
      ],
    );
    inserted++;
  }
  await db.execute(
    "INSERT INTO settings (name,value) VALUES ('import_report',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
    [JSON.stringify(report)],
  );
  await db.commit();
} catch (e) {
  await db.rollback();
  throw e;
} finally {
  db.release();
}
// Region import needs the private data/student-regions.json (git-ignored).
// Skip it when the file is absent so a fresh clone can still initialize.
if (await access(new URL('../data/student-regions.json', import.meta.url)).then(() => true, () => false)) {
  await importRegions();
} else {
  console.log('未找到 data/student-regions.json，跳过地域导入');
}
// Teacher accounts: admin follows .env; one generated account per major is
// created once and printed here (also appended to data/teacher-accounts.txt).
const hash = (password, salt) =>
  scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
const adminSalt = randomBytes(32).toString('hex');
await pool.execute(
  `INSERT INTO teachers (username,pwd,salt,major,display_name) VALUES (?,?,?,NULL,'学院管理员')
   ON DUPLICATE KEY UPDATE pwd=VALUES(pwd), salt=VALUES(salt)`,
  [
    process.env.ADMIN_USER || 'admin',
    hash(process.env.ADMIN_PASSWORD, adminSalt),
    adminSalt,
  ],
);
const ACCOUNT_FILE = new URL('../data/teacher-accounts.txt', import.meta.url);
const generated = [];
for (const [username, major, display] of [
  ['ai', '人工智能技术应用', '人工智能迎新老师'],
  ['bigdata', '大数据技术', '大数据迎新老师'],
  ['fintech', '金融科技应用', '金融科技迎新老师'],
  ['ecom', '电子商务', '电子商务迎新老师'],
]) {
  const [existingRows] = await pool.execute(
    'SELECT username FROM teachers WHERE username=?',
    [username],
  );
  if (existingRows.length) continue;
  const password =
    username +
    '-' +
    randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6);
  const salt = randomBytes(32).toString('hex');
  await pool.execute(
    'INSERT INTO teachers (username,pwd,salt,major,display_name) VALUES (?,?,?,?,?)',
    [username, hash(password, salt), salt, major, display],
  );
  generated.push({ username, password, major, display });
}
if (generated.length) {
  const lines = generated
    .map(
      (a) =>
        `${new Date().toISOString().slice(0, 16).replace('T', ' ')} 生成 ${a.display}: 账号 ${a.username}  密码 ${a.password}（${a.major}）`,
    )
    .join('\n');
  if (!process.env.WELCOME_ACCOUNTS_QUIET) {
    await appendFile(ACCOUNT_FILE, lines + '\n', 'utf8').catch(() => {});
    console.log('\n新生成的专业教师账号（仅本次显示，已记录到 data/teacher-accounts.txt）：');
    for (const a of generated)
      console.log(`  ${a.display}  账号: ${a.username}  密码: ${a.password}  专业: ${a.major}`);
    console.log('  管理员账号: ' + (process.env.ADMIN_USER || 'admin') + '  密码: 见 .env ADMIN_PASSWORD\n');
  }
}
await pool.end();
console.log(
  `MySQL ${database}: imported ${inserted}, preserved ${students.length - inserted} existing students. All new students start pending.`,
);
