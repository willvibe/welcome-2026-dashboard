'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import map from '@/lib/shandong-map.json';
import { layoutWords } from '@/lib/word-cloud-layout.mjs';
import type { City, Group, Portrait, Word } from '@/lib/types';
import { shortClass } from './welcome-shared';

export const CHART_COLORS = [
  '#35d6f4', '#ffab66', '#548dff', '#a392ff',
  '#4ee5c0', '#ff748f', '#93d8ff', '#ffd27c',
  '#7285ff', '#f6a3cc', '#77caaf', '#c4bbff',
];
export function PageControls({
  page,
  total,
  onChange,
  label,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <div className="a-pages">
      <button
        onClick={() => onChange((page + total - 1) % total)}
        aria-label={label + '上一组'}
      >
        <ChevronLeft size={14} />
      </button>
      <span>
        {String(page + 1).padStart(2, '0')}
        <i>/ {String(total).padStart(2, '0')}</i>
      </span>
      <button
        onClick={() => onChange((page + 1) % total)}
        aria-label={label + '下一组'}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
export function ProgressTable({
  groups,
  live,
  classes = false,
}: {
  groups: Group[];
  live: boolean;
  classes?: boolean;
}) {
  return (
    <Table className={`a-progress-table ${classes ? 'a-class-table' : ''}`}>
      <TableHeader>
        <TableRow>
          <TableHead>{classes ? '班级' : '专业'}</TableHead>
          <TableHead>应到</TableHead>
          <TableHead>实到</TableHead>
          <TableHead>报到率</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g, i) => (
          <TableRow key={g.name}>
            <TableCell>
              <span className="a-row-index">{String(i + 1).padStart(2, '0')}</span>
              <span title={g.name}>{shortClass(g.name)}</span>
            </TableCell>
            <TableCell>{g.total}</TableCell>
            <TableCell className="a-table-actual">
              {live ? g.checkedIn : '—'}
            </TableCell>
            <TableCell>
              <div className="a-rate-cell">
                <span>
                  {live ? g.rate.toFixed(1) : '—'}
                  <small>%</small>
                </span>
                <i>
                  <b style={{ width: g.rate + '%' }} />
                </i>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function Donut({
  words,
  center,
  subtitle,
  className = '',
  activeName,
}: {
  words: Word[];
  center: string;
  subtitle: string;
  className?: string;
  activeName?: string;
}) {
  const [hover, setHover] = useState<Word | null>(null);
  const total = words.reduce((n, w) => n + w.value, 0);
  const circumference = 2 * Math.PI * 63;
  let offset = 0;
  return (
    <svg
      className={`a-donut ${className}`}
      viewBox="0 0 180 180"
      role="img"
      aria-label={words.map((w) => `${w.name}${w.value}人`).join('、')}
      onMouseLeave={() => setHover(null)}
    >
      <circle cx="90" cy="90" r="79" fill="none" stroke="#ffffff07" />
      <circle
        cx="90"
        cy="90"
        r="63"
        fill="none"
        stroke="#242a35"
        strokeWidth="17"
      />
      {words.map((w, i) => {
        const length = total ? (w.value / total) * circumference : 0;
        const start = offset;
        offset += length;
        return (
          <circle
            key={w.name}
            cx="90"
            cy="90"
            r="63"
            fill="none"
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={(hover?.name || activeName) === w.name ? 23 : 17}
            strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`}
            strokeDashoffset={-start}
            transform="rotate(-90 90 90)"
            onMouseEnter={() => setHover(w)}
          >
            <title>{`${w.name} · ${w.value} 人 · ${total ? ((w.value / total) * 100).toFixed(1) : 0}%`}</title>
          </circle>
        );
      })}
      <text x="90" y="87" textAnchor="middle" className="a-donut-value">
        {hover ? hover.value : center}
      </text>
      <text x="90" y="109" textAnchor="middle" className="a-donut-caption">
        {hover ? hover.name : subtitle}
      </text>
    </svg>
  );
}
export function GenderChart({ portrait }: { portrait: Portrait }) {
  const words = [
    { name: '男生', value: portrait.gender.male },
    { name: '女生', value: portrait.gender.female },
    ...(portrait.gender.unknown
      ? [{ name: '待补充', value: portrait.gender.unknown }]
      : []),
  ];
  return (
    <div className="a-gender-body">
      <Donut
        words={words}
        center={String(portrait.total)}
        subtitle="在册新生"
      />
      <div className="a-gender-legend">
        {words.map((w, i) => (
          <div key={w.name}>
            <span>
              <i style={{ background: CHART_COLORS[i] }} />
              {w.name}
            </span>
            <strong>
              {w.value}
              <small>人</small>
            </strong>
            <b>
              {portrait.total
                ? ((w.value / portrait.total) * 100).toFixed(1)
                : 0}
              <small>%</small>
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ZodiacChart({ portrait }: { portrait: Portrait }) {
  // The donut spotlight spins through the 12 signs once per second, on its own
  // cadence so it stays lively regardless of the shared 3s board tick.
  const [fast, setFast] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setFast((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const index = fast % Math.max(1, portrait.zodiacs.length);
  const top = portrait.zodiacs[index];
  const symbols: Record<string, string> = {白羊座:'♈',金牛座:'♉',双子座:'♊',巨蟹座:'♋',狮子座:'♌',处女座:'♍',天秤座:'♎',天蝎座:'♏',射手座:'♐',摩羯座:'♑',水瓶座:'♒',双鱼座:'♓'};
  return (
    <div className="a-zodiac-body">
      <div className="a-zodiac-main">
        <Donut
          words={portrait.zodiacs}
          center={String(portrait.total)}
          subtitle="星座分布"
          activeName={top?.name}
        />
        <div className="a-zodiac-highlight" key={top?.name} style={{'--zodiac-color': CHART_COLORS[index % CHART_COLORS.length]} as CSSProperties}>
          <span className="a-zodiac-symbol" aria-hidden="true">{symbols[top?.name] || '✧'}</span>
          <strong>{top?.name || '待补充'}</strong>
          <p>
            <b>{top?.value || 0}</b> <span>位同学</span>
          </p>
          <small>
            占全院{' '}
            {portrait.total && top
              ? ((top.value / portrait.total) * 100).toFixed(1)
              : 0}
            %
          </small>
        </div>
      </div>
    </div>
  );
}
export function ZodiacBars({ portrait }: { portrait: Portrait }) {
  const max = Math.max(1, ...portrait.zodiacs.map((z) => z.value));
  const rows = portrait.zodiacs;
  // When the rows cannot all fit comfortably, loop them vertically.
  const scrolling = rows.length > 8;
  const list = scrolling ? [...rows, ...rows] : rows;
  return (
    <div
      className="a-zodiac-bars"
      role="img"
      aria-label={rows.map((z) => `${z.name}${z.value}人`).join('、')}
    >
      <div
        className={`a-zodiac-bars-track ${scrolling ? 'a-zodiac-scroll' : ''}`}
        style={
          scrolling ? { animationDuration: `${rows.length * 1.8}s` } : undefined
        }
      >
        {list.map((z, i) => (
          <div key={z.name + i} className="a-zodiac-bar-row">
            <span>{z.name}</span>
            <div className="a-zodiac-bar-track">
              <i
                style={{
                  width: `${(z.value / max) * 100}%`,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
            <b>{z.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
export function WordCloud({
  words,
  names = false,
  estimated = false,
}: {
  words: Word[];
  names?: boolean;
  estimated?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 220 });
  // Burst-and-reform choreography: the cloud assembles when it first appears,
  // then every cycle it scatters off-canvas and flies back with a stagger.
  const [seed, setSeed] = useState(0);
  const [scattered, setScattered] = useState(true);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width),
        height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0)
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // Roll a fresh silhouette per page load (after hydration, so SSR and
    // client markup stay identical) — every refresh opens on a new shape.
    setSeed(Math.floor(Math.random() * 1e6));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScattered(false);
      return;
    }
    const assemble = setTimeout(() => setScattered(false), 120);
    let burst: ReturnType<typeof setTimeout> | undefined;
    // The names cloud follows the 3s board rhythm; the hobby cloud is calmer.
    const period = setInterval(
      () => {
        setSeed((n) => n + 1);
        setScattered(true);
        burst = setTimeout(() => setScattered(false), names ? 520 : 820);
      },
      names ? 3000 : 24000,
    );
    return () => {
      clearTimeout(assemble);
      clearTimeout(burst);
      clearInterval(period);
    };
  }, [names]);
  // SSE sends new arrays even when frequencies are unchanged; keep positions stable.
  const signature = JSON.stringify(words);
  // variant = seed: every burst re-lays the cloud with new sizes/positions.
  const packed = useMemo(
    () =>
      layoutWords(
        JSON.parse(signature) as Word[],
        names,
        size.width,
        size.height,
        seed,
      ),
    [signature, names, size.width, size.height, seed],
  );
  // Each reassembly recolors the cloud with a different palette stride and
  // offset — a plain rotation would keep the same neighbor colors and look
  // unchanged, so the stride scrambles which color each word receives.
  const colorStep = [1, 5, 7, 11][seed % 4],
    colorShift = (seed * 5) % CHART_COLORS.length;
  const colorOf = (index: number) =>
    index === 0
      ? ['#eef3ff', '#ffd27c', '#a5f3e0'][seed % 3]
      : CHART_COLORS[(index * colorStep + colorShift) % CHART_COLORS.length];
  // Deterministic per-cycle scatter targets; the style rotates between four
  // choreographies (radial burst / side sweep / vortex spin / fountain).
  const style = seed % 4;
  // Every choreography returns words in its own order (inside-out, edge-in,
  // clockwise, center-out) so the stagger pattern reads differently too.
  const order = useMemo(() => {
    const cx = size.width / 2,
      cy = size.height / 2;
    const key = (word: { x: number; y: number }) => {
      switch (style) {
        case 1:
          return Math.min(word.x, size.width - word.x);
        case 2:
          return Math.atan2(word.y - cy, word.x - cx);
        case 3:
          return Math.abs(word.y - cy);
        default:
          return Math.hypot(word.x - cx, word.y - cy);
      }
    };
    const sorted = [...packed].sort((a, b) => key(a) - key(b));
    return new Map(sorted.map((word, rank) => [word.name, rank]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packed, style, size.width, size.height]);
  const scatterOf = (index: number) => {
    const rnd = (salt: number) => {
      const x = Math.sin(seed * 917.6 + index * 127.1 + salt * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const w = size.width,
      h = size.height,
      diag = Math.hypot(w, h);
    switch (style) {
      case 1: {
        // Side sweep: words exit left/right with a banking rotation.
        const side = index % 2 === 0 ? -1 : 1;
        return {
          x: w / 2 + side * (0.75 + rnd(1) * 0.7) * w,
          y: rnd(2) * h,
          rotate: side * (40 + rnd(3) * 90),
        };
      }
      case 2: {
        // Vortex: everything spirals out with extra spin.
        const angle = rnd(1) * Math.PI * 2 + seed * 1.7,
          reach = (0.75 + rnd(2) * 0.75) * diag;
        return {
          x: w / 2 + Math.cos(angle) * reach,
          y: h / 2 + Math.sin(angle) * reach,
          rotate: (rnd(3) > 0.5 ? 1 : -1) * (260 + rnd(4) * 320),
        };
      }
      case 3: {
        // Fountain: words jet off the top and bottom edges with drift.
        const up = rnd(3) > 0.5 ? -1 : 1;
        return {
          x: rnd(1) * w * 1.5 - w * 0.25,
          y: h / 2 + up * (0.9 + rnd(2) * 0.85) * h,
          rotate: (rnd(4) - 0.5) * 100,
        };
      }
      default: {
        // Radial burst with tumbling.
        const angle = rnd(1) * Math.PI * 2,
          reach = (0.8 + rnd(2) * 0.9) * diag;
        return {
          x: w / 2 + Math.cos(angle) * reach,
          y: h / 2 + Math.sin(angle) * reach,
          rotate: (rnd(3) - 0.5) * 140,
        };
      }
    }
  };
  return (
    <div className="a-word-cloud-viewport" ref={viewport}>
      <svg
        className={`a-word-cloud a-word-burst-s${style}${scattered ? ' a-word-cloud-burst' : ''}`}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={
          names ? '新生名字最后一个字的词频分布' : '兴趣特长关键词人数'
        }
      >
        {packed.map((w) => {
          const sc = scatterOf(w.index);
          return (
            <g
              key={w.name}
              className={scattered ? 'a-word-out' : undefined}
              style={{ '--i': order.get(w.name) ?? w.index } as CSSProperties}
              transform={`translate(${scattered ? sc.x : w.x} ${scattered ? sc.y : w.y}) rotate(${scattered ? sc.rotate : 0})`}
            >
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill={colorOf(w.index)}
                fontSize={w.size}
                fontWeight={w.index < 3 ? 600 : names ? 500 : 400}
                className="a-floating-word"
                style={{ '--delay': `${-w.index * 0.61}s` } as CSSProperties}
                tabIndex={0}
                aria-label={`${w.name}，${estimated ? '估算约' : ''}${w.value}人`}
              >
                <title>{`${w.name} · ${estimated ? '估算约 ' : ''}${w.value} 人`}</title>
                {w.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
// Hobby tags are grouped into six broad categories for the radar view.
const HOBBY_CATEGORIES: [string, string[]][] = [
  [
    '运动',
    [
      '运动',
      '羽毛球',
      '篮球',
      '跑步',
      '乒乓球',
      '健身',
      '足球',
      '游泳',
      '骑行',
      '登山',
      '排球',
    ],
  ],
  ['音乐', ['音乐', '唱歌', '吉他', '钢琴', '古筝']],
  ['舞蹈', ['舞蹈']],
  ['书画', ['绘画', '书法', '手工']],
  ['影像', ['摄影', '剪辑', '影视', '动漫']],
  [
    '生活',
    [
      '阅读',
      '写作',
      '旅行',
      '烹饪',
      '游戏',
      '演讲',
      '主持',
      '围棋',
      '象棋',
      '剧本杀',
    ],
  ],
];
export function InterestRadar({ words, categories }: { words: Word[]; categories?: Word[] }) {
  const values = useMemo(() => {
    if (categories) return categories;
    const totals = new Map(words.map((w) => [w.name, w.value]));
    return HOBBY_CATEGORIES.map(([name, tags]) => ({
      name,
      value: tags.reduce((n, t) => n + (totals.get(t) || 0), 0),
    }));
  }, [words, categories]);
  const max = Math.max(1, ...values.map((v) => v.value));
  const point = (i: number, r: number) => [
    180 + Math.sin((i * Math.PI) / 3) * r,
    116 - Math.cos((i * Math.PI) / 3) * r,
  ];
  const polygon = (scale: number) =>
    values.map((_, i) => point(i, 76 * scale).join(',')).join(' ');
  return (
    <svg
      className="a-interest-radar"
      viewBox="0 0 360 235"
      role="img"
      aria-label="新生六类兴趣估算人数雷达图，各类别内按学生去重"
    >
      <defs>
        <linearGradient id="a-radar-fill" x1="0" y1="0" x2="1" y2="1">
          {values.map((v, i) => (
            <stop
              key={v.name}
              offset={`${(i / Math.max(1, values.length - 1)) * 100}%`}
              stopColor={CHART_COLORS[i % CHART_COLORS.length]}
              stopOpacity=".42"
            />
          ))}
        </linearGradient>
        <linearGradient id="a-radar-stroke" x1="0" y1="0" x2="1" y2="1">
          {values.map((v, i) => (
            <stop
              key={v.name}
              offset={`${(i / Math.max(1, values.length - 1)) * 100}%`}
              stopColor={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))}
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={polygon(s)}
          fill="none"
          stroke="#414a5c"
          strokeOpacity=".6"
        />
      ))}
      {values.map((v, i) => {
        const p = point(i, 76),
          label = point(i, 103);
        return (
          <g key={v.name}>
            <line
              x1="180"
              y1="116"
              x2={p[0]}
              y2={p[1]}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeOpacity=".35"
            />
            <text
              x={label[0]}
              y={label[1]}
              textAnchor="middle"
              className="a-radar-label"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
            >
              {v.name}
              <tspan x={label[0]} dy="15" fill="#dff3ff">
                约{v.value}人
              </tspan>
            </text>
          </g>
        );
      })}
      <polygon
        points={values
          .map((v, i) => point(i, (76 * v.value) / max).join(','))
          .join(' ')}
        fill="url(#a-radar-fill)"
        stroke="url(#a-radar-stroke)"
        strokeWidth="2"
      />
      {values.map((v, i) => {
        const p = point(i, (76 * v.value) / max);
        return (
          <circle
            key={v.name}
            cx={p[0]}
            cy={p[1]}
            r="3.5"
            fill={CHART_COLORS[i % CHART_COLORS.length]}
          >
            <title>{`${v.name} · ${v.value} 人`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
export function HourlyTrend({
  hourly,
  live,
}: {
  hourly: { hour: string; count: number }[];
  live: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(
    4,
    Math.ceil(Math.max(...hourly.map((h) => h.count), 0) / 4) * 4,
  );
  const plot = { left: 30, right: 420, top: 16, bottom: 138 };
  const x = (i: number) =>
      plot.left + (i / (hourly.length - 1 || 1)) * (plot.right - plot.left),
    y = (v: number) => plot.bottom - (v / max) * (plot.bottom - plot.top);
  // Adaptive bucket count: pick evenly spaced labels that always fit —
  // first/last anchor to the plot edges so no label is clipped.
  const labelCount = Math.min(
    6,
    Math.max(3, Math.floor((plot.right - plot.left) / 68)),
  );
  const labelIdx = [
    ...new Set(
      Array.from({ length: labelCount }, (_, k) =>
        Math.round((k * (hourly.length - 1)) / (labelCount - 1 || 1)),
      ),
    ),
  ];
  const slot = (plot.right - plot.left) / Math.max(1, hourly.length - 1);
  const hoverWidth = Math.max(6, Math.min(16, slot));
  const line = hourly
    .map((h, i) => `${i ? 'L' : 'M'}${x(i)},${y(h.count)}`)
    .join(' ');
  return (
    <svg
      className="a-trend-chart"
      viewBox="0 0 440 170"
      role="img"
      aria-label={live ? '今日分时报到人数折线图' : '报到服务连接中'}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="a-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#a5bfff" stopOpacity=".25" />
          <stop offset="1" stopColor="#a5bfff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((n) => (
        <g key={n}>
          <line
            x1={plot.left}
            x2={plot.right}
            y1={y((n * max) / 4)}
            y2={y((n * max) / 4)}
            stroke="#ffffff0e"
            strokeDasharray="3 5"
          />
          <text
            x="20"
            y={y((n * max) / 4) + 4}
            textAnchor="end"
            className="a-chart-label"
          >
            {(n * max) / 4}
          </text>
        </g>
      ))}
      {labelIdx
        .filter((i) => i < hourly.length)
        .map((i, k, all) => (
          <text
            x={x(i)}
            y="161"
            textAnchor={
              k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'middle'
            }
            key={i}
            className="a-chart-label"
          >
            {hourly[i].hour}
          </text>
        ))}
      {live && (
        <>
          <path
            d={`${line} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`}
            fill="url(#a-trend-fill)"
          />
          <path
            d={line}
            fill="none"
            stroke="#b0c7fc"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {hourly.map((h, i) => (
            <rect
              key={h.hour}
              x={x(i) - hoverWidth / 2}
              y={plot.top}
              width={hoverWidth}
              height={plot.bottom - plot.top + 4}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            >
              <title>{`${h.hour} · ${h.count}人`}</title>
            </rect>
          ))}
          {hover !== null && hourly[hover] && (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={plot.top}
                y2={plot.bottom}
                stroke="#a5bfff"
                strokeOpacity=".3"
              />
              <circle
                cx={x(hover)}
                cy={y(hourly[hover].count)}
                r="4"
                fill="#e6edff"
              />
              <text
                x={Math.min(385, Math.max(65, x(hover)))}
                y="12"
                textAnchor="middle"
                fill="#d2ddf5"
                fontSize="12"
              >
                {hourly[hover].hour} · {hourly[hover].count} 人
              </text>
            </g>
          )}
        </>
      )}
    </svg>
  );
}
// Heat ramp assembled from the shared chart palette: deep blue → blue →
// cyan → gold → orange → coral red, mirroring the word cloud's cold-to-warm
// range so the hottest regions read unmistakably red.
const HEAT_STOPS: [number, string][] = [
  [0, '#1d2c48'],
  [0.28, '#548dff'],
  [0.5, '#35d6f4'],
  [0.7, '#ffd27c'],
  [0.85, '#ffab66'],
  [1, '#ff748f'],
];
const heatColor = (t: number) => {
  const clamped = Math.max(0, Math.min(1, t));
  const channel = (hex: string, n: number) => parseInt(hex.slice(n, n + 2), 16);
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    if (clamped <= HEAT_STOPS[i][0]) {
      const [t0, c0] = HEAT_STOPS[i - 1],
        [t1, c1] = HEAT_STOPS[i],
        mix = (clamped - t0) / (t1 - t0);
      const rgb = [1, 3, 5].map((n) =>
        Math.round(channel(c0, n) + (channel(c1, n) - channel(c0, n)) * mix),
      );
      return `rgb(${rgb.join(' ')})`;
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
};
export function ShandongMap({
  cities,
  selected,
  onSelect,
}: {
  cities: City[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const max = Math.max(1, ...cities.map((c) => c.total));
  // Square-root scaling spreads the many low-count cities across the ramp.
  const heat = (total: number) => Math.sqrt(total / max);
  return (
    <svg
      className="a-shandong"
      viewBox="-35 -12 850 545"
      role="img"
      aria-label="山东省同乡热力图，悬停、点击或使用Tab键查看地区区县"
    >
      <defs>
        <filter id="a-map-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow
            dx="0"
            dy="16"
            stdDeviation="15"
            floodColor="#000"
            floodOpacity=".45"
          />
        </filter>
        <linearGradient id="a-map-selected" x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#ffe4b0" />
          <stop offset="1" stopColor="#ff748f" />
        </linearGradient>
      </defs>
      <g className="a-map-graticule" stroke="#849cc512" fill="none">
        {[100, 200, 300, 400].map((y) => (
          <path key={y} d={`M20 ${y} Q390 ${y + 60} 780 ${y - 15}`} />
        ))}
        {[150, 300, 450, 600].map((x) => (
          <path key={x} d={`M${x} 15 Q${x + 35} 250 ${x - 15} 500`} />
        ))}
      </g>
      <g transform="translate(0 8)">
        {map.map((f) => (
          <path
            key={f.name}
            d={f.path}
            fill="#101a2b"
            stroke="#2a3b55"
            strokeWidth=".6"
          />
        ))}
      </g>
      <g filter="url(#a-map-shadow)">
        {map.map((f) => {
          const city = cities.find((c) => c.name === f.name),
            level = heat(city?.total || 0);
          return (
            <path
              key={f.name}
              d={f.path}
              fill={
                selected === f.name ? 'url(#a-map-selected)' : heatColor(level)
              }
              stroke={selected === f.name ? '#ffe9c6' : '#ffffff2b'}
              strokeWidth={selected === f.name ? 1.8 : 0.7}
              tabIndex={0}
              role="button"
              aria-label={`${f.name} ${city?.total || 0}位同乡，查看区县生源`}
              onMouseEnter={() => onSelect(f.name)}
              onFocus={() => onSelect(f.name)}
              onClick={() => onSelect(f.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(f.name);
                }
              }}
            />
          );
        })}
      </g>
      <g pointerEvents="none">
        {map.map((f) => {
          const city = cities.find((c) => c.name === f.name),
            active = f.name === selected,
            // Hot fills need dark labels to stay legible.
            hot = active || heat(city?.total || 0) > 0.58;
          return (
            <g
              key={f.name}
              transform={`translate(${f.center[0]} ${f.center[1]})`}
            >
              <text
                textAnchor="middle"
                y="-3"
                fontSize="15"
                fontWeight={active ? 600 : 400}
                fill={hot ? '#15233f' : '#e6eefb'}
              >
                {f.name.replace('市', '')}
              </text>
              <text
                textAnchor="middle"
                y="17"
                fontSize="12"
                fill={hot ? '#2c3f60' : '#a9bdd9'}
              >
                {city?.total || 0}人
              </text>
              {active && (
                <>
                  <circle cy="29" r="3" fill="#e9f2ff" />
                  <circle
                    cy="29"
                    r="8"
                    className="a-map-beacon"
                    fill="none"
                    stroke="#eef5ff"
                    strokeOpacity=".6"
                  />
                </>
              )}
            </g>
          );
        })}
      </g>
      <text x="274" y="38" fill="#5f6d815e" fontSize="17" letterSpacing="12">
        渤海
      </text>
      <text x="675" y="270" fill="#5f6d815e" fontSize="17" letterSpacing="12">
        黄海
      </text>
      <g
        transform="translate(768 45)"
        fill="none"
        stroke="#69778c"
        strokeWidth=".8"
      >
        <path d="M0 19V-9M-4-1L0-9 4-1" />
        <text
          x="0"
          y="-18"
          textAnchor="middle"
          fill="#97a4b9"
          stroke="none"
          fontSize="11"
        >
          N
        </text>
      </g>
    </svg>
  );
}
