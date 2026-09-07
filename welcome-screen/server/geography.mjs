import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool, database } from './db.mjs';

export async function importRegions() {
  const regions = JSON.parse(await readFile(new URL('../data/student-regions.json', import.meta.url), 'utf8'));
  const report = JSON.parse(await readFile(new URL('../data/region-import-report.json', import.meta.url), 'utf8'));
  // Geography priority: the admission roster (26级新生信息汇总) wins where it
  // knows the exam-area city/district; the ID-card address code only fills gaps.
  const roster = JSON.parse(await readFile(new URL('../data/students.json', import.meta.url), 'utf8'));
  const admission = new Map(roster.map(s => [s.id, {city: s.city?.trim() || null, district: s.district?.trim() || null}]));
  const merged = regions.map(r => {
    const primary = admission.get(r.id);
    const useAdmission = Boolean(primary?.city);
    return {
      ...r,
      province: useAdmission ? '山东省' : r.province,
      city: primary?.city || r.city,
      district: primary?.district || r.district,
      geographySource: useAdmission ? 'admission_roster' : r.geographySource,
    };
  });
  const version = createHash('sha256').update(JSON.stringify(merged)).digest('hex');
  const [rows] = await pool.query('SELECT id,name,major,class_name,city,district,status,ordinal,checked_in_at FROM students ORDER BY id');
  if (merged.length !== 450 || rows.length !== merged.length || merged.some(r => !rows.some(s => s.id === r.id && s.name === r.name && s.major === r.major && s.class_name === r.className))) throw Error('地域导入与现有名册不一致，未修改数据');
  for (const [name, type] of Object.entries({province:'VARCHAR(80)', district_code:'CHAR(6)', address_code:'CHAR(6)', geography_source:'VARCHAR(30)'})) {
    const [columns] = await pool.execute('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [database, 'students', name]);
    if (!columns.length) await pool.query(`ALTER TABLE students ADD COLUMN ${name} ${type}`);
  }
  const [[previous]] = await pool.query("SELECT value FROM settings WHERE name='identity_geography'");
  if (previous && JSON.parse(typeof previous.value === 'string' ? previous.value : JSON.stringify(previous.value)).version === version) return { ...report, applied: false };
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [before] = await db.query('SELECT id,province,city,district,district_code,address_code,geography_source,status,ordinal,checked_in_at FROM students ORDER BY id FOR UPDATE');
    const folder = new URL('../backups/', import.meta.url);
    await mkdir(folder, {recursive:true});
    await writeFile(new URL(`geography-${database}-${Date.now()}.json`, folder), JSON.stringify(before, null, 2));
    for (const r of merged) await db.execute('UPDATE students SET province=?,city=?,district=?,district_code=?,address_code=?,geography_source=? WHERE id=?', [r.province,r.city,r.district,r.districtCode,r.addressCode,r.geographySource,r.id]);
    const [after] = await db.query('SELECT id,status,ordinal,checked_in_at FROM students ORDER BY id');
    const attendance = before.map(({id,status,ordinal,checked_in_at}) => ({id,status,ordinal,checked_in_at}));
    if (JSON.stringify(attendance) !== JSON.stringify(after)) throw Error('报到信息校验失败');
    await db.execute("INSERT INTO settings(name,value) VALUES('identity_geography',?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [JSON.stringify({...report, version})]);
    await db.commit();
    return {...report, applied:true};
  } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
}
