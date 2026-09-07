export const HOBBY_GROUPS = [
  ['运动', ['运动','羽毛球','篮球','跑步','乒乓球','健身','足球','游泳','骑行','登山','排球']],
  ['音乐', ['音乐','唱歌','吉他','钢琴','古筝']],
  ['舞蹈', ['舞蹈']],
  ['书画', ['绘画','书法','手工']],
  ['影像', ['摄影','剪辑','影视','动漫']],
  ['生活', ['阅读','写作','旅行','烹饪','游戏','演讲','主持','围棋','象棋','剧本杀']],
];
export function estimateHobbies(students) {
  const samples = students.map(s => [...new Set(typeof s.hobbies === 'string' ? JSON.parse(s.hobbies) : s.hobbies || [])].filter(Boolean)).filter(tags => tags.length);
  const population = students.length, sampleSize = samples.length;
  const project = observed => sampleSize ? Math.min(population, Math.round(observed / sampleSize * population)) : 0;
  const counts = new Map();
  for (const tags of samples) for (const name of tags) counts.set(name, (counts.get(name) || 0) + 1);
  const words = [...counts].map(([name, observed]) => ({name, observed, value:project(observed)})).sort((a,b) => b.value-a.value || a.name.localeCompare(b.name, 'zh-CN'));
  const radar = HOBBY_GROUPS.map(([name, tags]) => { const observed = samples.filter(sample => sample.some(tag => tags.includes(tag))).length; return {name, observed, value:project(observed)}; });
  return {population, sampleSize, words, radar};
}
