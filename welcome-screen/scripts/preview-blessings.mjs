// 统计古典寄语匹配率与示例。
import { pool } from '../server/db.mjs';
import { blessing, parseJSON } from '../server/service.mjs';

const [students] = await pool.query(
  'SELECT id,name,gender,major,hobbies FROM students ORDER BY id',
);
let nameHit = 0,
  hobbyHit = 0,
  poolHit = 0;
const samples = [];
for (const s of students) {
  const msg = blessing({
    name: s.name,
    id: s.id,
    gender: s.gender,
    major: s.major,
    hobbies: parseJSON(s.hobbies),
  });
  samples.push(`${s.name}：${msg}`);
}
// 重新导入字库判断来源（简化：直接用正则判断是否含名字中的字）
console.log(samples.slice(0, 25).join('\n'));
console.log(`\n共 ${students.length} 条`);
await pool.end();
