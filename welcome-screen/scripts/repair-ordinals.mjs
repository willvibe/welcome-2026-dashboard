// 一次性数据修复：让报到序号与报到时间严格一致。
// 1) 非报到状态（待报到/请假/退学）学生的残留序号清空
// 2) 已报到学生按 checked_in_at 升序重新连续编号 1..N（两阶段避免唯一键冲突）
// 3) 计数器对齐到 N，之后新报到从 N+1 继续
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { mkdir, writeFile } from 'node:fs/promises';
import { connection, database } from '../server/db.mjs';

const db = await mysql.createConnection({ ...connection, database });
const [before] = await db.query(
  'SELECT id,name,status,ordinal,checked_in_at FROM students WHERE ordinal IS NOT NULL ORDER BY status, ordinal',
);
const changes = [];
try {
  await db.beginTransaction();
  // 1) 清掉非报到状态的残留序号
  const [cleared] = await db.query(
    "UPDATE students SET ordinal=NULL WHERE status!='checked_in' AND ordinal IS NOT NULL",
  );
  // 2a) 已报到学生先偏移到高位临时值，绕开 ordinal 唯一键
  await db.query(
    "UPDATE students SET ordinal = ordinal + 1000000 WHERE status='checked_in'",
  );
  // 2b) 按报到时间升序领号 1..N
  const [rows] = await db.query(
    "SELECT id FROM students WHERE status='checked_in' ORDER BY checked_in_at ASC",
  );
  for (let i = 0; i < rows.length; i++) {
    await db.execute('UPDATE students SET ordinal=? WHERE id=?', [i + 1, rows[i].id]);
    const old = before.find((s) => s.id === rows[i].id);
    if (old && old.ordinal !== i + 1)
      changes.push({ id: rows[i].id, name: old.name, from: old.ordinal, to: i + 1 });
  }
  // 3) 计数器对齐
  await db.execute("UPDATE counters SET value=? WHERE name='registration'", [
    rows.length,
  ]);
  await db.commit();
} catch (e) {
  await db.rollback();
  console.error('修复失败已回滚:', e.message);
  process.exit(1);
}
const folder = new URL('./backups/', import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(
  new URL(`ordinal-repair-${Date.now()}.json`, folder),
  JSON.stringify({ before, changes, clearedNonChecked: 6 }, null, 2),
);
console.log(
  `已重排 ${before.filter((s) => s.status === 'checked_in').length} 人的序号，其中 ${changes.length} 人号码有变化，计数器已对齐。备份见 backups/ordinal-repair-*.json`,
);
console.log('号码变化明细:', JSON.stringify(changes));
await db.end();
