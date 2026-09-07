"""Read identity data locally; retain only the six-digit area code, never an ID number."""
import collections
import hashlib
import json
import pathlib
import re
import sys

import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '学生身份证信息.xlsx'
ALIASES = {
    '370125': ('370115', '济阳县'), '370181': ('370114', '章丘市'),
    '370282': ('370215', '即墨市'), '370284': ('370211', '胶南市'),
    '370634': ('370614', '长岛县'), '370684': ('370614', '蓬莱市'),
    '370802': ('370811', '市中区'), '370882': ('370812', '兖州市'),
    '371081': ('371003', '文登市'), '371202': ('370116', '莱城区'),
    '371203': ('370117', '钢城区'), '371523': ('371503', '茌平县'),
    '371727': ('371703', '定陶县'),
    '370903': ('370911', '岱岳区'),
}

def prepare():
    roster = json.loads((ROOT / 'data/students.json').read_text(encoding='utf-8'))
    divisions = json.loads((ROOT / 'data/administrative-pca.json').read_text(encoding='utf-8'))
    county_lookup, city_lookup = {}, {}
    for province in divisions:
        for city in province['children']:
            base = {'province': province['name'], 'city': city['name']}
            city_lookup[city['code']] = base
            for county in city['children']:
                county_lookup[county['code']] = {**base, 'district': county['name'], 'districtCode': county['code']}
    book = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
    source_rows = list(book.worksheets[0].values)
    headers = {str(value).strip(): index for index, value in enumerate(source_rows[0])}
    result, used, issues = [], set(), []
    weights, check_digits = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2], '10X98765432'
    for row_number, row in enumerate(source_rows[1:], 2):
        name, major, class_name = (str(row[headers[key]] or '').strip() for key in ['姓名', '专业名称', '班级'])
        candidates = [s for s in roster if (s['name'], s['major'], s['className']) == (name, major, class_name)]
        identity = str(row[headers['证件号码']] or '').strip().upper()
        valid = bool(re.fullmatch(r'\d{17}[\dX]', identity))
        valid = valid and check_digits[sum(int(c) * w for c, w in zip(identity[:17], weights)) % 11] == identity[-1]
        if len(candidates) != 1 or not valid:
            issues.append({'sourceRow': row_number, 'reason': '匹配不唯一' if len(candidates) != 1 else '身份证格式或校验码错误'})
            continue
        student = candidates[0]
        if student['id'] in used:
            issues.append({'sourceRow': row_number, 'reason': '名册记录重复匹配'})
            continue
        used.add(student['id'])
        address_code = identity[:6]
        current_code, former_name = ALIASES.get(address_code, (address_code, None))
        location = county_lookup.get(current_code)
        if location is None and address_code.endswith('01') and address_code[:4] in city_lookup:
            # A historical generic "市辖区" code cannot identify a specific county.
            location = {**city_lookup[address_code[:4]], 'district': None, 'districtCode': None}
        if location is None:
            issues.append({'sourceRow': row_number, 'addressCode': address_code, 'reason': '区划代码未收录'})
            continue
        result.append({'id': student['id'], 'name': name, 'major': major, 'className': class_name,
                       **location, 'addressCode': address_code, 'formerDistrict': former_name,
                       'geographySource': 'identity_address'})
    book.close()
    if issues or len(result) != len(roster) or len(result) != 450:
        raise ValueError(json.dumps({'expected': len(roster), 'matched': len(result), 'issues': issues}, ensure_ascii=False))
    result.sort(key=lambda s: s['id'])
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    report = {'source': SOURCE.name, 'version': hashlib.sha256(payload.encode()).hexdigest(),
              'total': len(result), 'cityKnown': sum(bool(s['city']) for s in result),
              'districtKnown': sum(bool(s['district']) for s in result),
              'districtMissing': sum(not s['district'] for s in result),
              'shandong': sum(s['province'] == '山东省' for s in result),
              'outsideShandong': sum(s['province'] != '山东省' for s in result),
              'historicalCodesMapped': sum(bool(s['formerDistrict']) for s in result),
              'provinces': dict(collections.Counter(s['province'] for s in result)),
              'geographyRule': '身份证前六位地址码匹配省、市、区县；历史代码归并至对应区县；市辖区通用代码保留区县待细分。地址码不代表当前居住地。',
              'divisionSource': 'https://github.com/modood/Administrative-divisions-of-China',
              'divisionDataYear': '2023',
              'historicalReferences': ['https://www.yantai.gov.cn/art/2020/6/23/art_34892_2761640.html',
                                       'https://jnga.jinan.gov.cn/col65840/art/2019/art_65840_4760957.html']}
    (ROOT / 'data/student-regions.json').write_text(payload, encoding='utf-8')
    (ROOT / 'data/region-import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'lib/china-regions.json').write_text(json.dumps(divisions, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    prepare()
