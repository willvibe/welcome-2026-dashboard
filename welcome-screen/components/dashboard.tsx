'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Camera,
  CircleHelp,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  GenderChart,
  HourlyTrend,
  InterestRadar,
  PageControls,
  ProgressTable,
  ShandongMap,
  WordCloud,
  ZodiacChart,
} from './arrival-charts';
import { PhotoCard, shortClass } from './welcome-shared';
import { ArrivalFeed } from './arrival-feed';
import { DistrictList } from './school-list';
import type { Arrival, Stats } from '@/lib/types';
import initialStats from '@/lib/initial-stats.json';

function Panel({
  title,
  children,
  extra,
  className = '',
}: {
  title: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`a-panel ${className}`}>
      <header className="a-panel-header">
        <h2>{title}</h2>
        {extra}
      </header>
      {children}
    </section>
  );
}
const mod = (a: number, n: number) => ((a % n) + n) % n;
export default function Dashboard() {
  const [stats, setStats] = useState<Stats>(initialStats as Stats),
    [live, setLive] = useState(false),
    [clock, setClock] = useState('--:--:--'),
    [date, setDate] = useState('2026 新生报到季');
  // One shared 3s tick drives every rotation on the screen so all modules
  // switch in sync. Manual controls shift an offset instead of fighting it.
  const [paused, setPaused] = useState(false),
    [tick, setTick] = useState(0),
    [classOffset, setClassOffset] = useState(0),
    [genderOffset, setGenderOffset] = useState(0),
    [interestOffset, setInterestOffset] = useState(0);
  const [cityPick, setCityPick] = useState<{ name: string; at: number } | null>(
      null,
    ),
    [help, setHelp] = useState(false),
    [full, setFull] = useState(false),
    [notice, setNotice] = useState('');
  const [cityHovered, setCityHovered] = useState(false),
    [cityFocused, setCityFocused] = useState(false);
  const [photo, setPhoto] = useState<Arrival | null>(null),
    [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('zh-CN', { hour12: false }));
      setDate(
        now.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'long',
        }),
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    const stream = new EventSource('/api/events');
    stream.addEventListener('stats', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setStats({ ...initialStats, ...data });
      setLive(true);
    });
    stream.onerror = () => setLive(false);
    const fullscreen = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      clearInterval(timer);
      stream.close();
      document.removeEventListener('fullscreenchange', fullscreen);
    };
  }, []);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(timer);
  }, [paused]);
  // Classes rotate per major: each page shows exactly one major's classes.
  const classGroups = stats.majors
    .map((m) => ({
      major: m.name,
      classes: stats.classes.filter((c) => c.name.includes(m.name)),
    }))
    .filter((g) => g.classes.length);
  const classPages = Math.max(1, classGroups.length);
  const portraits = stats.portraits || initialStats.portraits;
  const genders = portraits.slice(1);
  const classPage = mod(tick + classOffset, classPages),
    classGroup = classGroups[classPage] || { major: '', classes: [] },
    genderPage = mod(tick + genderOffset, Math.max(1, genders.length)),
    interestMode = mod(tick + interestOffset, 2) === 0 ? 'cloud' : 'radar';
  // The map tours every city with known students; a manual hover/click holds
  // the selection for 15s before the tour resumes.
  const cityNames = stats.cities.map((c) => c.name);
  const selected =
    cityPick && (cityHovered || cityFocused || Date.now() - cityPick.at < 15000)
      ? cityPick.name
      : cityNames.length
        ? cityNames[mod(tick, cityNames.length)]
        : '济南市';
  const gender = genders[genderPage] || portraits[0],
    zodiac = portraits[0];
  const city = stats.cities.find((c) => c.name === selected) || {
    name: selected,
    total: 0,
    checkedIn: 0,
    schools: [],
    districts: [],
    province: null,
  };
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice('当前浏览器不支持全屏，请按 F11 展示。');
    }
  };
  const remoteKey = stats.photo
    ? stats.photoKey || `${stats.photo.id}:${stats.photo.checkedInAt}`
    : null;
  const activePhoto =
    photo || (stats.photo && remoteKey !== dismissed ? stats.photo : null);
  const peak = stats.hourly.reduce(
    (best, h) => (h.count > best.count ? h : best),
    { hour: '—', count: 0 },
  );
  const repeatedNames = stats.nameWords.filter(w => w.value > 1).slice(0, 10);
  const cloudLead = repeatedNames[mod(tick, Math.max(1, repeatedNames.length))];
  const hobbyEstimate = stats.hobbyEstimate;
  const hobbyLeaders = hobbyEstimate.words.slice(0, 6);
  const hobbyLead = hobbyLeaders[mod(tick, Math.max(1, hobbyLeaders.length))];
  return (
    <main className="arrival-screen">
      <header className="a-header">
        <a className="a-brand" href="/">
          <span className="a-brand-symbol">
            <img src="/college-logo.png" alt="数智科技产业学院标志" />
          </span>
          <span className="a-brand-name">数智科技产业学院<small>COLLEGE OF DIGITAL INTELLIGENCE</small></span>
        </a>
        <div className="a-title">
          <span className="a-title-frame" aria-hidden="true" />
          <h1>
            <span>2026年迎新数据中心</span>
          </h1>
        </div>
        <div className="a-header-side">
          <div className="a-clock">
            <strong>{clock}</strong>
            <div>
              <i className={live ? 'a-online' : 'a-offline'} />
              <span>{date}</span>
            </div>
          </div>
          <button
            className="a-fullscreen-btn"
            aria-label={full ? '退出全屏' : '全屏展示'}
            title={full ? '退出全屏' : '全屏展示'}
            onClick={toggleFull}
          >
            {full ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </header>
      <div className="a-board">
        <aside className="a-left">
          <Panel
            title="各专业报到明细"
            extra={
              <span className="a-count-tag">{stats.majors.length} 专业</span>
            }
            className="a-major-panel"
          >
            <ProgressTable groups={stats.majors} live={live} />
            <div className="a-panel-bottom">
              <span>全院待报到</span>
              <b>
                {live ? stats.pending : '—'} <small>人</small>
              </b>
            </div>
          </Panel>
          <Panel
            title="各班级报到明细"
            extra={
              <PageControls
                page={classPage}
                total={classPages}
                onChange={(p) => setClassOffset(mod(p - tick, classPages))}
                label="班级"
              />
            }
            className="a-classes-panel"
          >
            <div className="a-cohort-label" key={classGroup.major}>
              <span>{shortClass(classGroup.major)}</span>
              <i>{classGroup.classes.length} 个班</i>
            </div>
            <ProgressTable classes groups={classGroup.classes} live={live} />
            <div className="a-panel-bottom">
              <span>
                <i className="a-small-dot" />
                {paused ? '轮播已暂停' : '每 3 秒按专业轮播'}
              </span>
              <span>{stats.classes.length} 个班级</span>
            </div>
          </Panel>
          <Panel
            title="各专业性别比例"
            extra={
              <PageControls
                page={genderPage}
                total={genders.length}
                onChange={(p) =>
                  setGenderOffset(mod(p - tick, Math.max(1, genders.length)))
                }
                label="专业性别比例"
              />
            }
            className="a-gender-panel"
          >
            <div className="a-cohort-label" key={gender.name}>
              <span>{gender.name}</span>
              <i>2026 级</i>
            </div>
            <GenderChart portrait={gender} />
            <div className="a-panel-bottom">
              <span>在册新生 · 按专业轮播</span>
              <span>3s</span>
            </div>
          </Panel>
        </aside>
        <section className="a-center">
          <section className="a-metrics" aria-label="全院实时报到核心指标">
            <article>
              <div className="a-metric-label">
                应报到人数<span>01</span>
              </div>
              <p>
                {stats.total}
                <small>人</small>
              </p>
              <footer>
                <b>{stats.majors.length}</b> 个专业
                <i />
                {stats.classes.length} 个班级
              </footer>
            </article>
            <article>
              <div className="a-metric-label">
                已实到人数<span>02</span>
              </div>
              <p className="a-accent-number">
                {live ? stats.checkedIn : '—'}
                <small>人</small>
              </p>
              <footer>
                <i className="a-online" />
                每一份抵达，都被记录
              </footer>
            </article>
            <article>
              <div className="a-metric-label">
                今日入校速度<span>03</span>
              </div>
              <p>
                {live ? stats.lastHour : '—'}
                <small>人 / 小时</small>
              </p>
              <footer>
                近 60 分钟
                <i />
                今日 {live ? stats.today : '—'} 人
              </footer>
            </article>
            <article className="a-rate-metric">
              <div className="a-metric-label">
                全院报到率<span>04</span>
              </div>
              <p className="a-accent-number">
                {live ? stats.rate.toFixed(1) : '—'}
                <small>%</small>
              </p>
              <footer>
                <div className="a-overall-progress">
                  <i style={{ width: stats.rate + '%' }} />
                </div>
                <span>实时</span>
              </footer>
            </article>
          </section>
          <Panel
            title="同乡相逢，山海不远"
            extra={<span className="a-map-region">山东省</span>}
            className="a-map-panel"
          >
            <div className="a-map-area">
              <ShandongMap
                cities={stats.cities}
                selected={selected}
                onSelect={(name) => setCityPick({ name, at: Date.now() })}
              />
              <div
                className="a-hometown-card"
                onMouseEnter={() => {
                  setCityHovered(true);
                  setCityPick({ name: selected, at: Date.now() });
                }}
                onMouseLeave={() => {
                  setCityHovered(false);
                  setCityPick({ name: selected, at: Date.now() });
                }}
                onFocusCapture={() => {
                  setCityFocused(true);
                  setCityPick({ name: selected, at: Date.now() });
                }}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setCityFocused(false);
                    setCityPick({ name: selected, at: Date.now() });
                  }
                }}
              >
                <header>
                  <span>{city.name}</span>
                  <i>{city.province === '山东省' ? '同乡档案' : city.province || '同乡档案'}</i>
                </header>
                <div className="a-hometown-number">
                  <b>{city.total}</b>
                  <span>
                    位同乡<small>已报到 {live ? city.checkedIn : '—'} 人</small>
                  </span>
                </div>
                <DistrictList
                  city={city}
                  paused={paused || cityHovered || cityFocused}
                />
                <footer>
                  {city.districts.length} 个区县分组
                  <span>滚动查看</span>
                </footer>
              </div>
              <div className="a-map-legend">
                <span>生源人数</span>
                <div>
                  <small>少</small>
                  <i />
                  <small>多</small>
                </div>
              </div>
              <span className="a-map-coordinate">
                36° N &nbsp; / &nbsp; 118° E
              </span>
            </div>
            <div className="a-map-caption">
              <span>
                <i className="a-small-dot" />
                山东 {stats.quality.shandong} 人 · 省外 {stats.quality.outsideShandong} 人 · 招生优先 · 地址码补缺
              </span>
              <span>地理数据 © DataV / 高德</span>
            </div>
          </Panel>
          <div className="a-center-bottom">
            <Panel
              title="分时报到趋势"
              extra={
                <span className="a-chart-unit">
                  {live && stats.trendStep
                    ? `每格 ${stats.trendStep} 分钟`
                    : '08:30 — 16:30'}
                </span>
              }
              className="a-trend-panel"
            >
              <div className="a-trend-summary">
                <p>
                  <b>{live ? stats.today : '—'}</b>
                  <span>今日累计报到</span>
                </p>
                <span>
                  {peak.count
                    ? `峰值 ${peak.hour} · ${peak.count} 人`
                    : '静候今日的第一份抵达'}
                </span>
              </div>
              <HourlyTrend hourly={stats.hourly} live={live} />
            </Panel>
            <Panel
              title="实时报到动态"
              extra={
                <span className="a-recent-status">
                  <i className={live ? 'a-online' : 'a-offline'} />
                  最近 5 位
                </span>
              }
              className="a-arrivals-panel"
            >
              <div className="a-arrival-head">
                <span>姓名</span>
                <span>班级</span>
                <span>报到顺序</span>
                <span>来自</span>
              </div>
              <ArrivalFeed
                recent={stats.recent}
                checkedIn={stats.checkedIn}
                live={live}
                onSelect={setPhoto}
              />
            </Panel>
          </div>
        </section>
        <aside className="a-right">
          <Panel
            title="名字里的奇妙缘分"
            extra={<span className="a-mini-star">✳</span>}
            className="a-names-panel"
          >
            <WordCloud words={stats.nameWords} names />
            <div className="a-word-insight">
              <span>「{cloudLead?.name || '缘'}」</span>
              <p key={cloudLead?.name}>{cloudLead ? `${cloudLead.value} 位同学共享名字尾字 · TOP ${mod(tick, repeatedNames.length) + 1}` : '每一个名字，都独一无二'}</p>
            </div>
          </Panel>
          <Panel
            title="星座相遇指南"
            extra={
              <span className="a-count-tag">
                12 星座 · 1s
              </span>
            }
            className="a-stars-panel"
          >
            <div className="a-cohort-label" key={zodiac.name}>
              <span>{zodiac.name}</span>
              <i>{zodiac.total} 人</i>
            </div>
            <ZodiacChart portrait={zodiac} />
            <div className="a-panel-bottom">
              <span>寻找你的星座同伴</span>
              <span>公历生日 · 3s</span>
            </div>
          </Panel>
          <Panel
            title="让热爱找到同频"
            extra={
              <Tabs
                value={interestMode}
                onValueChange={(v) =>
                  setInterestOffset(
                    mod((v === 'cloud' ? 0 : 1) - mod(tick, 2), 2),
                  )
                }
              >
                <TabsList className="a-chart-tabs">
                  <TabsTrigger value="cloud">词云</TabsTrigger>
                  <TabsTrigger value="radar">雷达</TabsTrigger>
                </TabsList>
              </Tabs>
            }
            className="a-interests-panel"
          >
            <div className="a-interest-view">
              {interestMode === 'cloud' ? (
                <WordCloud words={hobbyEstimate.words} estimated />
              ) : (
                <InterestRadar words={hobbyEstimate.words} categories={hobbyEstimate.radar} />
              )}
            </div>
            <div className="a-word-insight">
              <Sparkles size={14} />
              <p>
                {hobbyLead ? `约 ${hobbyLead.value} 位同学热爱${hobbyLead.name}` : '等待同学们分享热爱'}
              </p>
            </div>
          </Panel>
        </aside>
      </div>
      <footer className="a-footer">
        <span>
          <i className={live ? 'a-online' : 'a-offline'} />
          {live ? 'LIVE · 实时数据连接中' : 'OFFLINE · 正在重新连接'}
        </span>
        <p>相遇是序章，未来由你书写。</p>
        <nav>
          <button onClick={() => setPaused(!paused)}>
            {paused ? <Play size={13} /> : <Pause size={13} />}{' '}
            {paused ? '继续轮播' : '暂停轮播'}
          </button>
          <button onClick={() => setHelp(true)} aria-label="数据说明">
            <CircleHelp size={14} />
          </button>
          <a
            href="/card"
            aria-label="我的合影卡"
            title="我的合影卡 · 学生查询"
          >
            <Camera size={14} />
          </a>
          <a
            href="/admin"
            target="_blank"
            rel="noreferrer"
            aria-label="教师工作台"
            title="教师工作台"
          >
            <Settings2 size={14} />
          </a>
          <button
            aria-label={full ? '退出全屏' : '全屏展示'}
            title={full ? '退出全屏' : '全屏展示'}
            onClick={toggleFull}
          >
            {full ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </nav>
      </footer>
      {notice && (
        <div className="a-notice" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="关闭消息">
            <X size={15} />
          </button>
        </div>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="data-dialog">
          <DialogTitle>数据统计说明</DialogTitle>
          <DialogDescription>
            统计基于 2026 级新生名册及招生资料。
          </DialogDescription>
          <ul>
            <li>
              应报到 {stats.total}{' '}
              人，报到率按当前有效报到人数计算。入校速度为最近 60
              分钟完成报到的当前有效人数。
            </li>
            <li>
              生源地区优先采用招生汇总表的考生地区与区县，缺失的按身份证前六位地址码补充至省、市、区县；均不代表现居地。省外生源也参与地区卡片轮播。
            </li>
            <li>
              性别比例按专业每 3 秒轮播；星座展示全院分布，右侧数量每 1
              秒轮播，以公历生日计算。
            </li>
            <li>
              名字尾字前十名每 3 秒轮播；兴趣人数按已填写兴趣的学生比例推算至当前在册总人数，仅为估算。每人每个标签、每个雷达类别只计一次，多选兴趣人数之和可超过总人数。报到数据每 3 秒刷新，教师操作即时同步。
            </li>
            <li>
              点击最近报到学生可打开专属合影卡。报到序号首次确认时分配，撤销重报仍保留。
            </li>
          </ul>
        </DialogContent>
      </Dialog>
      {activePhoto && (
        <PhotoCard
          student={activePhoto}
          onClose={() => {
            setPhoto(null);
            if (stats.photo) setDismissed(remoteKey);
          }}
        />
      )}
    </main>
  );
}
