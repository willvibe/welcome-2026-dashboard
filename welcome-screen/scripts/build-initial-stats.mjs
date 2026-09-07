// Regenerate lib/initial-stats.json from the roster + identity regions so the
// pre-SSE first paint matches the live buildStats() shape (districts, hobbyEstimate).
import { readFile, writeFile } from 'node:fs/promises';
import { estimateHobbies } from '../lib/hobby-statistics.mjs';

const students = JSON.parse(
  await readFile(new URL('../data/students.json', import.meta.url), 'utf8'),
);
const regions = JSON.parse(
  await readFile(new URL('../data/student-regions.json', import.meta.url), 'utf8'),
);
const report = JSON.parse(
  await readFile(new URL('../data/import-report.json', import.meta.url), 'utf8'),
);
const byId = new Map(regions.map((r) => [r.id, r]));
// Geography priority mirrors server/geography.mjs: admission roster first,
// ID-card address code only fills the gaps.
for (const s of students) {
  const r = byId.get(s.id);
  if (!r) continue;
  if (s.city?.trim()) s.province = '山东省';
  else {
    s.province = r.province;
    s.city = r.city;
  }
  if (!s.district?.trim()) s.district = r.district;
}

const countWords = (rows, key) =>
  Object.entries(
    rows.reduce((acc, s) => {
      for (const word of [key(s)].flat()) if (word) acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN'));

const groups = (field) =>
  [...new Set(students.map((s) => s[field]))].map((name) => {
    const members = students.filter((s) => s[field] === name);
    return { name, total: members.length, checkedIn: 0, rate: 0 };
  });

const cities = [...new Set(students.map((s) => s.city).filter(Boolean))]
  .map((name) => {
    const members = students.filter((s) => s.city === name);
    const tally = (field, fallback) =>
      [...new Set(members.map((s) => s[field] || fallback))]
        .map((label) => ({
          name: label,
          total: members.filter((s) => (s[field] || fallback) === label).length,
          checkedIn: 0,
        }))
        .sort((a, b) => b.total - a.total);
    return {
      name,
      province: members[0].province || null,
      districts: tally('district', '区县待细分'),
      schools: tally('school', '生源学校待补充'),
      total: members.length,
      checkedIn: 0,
    };
  })
  .sort((a, b) => b.total - a.total);

const portraits = ['全院新生', ...new Set(students.map((s) => s.major))].map(
  (name, index) => {
    const members = index === 0 ? students : students.filter((s) => s.major === name);
    return {
      name,
      total: members.length,
      gender: {
        male: members.filter((s) => s.gender === '男').length,
        female: members.filter((s) => s.gender === '女').length,
        unknown: members.filter((s) => s.gender !== '男' && s.gender !== '女').length,
      },
      zodiacs: countWords(members, (s) => s.zodiac),
    };
  },
);

const aggregate = {
  total: students.length,
  checkedIn: 0,
  pending: students.length,
  leave: 0,
  withdrawn: 0,
  rate: 0,
  today: 0,
  lastHour: 0,
  portraits,
  majors: groups('major'),
  classes: groups('className'),
  cities,
  recent: [],
  zodiacs: countWords(students, (s) => s.zodiac),
  nameWords: countWords(students, (s) => s.lastCharacter),
  hobbyWords: countWords(students, (s) => s.hobbies),
  hobbyEstimate: estimateHobbies(students),
  quality: {
    ...report,
    shandong: students.filter((s) => s.province === '山东省').length,
    outsideShandong: students.filter((s) => s.province && s.province !== '山东省').length,
    districtKnown: students.filter((s) => s.district).length,
    cityKnown: students.filter((s) => s.city).length,
    cityMissing: students.filter((s) => !s.city).length,
    birthKnown: students.filter((s) => s.birthday).length,
    hobbiesKnown: students.filter((s) => s.hobbies.length).length,
  },
  hourly: Array.from({ length: 49 }, (_, i) => {
    const m = 8 * 60 + 30 + i * 10;
    return {
      hour:
        String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
      count: 0,
    };
  }),
  trendStep: 10,
  photo: null,
  photoKey: null,
  updatedAt: null,
};
await writeFile(
  new URL('../lib/initial-stats.json', import.meta.url),
  JSON.stringify(aggregate),
  'utf8',
);
console.log(
  `initial-stats: ${aggregate.total} students, ${aggregate.cities.length} cities, ${aggregate.cities.reduce((n, c) => n + c.districts.length, 0)} districts, hobbies estimated from ${aggregate.hobbyEstimate.sampleSize} samples`,
);
