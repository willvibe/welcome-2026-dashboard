import { pool } from './db.mjs';
import { estimateHobbies } from '../lib/hobby-statistics.mjs';
export const parseJSON = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
export const iso = (value) =>
  value ? new Date(value.replace(' ', 'T') + 'Z').toISOString() : null;
export const sqlTime = () =>
  new Date().toISOString().slice(0, 23).replace('T', ' ');
export const publicStudent = (s) => ({
  id: s.id,
  name: s.name,
  major: s.major,
  className: s.class_name,
  city: s.city,
  ordinal: s.ordinal,
  checkedInAt: iso(s.checked_in_at),
});
export const teacherStudent = (s) => ({
  ...publicStudent(s),
  gender: s.gender,
  province: s.province,
  geographySource: s.geography_source,
  district: s.district,
  school: s.school,
  zodiac: s.zodiac,
  hobbies: parseJSON(s.hobbies),
  status: s.status,
});
const countWords = (rows, key) =>
  Object.entries(
    rows.reduce((acc, s) => {
      for (const word of [key(s)].flat()) {
        if (word) acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN'));
const chinaDay = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
const chinaMinutes = (value) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(value)
    .split(':');
  return Number(h) * 60 + Number(m);
};
// Welcome day runs 08:30–16:30 CST. Buckets start per-minute and coarsen as the
// day progresses so the trend chart stays balanced at any moment.
const TREND_OPEN = 8 * 60 + 30,
  TREND_CLOSE = 16 * 60 + 30;
export function buildTrend(today, now = new Date()) {
  const nowMin = chinaMinutes(now);
  const winStart = Math.min(TREND_OPEN, nowMin);
  const winEnd = Math.max(TREND_CLOSE, nowMin);
  const span = winEnd - winStart;
  const step =
    span <= 60
      ? 1
      : span <= 180
        ? 3
        : span <= 360
          ? 6
          : span <= 540
            ? 10
            : span <= 720
              ? 15
              : 20;
  const count = Math.ceil(span / step);
  const buckets = Array.from({ length: count }, (_, i) => {
    const m = winStart + i * step;
    return {
      hour:
        String(Math.floor(m / 60)).padStart(2, '0') +
        ':' +
        String(m % 60).padStart(2, '0'),
      count: 0,
    };
  });
  for (const s of today) {
    let idx = Math.floor(
      (chinaMinutes(new Date(iso(s.checked_in_at))) - winStart) / step,
    );
    idx = Math.min(count - 1, Math.max(0, idx));
    buckets[idx].count++;
  }
  return { buckets, step };
}
// 三年制专科个性化寄语：中国古代文学 + 近现代文人名言 + 经典励志
// 歌词，皆为祝福、鼓励、引人思考的内容。有爱好的同学优先拿贴合爱
// 好的句子（40%），其余从主池选取；同一学生寄语恒定（哈希决定选句）。
const HOBBY_WISHES = {
  摄影: '半亩方塘一鉴开，天光云影共徘徊',
  羽毛球: '疾风知劲草',
  绘画: '丹青不知老将至，富贵于我如浮云',
  唱歌: '余音绕梁，三日不绝',
  音乐: '大弦嘈嘈如急雨，小弦切切如私语',
  阅读: '读书破万卷，下笔如有神',
  运动: '天行健，君子以自强不息',
  舞蹈: '翩若惊鸿，婉若游龙',
  篮球: '百尺竿头，更进一步',
  跑步: '千里之行，始于足下',
  旅行: '五岳寻仙不辞远，一生好入名山游',
  写作: '铁肩担道义，妙手著文章',
  乒乓球: '台上一分钟，台下十年功',
  剪辑: '劝君惜取少年时',
  健身: '咬定青山不放松，立根原在破岩中',
  手工: '如切如磋，如琢如磨',
  烹饪: '人间有味是清欢',
  影视: '人生如逆旅，我亦是行人',
  书法: '飘若浮云，矫若惊龙',
  游戏: '胜固欣然，败亦可喜',
  吉他: '曲罢曾教善才服',
  足球: '老骥伏枥，志在千里',
  游泳: '长风破浪会有时，直挂云帆济沧海',
  骑行: '两岸猿声啼不住，轻舟已过万重山',
  动漫: '大人者，不失其赤子之心者也',
  主持: '腹有诗书气自华',
  钢琴: '大珠小珠落玉盘',
  演讲: '一言之辩，重于九鼎之宝',
  古筝: '昆山玉碎凤凰叫，芙蓉泣露香兰笑',
  围棋: '有约不来过夜半，闲敲棋子落灯花',
  登山: '会当凌绝顶，一览众山小',
  象棋: '运筹帷幄之中，决胜千里之外',
  剧本杀: '世事洞明皆学问，人情练达即文章',
  排球: '不经一番寒彻骨，怎得梅花扑鼻香',
};
const WISH_POOL = [
  // 中国古代文学·祝福鼓励
  '长风破浪会有时，直挂云帆济沧海',
  '天生我材必有用，千金散尽还复来',
  '千磨万击还坚劲，任尔东西南北风',
  '穷且益坚，不坠青云之志',
  '千淘万漉虽辛苦，吹尽狂沙始到金',
  '沉舟侧畔千帆过，病树前头万木春',
  '芳林新叶催陈叶，流水前波让后波',
  '路漫漫其修远兮，吾将上下而求索',
  '不经一番寒彻骨，怎得梅花扑鼻香',
  '燕雀安知鸿鹄之志哉',
  '大鹏一日同风起，扶摇直上九万里',
  '一点浩然气，千里快哉风',
  '博观而约取，厚积而薄发',
  '操千曲而后晓声，观千剑而后识器',
  '少年辛苦终身事，莫向光阴惰寸功',
  '桃李不言，下自成蹊',
  '士不可以不弘毅，任重而道远',
  '昨夜西风凋碧树，独上高楼，望尽天涯路',
  // 小众冷门古文·祝福鼓励
  '事毕于今，不溺于往，早登青云',
  '云程发轫，万里可期',
  '如月之恒，如日之升',
  '红日初升，其道大光',
  '河出伏流，一泻汪洋',
  '与天地兮同寿，与日月兮齐光',
  '及年岁之未晏兮，时亦犹其未央',
  '愿岁并谢，与长友兮',
  '年岁虽少，可师长兮',
  '苏世独立，横而不流兮',
  '乘骐骥以驰骋兮，来吾道夫先路',
  '虽千万人，吾往矣',
  '我善养吾浩然之气',
  '玉在山而草木润，渊生珠而崖不枯',
  '驽马十驾，功在不舍',
  '青，取之于蓝，而青于蓝',
  '泰山不让土壤，故能成其大',
  '志不强者智不达',
  '志当存高远',
  '猛志逸四海，骞翮思远翥',
  '及时当勉励，岁月不待人',
  '一鸣从此始，相望青云端',
  '时人不识凌云木，直待凌云始道高',
  '长安何处在，只在马蹄下',
  '愿将黄鹤翅，一借飞云空',
  '何当凌云霄，直上数千尺',
  '少年负壮气，奋烈自有时',
  '俱怀逸兴壮思飞，欲上青天揽明月',
  '东隅已逝，桑榆非晚',
  '北海虽赊，扶摇可接',
  '青山遮不住，毕竟东流去',
  '鹏北海，凤朝阳，又携书剑路茫茫',
  '明年此日青云去，却笑人间举子忙',
  '我觉君非池中物，咫尺蛟龙云雨',
  '我见青山多妩媚，料青山见我应如是',
  '苔花如米小，也学牡丹开',
  '白日不到处，青春恰自来',
  '莫嫌海角天涯远，但肯摇鞭有到时',
  '学如弓弩，才如箭镞',
  '书卷多情似故人，晨昏忧乐每相亲',
  '活水源流随处满，东风花柳逐时新',
  '一朝红日出，依旧与天齐',
  '千锤万凿出深山，烈火焚烧若等闲',
  '春风大雅能容物，秋水文章不染尘',
  '海到无边天作岸，山登绝顶我为峰',
  '岂能尽如人意，但求无愧我心',
  '宠辱不惊，闲看庭前花开花落',
  '岁月本长，天地本宽，忙者自促，鄙者自隘',
  '交友须带三分侠气，做人要存一点素心',
  '风来疏竹，风过而竹不留声',
  '室雅何须大，花香不在多',
  '删繁就简三秋树，领异标新二月花',
  '虚心竹有低头叶，傲骨梅无仰面花',
  '沧浪之水清兮，可以濯吾缨',
  '笔落惊风雨，诗成泣鬼神',
  '高山仰止，景行行止',
  '谁道人生无再少？门前流水尚能西',
  '地势坤，君子以厚德载物',
  // 少年豪气·古风励志
  '少年应有鸿鹄志，当骑骏马踏平川',
  '须知少日拏云志，曾许人间第一流',
  '少年心事当拏云',
  '我有迷魂招不得，雄鸡一声天下白',
  '鲜衣怒马少年时，不负韶华行且知',
  '以梦为马，不负韶华',
  '心中有丘壑，眉目作山河',
  '十年饮冰，难凉热血',
  '十年磨一剑，霜刃未曾试',
  '满堂花醉三千客，一剑霜寒十四州',
  '醉后不知天在水，满船清梦压星河',
  '我有明珠一颗，照破山河万朵',
  '岂曰无衣？与子同袍',
  '呦呦鹿鸣，食野之苹',
  '三万里河东入海，五千仞岳上摩天',
  '恰同学少年，风华正茂',
  '书生意气，挥斥方遒',
  '到中流击水，浪遏飞舟',
  '雄关漫道真如铁，而今迈步从头越',
  '踏遍青山人未老，风景这边独好',
  '可上九天揽月，可下五洋捉鳖',
  '敢教日月换新天',
  '不到长城非好汉',
  '宝剑锋从磨砺出，梅花香自苦寒来',
  '仰天大笑出门去，我辈岂是蓬蒿人',
  '悟已往之不谏，知来者之可追',
  '木欣欣以向荣，泉涓涓而始流',
  '志不立，天下无可成之事',
  '人须在事上磨，方立得住',
  '立志而圣则圣矣，立志而贤则贤矣',
  '有美一人，清扬婉兮',
  '月出皎兮，佼人僚兮',
  '蒹葭苍苍，白露为霜',
  // 立志高远 · 鹏程万里
  '志之所趋，无远弗届；穷山距海，不能限也',
  '古之立大事者，不惟有超世之才，亦必有坚忍不拔之志',
  '愿乘长风破万里浪',
  '愿子且充鹰隼击，莫学鹪鹩恋一枝',
  '新竹高于旧竹枝，全凭老干为扶持',
  '百尺竿头须进步，十方世界是全身',
  '鸿鹄高飞，一举千里；羽翮已就，横绝四海',
  '鹰击天风壮，鹏飞海浪春',
  '乘风好去，长空万里，直下看山河',
  '少年何妨梦摘星？敢挽桑弓射玉衡',
  '器大者声必闳，志高者意必远',
  '人生万事须自为，跬步江山即寥廓',
  '水击三千里，抟扶摇而上者九万里',
  '少年骑马入咸阳，鹘似身轻蝶似狂',
  '莫道儒生无一策，挺膺负责在吾侪',
  '宣父犹能畏后生，丈夫未可轻年少',
  // 勤学深思 · 涵泳笃行
  '博学之，审问之，慎思之，明辨之，笃行之',
  '博学而笃志，切问而近思',
  '学而不思则罔，思而不学则殆',
  '书山有路勤为径，学海无涯苦作舟',
  '业精于勤，荒于嬉；行成于思，毁于随',
  '问渠那得清如许？为有源头活水来',
  '纸上得来终觉浅，绝知此事要躬行',
  '旧书不厌百回读，熟读深思子自知',
  '读书切戒在慌忙，涵泳工夫兴味长',
  '学贵知疑，大疑则大进',
  '非学无以广才，非志无以成学',
  '粗缯大布裹生涯，腹有诗书气自华',
  '独学而无友，则孤陋而寡闻',
  '敏而好学，不耻下问',
  '学如积薪，后来者居上',
  '学不可以已',
  '吾生也有涯，而知也无涯',
  '知之者不如好之者，好之者不如乐之者',
  '读万卷书，行万里路',
  '力学如力耕，勤惰尔自知',
  '循序而渐进，熟读而精思',
  '少而好学，如日出之阳',
  '见贤思齐焉',
  '学而时习之，不亦说乎',
  '立志宜思真品格，读书须尽苦功夫',
  '知不足而奋进，望远山而力行',
  '读书不作酸寒态，谈笑常存磊落姿',
  '天下快意之事莫若友',
  '读书之乐何处寻？数点梅花天地心',
  '君子博学而日参省乎己，则知明而行无过矣',
  // 惜时笃行 · 积厚流光
  '少年易老学难成，一寸光阴不可轻',
  '逝者如斯夫，不舍昼夜',
  '一寸光阴一寸金，寸金难买寸光阴',
  '圣人不贵尺之璧而重寸之阴',
  '人生天地之间，若白驹过隙，忽然而已',
  '逆水行舟用力撑，一篙松劲退千寻',
  '积土成山，风雨兴焉；积水成渊，蛟龙生焉',
  '合抱之木，生于毫末；九层之台，起于累土',
  '天下难事，必作于易；天下大事，必作于细',
  '临渊羡鱼，不如退而结网',
  '道虽迩，不行不至；事虽小，不为不成',
  '行百里者半九十',
  '靡不有初，鲜克有终',
  '慎终如始，则无败事',
  '功崇惟志，业广惟勤',
  '不积跬步，无以至千里；不积小流，无以成江海',
  '尺璧非宝，寸阴是竞',
  '青春须早为，岂能长少年',
  '立志欲坚不欲锐，成功在久不在速',
  '流水不争先，争的是滔滔不绝',
  '日日行，不怕千万里；常常做，不怕千万事',
  '行远自迩，登高自卑',
  '夙兴夜寐，洒扫庭内',
  '莫轻小善以为无益，水滴虽微，渐盈大器',
  '冬者岁之余，夜者日之余，阴雨者时之余',
  // 修身正己 · 明德至善
  '己所不欲，勿施于人',
  '言必信，行必果',
  '静以修身，俭以养德',
  '德不孤，必有邻',
  '吾日三省吾身',
  '君子和而不同',
  '穷则独善其身，达则兼济天下',
  '富贵不能淫，贫贱不能移，威武不能屈',
  '从善如登，从恶如崩',
  '见善如不及，见不善如探汤',
  '勿以恶小而为之，勿以善小而不为',
  '积善成德，而神明自得',
  '海纳百川，有容乃大；壁立千仞，无欲则刚',
  '其身正，不令而行',
  '君子欲讷于言而敏于行',
  '文质彬彬，然后君子',
  '出淤泥而不染，濯清涟而不妖',
  '仰不愧于天，俯不怍于人',
  '大学之道，在明明德，在亲民，在止于至善',
  '知人者智，自知者明；胜人者有力，自胜者强',
  '上善若水，水善利万物而不争',
  '人而无信，不知其可也',
  '投我以桃，报之以李',
  '不患人之不己知，患不知人也',
  '善人者，不善人之师；不善人者，善人之资',
  '仁者不忧，知者不惑，勇者不惧',
  '责人之心责己，恕己之心恕人',
  '草木有本心，何求美人折',
  '咬得菜根，百事可做',
  '苟日新，日日新，又日新',
  '为天地立心，为生民立命',
  '君子坦荡荡',
  // 勇毅刚毅 · 迎难而上
  '天将降大任于斯人也，必先苦其心志，劳其筋骨',
  '艰难困苦，玉汝于成',
  '人生在勤，不索何获',
  '山重水复疑无路，柳暗花明又一村',
  '试玉要烧三日满，辨材须待七年期',
  '万事从来贵有恒',
  '遇事无难易，而勇于敢为',
  '志不求易者成，事不避难者进',
  '正入万山圈子里，一山放过一山拦',
  '愿君学长松，慎勿作桃李',
  '且挨过三冬四夏，雪尽后再看梅花',
  // 傲骨狂气 · 意气平山海
  '假令风歇时下来，犹能簸却沧溟水',
  '少年击剑更吹箫，剑气箫心两不消',
  '雄气堂堂贯斗牛，誓将真力挽河流',
  '笔底翻澜成巨浸，胸中吐气作长虹',
  '自负凌云笔，读尽人间未见书',
  // 暗室磨剑 · 沉潜蓄惊雷
  '莫怪严凝偏厉烈，若非霜雪骨难坚',
  '孤灯夜雨深潜处，听取惊雷第一声',
  '宁向直中取，不向曲中求',
  '冰雪林中著此身，不同桃李混芳尘',
  '封侯非我意，但愿海波平',
  '莫厌秋光冷，松筠气自奇',
  '潜心自有冲天策，休向人间作等闲',
  // 绝地破局 · 风骨自担当
  '狂澜既倒挽回难，独立中流试一攀',
  '沧海横流安足虑，平生最爱逆风舟',
  '不信天堑不可越，直将意气薄云霄',
  '踏平坎坷翻波浪，抖落风尘重整冠',
  // 眼界纵横 · 乾坤在胸臆
  '风云入眼舒怀抱，宇宙翻身入掌中',
  '手握灵珠常奋笔，心开天籁自鸣琴',
  '沧海横流，方显英雄本色',
  '莫愁千里关山远，自有关津引长舟',
  '天地既宽无止境，何须寸地较输赢',
  '四方纵马驰无极，不信风霜折断锋',
  '登临试放乾坤眼，看尽风涛立上头',
  '满目风雷随我走，一身正气踏云行',
  '踏碎乾坤千万丈，直上青云摘玉衡',
  // 诗经 · 君子修身与长情笃行
  '鹤鸣于九皋，声闻于天',
  '嘤其鸣矣，求其友声',
  '风雨如晦，鸡鸣不已',
  '自求多福',
  // 道德经 · 沉潜蓄力与清醒自胜
  '大方无隅，大器晚成，大音希声，大象无形',
  '致虚极，守静笃',
  '善行无辙迹，善言无瑕谪',
  // 资治通鉴 · 立心立德与思辨笃行
  '德者，才之帅也；才者，德之资也',
  '以铜为镜，可以正衣冠；以古为镜，可以知兴替；以人为镜，可以明得失',
  '知过非难，改过为难；言善非难，行善为难',
  '责己者可以成人之善，责人者适以长己之恶',
  '兼听则明，偏信则暗',
  '取法于上，仅得为中；取法于中，故为之下',
  '智者顺时而谋，愚者逆理而动',
  '夫天下之事，成于敬而败于怠，起于微而终于著',
  '力胜贫，谨胜祸，慎胜害，戒胜耻',
  '居安思危，思则有备，有备无患',
  '临难毋苟免，临财毋苟得',
  // 了凡四训 · 立命改过与谦德积善
  '命由我作，福自己求',
  '一切福田，不离方寸；从心而觅，感无不通',
  '天将发斯人也，未发其福，先发其慧',
  '天道亏盈而益谦，地道变盈而流谦，人道恶盈而好谦',
  '人之为学，日进则日昌',
  '利人者公，公则为真；利己者私，私则为假',
  '为善而心不着善，则随所成就，皆得圆满',
  // 豁达从容 · 清朗自洽
  '莫听穿林打叶声，何妨吟啸且徐行',
  '行到水穷处，坐看云起时',
  '采菊东篱下，悠然见南山',
  '万物静观皆自得，四时佳兴与人同',
  '先天下之忧而忧，后天下之乐而乐',
  '海阔凭鱼跃，天高任鸟飞',
  '桐花万里丹山路，雏凤清于老凤声',
  '天下兴亡，匹夫有责',
  '潮平两岸阔，风正一帆悬',
  '等闲识得东风面，万紫千红总是春',
  '追风赶月莫停留，平芜尽处是春山',
  '心安身自安，身安室自宽',
  '登高使人心旷，临流使人意远',
  '险夷原不滞胸中，何异浮云过太空',
  '且将新火试新茶，诗酒趁年华',
  '山高自有客行路，水深自有渡船人',
  '昨日之非不可留，今日之是不可执',
  '大抵心安即是家',
  '何须浅碧深红色，自是花中第一流',
  '心之所向，素履以往；生如逆旅，一苇以航',
  '愿借天风吹得远，家家门巷尽成春',
  '白日地中出，黄河天外来',
  // 近现代文人·名家名言
  '纵有千古，横有八荒；前途似海，来日方长',
  '少年智则国智，少年强则国强',
  '愿中国青年都摆脱冷气，只是向上走',
  '有一分热，发一分光',
  '不怕的人的面前才有路',
  '以青春之我，创建青春之国家',
  '自信人生二百年，会当水击三千里',
  '数风流人物，还看今朝',
  '星星之火，可以燎原',
  '成功的花，人们只惊羡她现时的明艳',
  '时间正翻着书页，请你着笔',
  '既然选择了远方，便只顾风雨兼程',
  '面朝大海，春暖花开',
  '黑夜给了我黑色的眼睛，我却用它寻找光明',
  '新的转机和闪闪的星斗，正在缀满没有遮拦的天空',
  '朋友，坚定地相信未来吧',
  '历经万般红尘劫，犹如凉风轻拂面',
  '青春是一本太仓促的书',
  '生活不能等待别人来安排，要自己去争取和奋斗',
  '梦想可以天花乱坠，理想是一步一个脚印踩出来的路',
  // 毛泽东 · 诗词与语录
  '一万年太久，只争朝夕',
  '好好学习，天天向上',
  '你们青年人朝气蓬勃，好像早晨八九点钟的太阳',
  '世界是你们的，也是我们的，但是归根结底是你们的',
  '前途是光明的，道路是曲折的',
  '虚心使人进步，骄傲使人落后',
  '世上无难事，只要肯登攀',
  '文明其精神，野蛮其体魄',
  '与天奋斗，其乐无穷；与地奋斗，其乐无穷',
  '不管风吹浪打，胜似闲庭信步',
  '牢骚太盛防肠断，风物长宜放眼量',
  '一桥飞架南北，天堑变通途',
  '坐地日行八万里，巡天遥看一千河',
  '问苍茫大地，谁主沉浮',
  '指点江山，激扬文字',
  '漫江碧透，百舸争流',
  '鹰击长空，鱼翔浅底，万类霜天竞自由',
  '敌军围困万千重，我自岿然不动',
  '天若有情天亦老，人间正道是沧桑',
  '万里长江横渡，极目楚天舒',
  '东方欲晓，莫道君行早',
  '我欲因之梦寥廓，芙蓉国里尽朝晖',
  '胜似春光，寥廓江天万里霜',
  '粪土当年万户侯',
  '已是悬崖百丈冰，犹有花枝俏',
  '待到山花烂漫时，她在丛中笑',
  '独有英雄驱虎豹，更无豪杰怕熊罴',
  '读书是学习，使用也是学习，而且是更重要的学习',
  // 鲁迅 · 热风与呐喊
  '其实地上本没有路，走的人多了，也便成了路',
  '此后如竟没有炬火，我便是唯一的光',
  '时间就像海绵里的水，只要愿挤，总还是有的',
  '哪里有天才，我是把别人喝咖啡的工夫都用在工作上的',
  '什么是路？就是从没路的地方践踏出来的，从只有荆棘的地方开辟出来的',
  '即使慢，驰而不息，纵令落后，也一定可以达到他所向往的目标',
  '必须敢于正视，这才可望敢想、敢说、敢作、敢当',
  '那虽然落后而仍非跑至终点不止的竞技者，正是中国将来的脊梁',
  '巨大的建筑，总是由一木一石叠起来的，我们何妨做做这一木一石呢',
  '不满足是向上的车轮',
  '单是说不行，要紧的是做',
  '必须如蜜蜂一样，采过许多花，这才能酿出蜜来',
  '人生得一知己足矣，斯世当以同怀视之',
  '无情未必真豪杰，怜子如何不丈夫',
  '横眉冷对千夫指，俯首甘为孺子牛',
  '度尽劫波兄弟在，相逢一笑泯恩仇',
  '伟大的成绩和辛勤劳动是成正比例的',
  '假使做事要面面顾到，那就什么事都不能做了',
  '石在，火种是不会绝的',
  '沉着、勇猛，有辨别，不自私',
  '使一个人的有限的生命更加有效，也即等于延长了人的生命',
];
export function blessing(student) {
  const { name, id, hobbies } = student;
  const given = name.slice(1) || name;
  let h = 0;
  for (const c of String(id) + name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  const hobbyList = Array.isArray(hobbies) ? hobbies : [];
  const hobbyHits = hobbyList
    .map((x) => HOBBY_WISHES[x])
    .filter(Boolean);
  // 爱好创意祝福（40%）+ 流行语录池（60%）；哈希分流让同班同学不千篇一律。
  const verse =
    hobbyHits.length && h % 5 < 2
      ? hobbyHits[h % hobbyHits.length]
      : WISH_POOL[Math.floor(h / 3) % WISH_POOL.length];
  return `${given}，${verse}。`;
}
// Commemorative card: how many peers share this student's city, school,
// hobbies, zodiac, final name character and birthday. Counts exclude the student.
export async function buildCard(id) {
  const [[me]] = await pool.execute('SELECT * FROM students WHERE id=?', [id]);
  if (!me) throw Object.assign(Error('找不到该学生'), { status: 404 });
  const [all] = await pool.query('SELECT * FROM students');
  const others = all.filter((s) => s.id !== id);
  const myHobbies = parseJSON(me.hobbies);
  const shared = new Set();
  let sameHobby = 0;
  for (const s of others) {
    const tags = parseJSON(s.hobbies).filter((t) => myHobbies.includes(t));
    if (tags.length) {
      sameHobby++;
      for (const t of tags) shared.add(t);
    }
  }
  const meBirth = me.birthday ? String(me.birthday).slice(5, 10) : null;
  return {
    student: { ...publicStudent(me), zodiac: me.zodiac },
    sameCity: me.city
      ? others.filter((s) => s.city === me.city).length
      : null,
    sameSchool: me.school
      ? others.filter((s) => s.school === me.school).length
      : null,
    sameHobby,
    sharedHobbies: [...shared].slice(0, 3),
    sameZodiac: me.zodiac
      ? others.filter((s) => s.zodiac === me.zodiac).length
      : null,
    sameLastChar: me.last_character
      ? others.filter((s) => s.last_character === me.last_character).length
      : null,
    sameBirthday: meBirth
      ? others.filter((s) => String(s.birthday || '').slice(5, 10) === meBirth)
          .length
      : null,
    message: blessing({
      name: me.name,
      id: me.id,
      gender: me.gender,
      major: me.major,
      hobbies: myHobbies,
    }),
  };
}

export async function buildStats() {
  const db = await pool.getConnection();
  let students, settings;
  try {
    await db.beginTransaction();
    [students] = await db.query('SELECT * FROM students ORDER BY id');
    [settings] = await db.query('SELECT * FROM settings');
    await db.commit();
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    db.release();
  }
  const metadata = Object.fromEntries(
    settings.map((s) => [s.name, parseJSON(s.value)]),
  );
  // Withdrawn students leave the roster: they no longer count towards the
  // expected total or any aggregate on the screen.
  const active = students.filter((s) => s.status !== 'withdrawn');
  const arrived = active.filter((s) => s.status === 'checked_in');
  const today = arrived.filter(
    (s) => chinaDay(new Date(iso(s.checked_in_at))) === chinaDay(new Date()),
  );
  const groups = (field) =>
    [...new Set(active.map((s) => s[field]))].map((name) => {
      const members = active.filter((s) => s[field] === name);
      const checkedIn = members.filter((s) => s.status === 'checked_in').length;
      return {
        name,
        total: members.length,
        checkedIn,
        rate: Number(((checkedIn / members.length) * 100).toFixed(1)),
      };
    });
  const cities = [...new Set(active.map((s) => s.city).filter(Boolean))]
    .map((name) => {
      const members = active.filter((s) => s.city === name);
      return {
        name,
        province: members[0].province || null,
        districts: [...new Set(members.map(s => s.district || '区县待细分'))].map(district => {
          const peers = members.filter(s => (s.district || '区县待细分') === district);
          return {name:district, total:peers.length, checkedIn:peers.filter(s => s.status === 'checked_in').length};
        }).sort((a,b) => b.total-a.total),
        total: members.length,
        checkedIn: members.filter((s) => s.status === 'checked_in').length,
        schools: [...new Set(members.map((s) => s.school || '生源学校待补充'))]
          .map((school) => {
            const peers = members.filter(
              (s) => (s.school || '生源学校待补充') === school,
            );
            return {
              name: school,
              total: peers.length,
              checkedIn: peers.filter((s) => s.status === 'checked_in').length,
            };
          })
          .sort((a, b) => b.total - a.total),
      };
    })
    .sort((a, b) => b.total - a.total);
  const trend = buildTrend(today);
  const photoSetting = metadata.photo;
  const portraits = ['全院新生', ...new Set(active.map((s) => s.major))].map(
    (name, index) => {
      const members =
        index === 0 ? active : active.filter((s) => s.major === name);
      return {
        name,
        total: members.length,
        gender: {
          male: members.filter((s) => s.gender === '男').length,
          female: members.filter((s) => s.gender === '女').length,
          unknown: members.filter((s) => s.gender !== '男' && s.gender !== '女')
            .length,
        },
        zodiacs: countWords(members, (s) => s.zodiac),
      };
    },
  );
  const photoStudent =
    photoSetting && Date.now() < photoSetting.expiresAt
      ? arrived.find((s) => s.id === photoSetting.studentId)
      : null;
  return {
    total: active.length,
    checkedIn: arrived.length,
    pending: active.length - arrived.length,
    leave: active.filter((s) => s.status === 'leave').length,
    withdrawn: students.length - active.length,
    rate: active.length
      ? Number(((arrived.length / active.length) * 100).toFixed(1))
      : 0,
    today: today.length,
    lastHour: arrived.filter((s) => {
      const elapsed = Date.now() - new Date(iso(s.checked_in_at)).getTime();
      return elapsed >= 0 && elapsed < 3600000;
    }).length,
    portraits,
    majors: groups('major'),
    classes: groups('class_name'),
    cities,
    recent: arrived
      .sort(
        (a, b) =>
          b.checked_in_at.localeCompare(a.checked_in_at) ||
          b.ordinal - a.ordinal,
      )
      .slice(0, 5)
      .map(publicStudent),
    zodiacs: countWords(active, (s) => s.zodiac),
    nameWords: countWords(active, (s) => s.last_character),
    hobbyWords: countWords(active, (s) => parseJSON(s.hobbies)),
    hobbyEstimate: estimateHobbies(active),
    quality: {
      ...metadata.import_report,
      geography: metadata.identity_geography,
      shandong: active.filter(s => s.province === '山东省').length,
      outsideShandong: active.filter(s => s.province && s.province !== '山东省').length,
      districtKnown: active.filter(s => s.district).length,
      cityKnown: active.filter((s) => s.city).length,
      cityMissing: active.filter((s) => !s.city).length,
      birthKnown: active.filter((s) => s.birthday).length,
      hobbiesKnown: active.filter((s) => parseJSON(s.hobbies).length).length,
    },
    hourly: trend.buckets,
    trendStep: trend.step,
    photo: photoStudent ? publicStudent(photoStudent) : null,
    photoKey: photoStudent ? String(photoSetting.expiresAt) : null,
    updatedAt: new Date().toISOString(),
  };
}
export async function setAttendance(ids, status, actor) {
  const db = await pool.getConnection();
  const result = [];
  try {
    await db.beginTransaction();
    // One lock order serializes number allocation across all teachers; repeated calls are idempotent.
    const [[counter]] = await db.query(
      "SELECT value FROM counters WHERE name='registration' FOR UPDATE",
    );
    let next = counter.value;
    for (const id of [...new Set(ids)].sort()) {
      const [[student]] = await db.execute(
        'SELECT * FROM students WHERE id=? FOR UPDATE',
        [id],
      );
      if (!student)
        throw Object.assign(Error('找不到该学生，整批操作未保存'), {
          status: 404,
        });
      if (student.status !== status) {
        const ordinal =
          status === 'checked_in' ? student.ordinal || ++next : student.ordinal;
        const timestamp = status === 'checked_in' ? sqlTime() : null;
        await db.execute(
          'UPDATE students SET status=?,ordinal=?,checked_in_at=? WHERE id=?',
          [status, ordinal, timestamp, id],
        );
        await db.execute(
          'INSERT INTO audit_log(student_id,action,actor,details,created_at) VALUES (?,?,?,?,?)',
          [
            id,
            status === 'checked_in'
              ? 'check_in'
              : status === 'pending'
                ? 'undo_check_in'
                : status,
            actor,
            JSON.stringify({ before: student.status, after: status, ordinal }),
            sqlTime(),
          ],
        );
        Object.assign(student, { status, ordinal, checked_in_at: timestamp });
      }
      result.push(teacherStudent(student));
    }
    await db.execute("UPDATE counters SET value=? WHERE name='registration'", [
      next,
    ]);
    await db.commit();
    return result;
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    db.release();
  }
}
