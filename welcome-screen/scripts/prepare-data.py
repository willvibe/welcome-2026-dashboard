"""Read the supplied workbook without modifying it. Private output stays outside public/."""
import collections
import datetime
import json
import pathlib
import re
import urllib.request
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '26级新生信息汇总.xlsx'

def birth(value):
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.strftime('%Y-%m-%d')
    numbers = re.findall(r'\d+', str(value or ''))
    try:
        return datetime.date(*map(int, numbers[:3])).isoformat()
    except (ValueError, TypeError):
        return None

def zodiac(date):
    if not date:
        return None
    month, day = map(int, date.split('-')[1:])
    names = ['摩羯座', '水瓶座', '双鱼座', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座']
    edges = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22]
    return names[month - 1 if day < edges[month - 1] else month]

HOBBIES = {
    '音乐': ['音乐', '听歌', '听音乐'], '唱歌': ['唱歌', '声乐', '演唱'],
    '篮球': ['篮球'], '羽毛球': ['羽毛球'], '乒乓球': ['乒乓球'], '足球': ['足球'],
    '排球': ['排球'], '网球': ['网球'], '游泳': ['游泳'], '跑步': ['跑步', '长跑', '短跑'],
    '健身': ['健身', '锻炼'], '舞蹈': ['跳舞', '舞蹈', '街舞', '爵士舞'],
    '绘画': ['绘画', '画画', '美术', '手绘', '速写', '素描', '绘图'],
    '摄影': ['摄影', '拍照', '拍摄'], '阅读': ['阅读', '读书', '看书', '看小说'],
    '旅行': ['旅行', '旅游'], '书法': ['书法', '练字', '硬笔', '毛笔'],
    '编程': ['编程', '代码', 'python', 'java'], '游戏': ['游戏', '电竞'],
    '影视': ['电影', '追剧', '电视剧', '影视'], '动漫': ['动漫', '二次元'],
    '吉他': ['吉他'], '钢琴': ['钢琴'], '古筝': ['古筝'], '乐器': ['乐器', '小提琴', '架子鼓', '笛子'],
    '写作': ['写作', '写小说', '写诗'], '手工': ['手工', '编织', '折纸'],
    '骑行': ['骑行', '骑车'], '烹饪': ['烹饪', '做饭', '烘焙'], '剪辑': ['剪辑'],
    '主持': ['主持'], '演讲': ['演讲', '朗诵'], '象棋': ['象棋'], '围棋': ['围棋'],
    '剧本杀': ['剧本杀'], '运动': ['运动', '体育'], '登山': ['登山', '爬山'],
}

wb = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
admissions = list(wb['考生信息表'].values)[1:]
students = []
matched_ids = set()
ambiguous = []
birth_conflicts = 0
CITY_CODES = {'3701':'济南市','3702':'青岛市','3703':'淄博市','3704':'枣庄市','3705':'东营市','3706':'烟台市','3707':'潍坊市','3708':'济宁市','3709':'泰安市','3710':'威海市','3711':'日照市','3712':'济南市','3713':'临沂市','3714':'德州市','3715':'聊城市','3716':'滨州市','3717':'菏泽市'}
for sheet in wb.worksheets[1:5]:
    for row_index, row in enumerate(list(sheet.values)[1:], 2):
        if not row[1]:
            continue
        name, major, birthday = str(row[1]).strip(), sheet.title, birth(row[4])
        candidates = [r for r in admissions if str(r[1]).strip() == name and str(r[6]).strip() == major]
        # Same-name students in the same major must be disambiguated by birthday.
        roster_matches = [r for r in list(sheet.values)[1:] if str(r[1]).strip() == name]
        if len(roster_matches) > 1 or len(candidates) > 1:
            candidates = [r for r in candidates if birth(r[8]) == birthday]
        match = candidates[0] if len(candidates) == 1 and candidates[0][0] not in matched_ids else None
        if match:
            matched_ids.add(match[0])
            if birthday != birth(match[8]):
                birth_conflicts += 1
        elif candidates:
            ambiguous.append({'name':name,'major':major,'row':row_index})
        raw_hobbies = str(row[6] or '').strip()
        tags = [tag for tag, words in HOBBIES.items() if any(word in raw_hobbies.lower() for word in words)]
        source_key = f'{wb.sheetnames.index(major):02}-{row_index-1:03}'
        students.append({
            'id': source_key, 'name':name, 'major':major, 'className':str(row[3]).strip(),
            'gender': row[2] or (match[2] if match else None), 'birthday':birthday, 'zodiac':zodiac(birthday),
            'hobbies':tags, 'hobbiesRaw':raw_hobbies, 'lastCharacter':name[-1],
            'city':CITY_CODES.get(str(match[0])[2:6]) if match else None,
            'district':str(match[16] or '') if match else None,
            'school':str(match[14] or '') if match else None,
            'sourceSheet':major,'sourceRow':row_index,
        })

report = {
    'source':'26级新生信息汇总.xlsx', 'total':len(students), 'majors':len(set(s['major'] for s in students)),
    'classes':len(set(s['className'] for s in students)), 'admissionRows':len(admissions),
    'matchedAdmissions':len(matched_ids), 'cityKnown':sum(bool(s['city']) for s in students),
    'cityMissing':sum(not s['city'] for s in students), 'birthKnown':sum(bool(s['birthday']) for s in students),
    'genderMissing':sum(not s['gender'] for s in students), 'birthdayConflicts':birth_conflicts,
    'hobbiesKnown':sum(bool(s['hobbies']) for s in students), 'ambiguous':ambiguous,
    'matchingRule':'专业+姓名唯一匹配；同专业重名时额外核对出生日期。出生日期以班级名册为准。',
    'geographyRule':'招生资料考生号第3至6位映射地级市，原DQDM保留区县；未匹配地区不推测。',
    'hobbyRule':'使用明确关键词归类；每名学生在每个标签中最多计1次。',
}
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'data/students.json').write_text(json.dumps(students,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'data/import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

geo_path=ROOT/'public/shandong.json'
if not geo_path.exists():
    geo_path.write_bytes(urllib.request.urlopen('https://geo.datav.aliyun.com/areas_v3/bound/370000_full.json',timeout=30).read())
geo=json.loads(geo_path.read_text(encoding='utf-8'))
assert len(geo['features']) == 16, 'Expected 16 Shandong prefecture-level cities'
# Store a compact, preprojected map for offline use; original GeoJSON remains available.
def project(point):
    return [round((point[0]-114.7)*95,2), round((38.6-point[1])*120,2)]
features=[]
for feature in geo['features']:
    coords=feature['geometry']['coordinates']
    if feature['geometry']['type']=='Polygon': coords=[coords]
    paths=[]
    for polygon in coords:
        for ring in polygon:
            points=[project(point) for point in ring]
            paths.append('M'+'L'.join(f'{x},{y}' for x,y in points)+'Z')
    props=feature['properties']
    center=project(props.get('centroid') or props['center'])
    features.append({'name':props['name'],'path':''.join(paths),'center':center})
(ROOT/'lib/shandong-map.json').write_text(json.dumps(features,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# This aggregate contains no personal records and allows an honest pre-API first paint.
aggregate={'total':len(students),'checkedIn':0,'pending':len(students),'rate':0,'today':0,'recent':[],
    'majors':[{'name':name,'total':count,'checkedIn':0,'rate':0} for name,count in collections.Counter(s['major'] for s in students).items()],
    'classes':[{'name':name,'total':count,'checkedIn':0,'rate':0} for name,count in collections.Counter(s['className'] for s in students).items()],
    'cities':[{'name':name,'total':count,'checkedIn':0,'schools':[{'name':school,'total':num,'checkedIn':0} for school,num in collections.Counter(s['school'] for s in students if s['city']==name and s['school']).most_common()]} for name,count in collections.Counter(s['city'] for s in students if s['city']).most_common()],
    'zodiacs':[{'name':name,'value':count} for name,count in collections.Counter(s['zodiac'] for s in students if s['zodiac']).most_common()],
    'nameWords':[{'name':name,'value':count} for name,count in collections.Counter(s['lastCharacter'] for s in students).most_common()],
    'hobbyWords':[{'name':name,'value':count} for name,count in collections.Counter(tag for s in students for tag in s['hobbies']).most_common()],
    'quality':report, 'hourly':[{'hour':str(hour).zfill(2)+':00','count':0} for hour in range(24)],'photo':None,'updatedAt':None}
aggregate['lastHour'] = 0
aggregate['portraits'] = []
for index, name in enumerate(['全院新生'] + list(dict.fromkeys(s['major'] for s in students))):
    members = students if index == 0 else [s for s in students if s['major'] == name]
    aggregate['portraits'].append({'name':name, 'total':len(members), 'gender':{
        'male':sum(s['gender']=='男' for s in members),
        'female':sum(s['gender']=='女' for s in members),
        'unknown':sum(s['gender'] not in ['男','女'] for s in members)},
        'zodiacs':[{'name':z,'value':n} for z,n in collections.Counter(s['zodiac'] for s in members if s['zodiac']).most_common()]})
(ROOT/'lib/initial-stats.json').write_text(json.dumps(aggregate,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
