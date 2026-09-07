// 统计学生名字字符频率，为古典寄语句库选字。
import { pool } from '../server/db.mjs';
const [rows] = await pool.query('SELECT name FROM students');
const freq = {};
for (const { name } of rows) {
  for (const ch of [...name.slice(1)]) freq[ch] = (freq[ch] || 0) + 1;
}
const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
const covered = new Set();
let total = 0;
for (const [ch, n] of sorted) {
  total += n;
  if (covered.size < 130) covered.add(ch);
}
let hit = 0, missed = [];
for (const { name } of rows) {
  if (![...name.slice(1)].some((c) => covered.has(c))) {
    missed.push(name);
  } else hit++;
}
console.log('前130高频字覆盖学生:', hit + '/' + rows.length);
console.log('未覆盖:', missed.join('、'));
console.log('\n高频字（频次≥3）:');
console.log(
  sorted.filter(([, n]) => n >= 3).map(([c, n]) => c + '(' + n + ')').join(' '),
);
await pool.end();
