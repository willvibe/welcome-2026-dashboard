from pathlib import Path
root = Path(__file__).resolve().parents[1]
def edit(name, pairs):
    path=root/name
    text=path.read_text(encoding='utf-8')
    for old,new in pairs:
        if old not in text: raise ValueError(f'Missing replacement in {name}: {old[:60]}')
        text=text.replace(old,new)
    path.write_text(text,encoding='utf-8')
edit('components/dashboard.tsx',[
 ('  ZodiacBars,\n',''),('SchoolList','DistrictList'),("'./school-list'","'./school-list'"),
 ('shared 3s','shared 5s'),('3000','5000'),('每 3 秒','每 5 秒'),('3s','5s'),
 ("    zodiacMode = mod(tick, 2) === 0 ? 'ring' : 'bar',\n",''),
 ('    schools: [],','    schools: [],\n    districts: [],\n    province: null,'),
 ('  const cloudLead = stats.nameWords[0],\n    hobbyLead = stats.hobbyWords[0];',"  const repeatedNames = stats.nameWords.filter(w => w.value > 1).slice(0, 10);\n  const cloudLead = repeatedNames[mod(tick, Math.max(1, repeatedNames.length))];\n  const hobbyEstimate = stats.hobbyEstimate;\n  const hobbyLeaders = hobbyEstimate.words.slice(0, 6);\n  const hobbyLead = hobbyLeaders[mod(tick, Math.max(1, hobbyLeaders.length))];"),
 ('          </span>\n        </a>','          </span>\n          <span className="a-brand-name">数智科技产业学院<small>COLLEGE OF DIGITAL INTELLIGENCE</small></span>\n        </a>'),
 ('            <span>数智科技产业学院</span>\n',''),
 ('                  <i>同乡档案</i>','                  <i>{city.province === \'山东省\' ? \'同乡档案\' : city.province || \'同乡档案\'}</i>'),
 ('{city.schools.length} 所生源学校','{city.districts.length} 个区县分组'),
 ('{stats.quality.cityMissing} 人地区待补充，未计入热力分布','山东 {stats.quality.shandong} 人 · 省外 {stats.quality.outsideShandong} 人 · 地址码统计'),
 ('              <span>「{cloudLead?.name}」</span>\n              <p>{cloudLead?.value} 位同学，拥有同一个名字尾字</p>', '              <span>「{cloudLead?.name || \'缘\'}」</span>\n              <p key={cloudLead?.name}>{cloudLead ? `${cloudLead.value} 位同学共享名字尾字 · TOP ${mod(tick, repeatedNames.length) + 1}` : \'每一个名字，都独一无二\'}</p>'),
 ("{zodiacMode === 'ring' ? '环形图' : '条形图'}", "12 星座 · 5s"),
 ("            {zodiacMode === 'ring' ? (\n              <ZodiacChart portrait={zodiac} />\n            ) : (\n              <ZodiacBars portrait={zodiac} />\n            )}", '            <ZodiacChart portrait={zodiac} tick={tick} />'),
 ('全院新生 · 环形 / 条形','寻找你的星座同伴'),
 ('<WordCloud words={stats.hobbyWords} />','<WordCloud words={hobbyEstimate.words} estimated />'),
 ('<InterestRadar words={stats.hobbyWords} />','<InterestRadar words={hobbyEstimate.words} categories={hobbyEstimate.radar} />'),
 ('                {hobbyLead?.value} 位同学热爱{hobbyLead?.name}，找到你的同好',"                {hobbyLead ? `约 ${hobbyLead.value} 位同学热爱${hobbyLead.name}` : '等待同学们分享热爱'}<small className=\"a-estimate-note\">按 {hobbyEstimate.sampleSize} 份兴趣资料推算至 {hobbyEstimate.population} 人 · 估算</small>"),
 ('              人、待补充 {stats.quality.cityMissing} 人。','              人。按身份证前六位地址码归并至省、市、区县，不代表现居地；市辖区通用码保留“区县待细分”。省外生源也参与地区卡片轮播。'),
 ('星座展示全院分布，环形与条形图每 3\n              秒切换，以公历生日计算。','星座展示全院分布，右侧数量每 5\n              秒轮播，以公历生日计算。'),
 ('名字词云展示高频末字；兴趣词云和雷达展示真实兴趣标签人数，每人每个标签只计一次。','名字尾字前十名每 5 秒轮播；兴趣人数按已填写兴趣的学生比例推算至当前在册总人数，仅为估算。每人每个标签、每个雷达类别只计一次，多选兴趣人数之和可超过总人数。报到数据每 5 秒刷新，教师操作即时同步。'),
])
edit('components/school-list.tsx', [('SchoolList','DistrictList'),('city.schools','city.districts'),('所生源学校','个生源区县'),('生源学校','生源区县'),('every school','every district')])
edit('server/index.mjs',[('}, 3000);','}, 5000);')])
