'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import divisions from '@/lib/china-regions.json';
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  GraduationCap,
  LoaderCircle,
  LogOut,
  MapPin,
  Monitor,
  Pencil,
  Radio,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { CardStage, PhotoCard, shortClass } from '@/components/welcome-shared';
import type { Arrival, Stats, Student } from '@/lib/types';

async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = (await response.json()) as {
    error?: string;
    user: string;
    major?: string | null;
    students: Student[];
    total: number;
    logs: Log[];
  };
  if (!response.ok)
    throw Object.assign(Error(data.error || '操作失败'), {
      status: response.status,
    });
  return data;
}
function FilterSelect({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(String(v))}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger className="filter-select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
type Log = {
  id: number;
  action: string;
  actor: string;
  created_at: string;
  name: string;
  class_name: string;
};
// "Remember me": credentials are kept (obfuscated) in localStorage so the desk
// can silently re-login after a session expires or the server restarts.
const REMEMBER_KEY = 'welcome_remember';
function saveRemembered(username: string, password: string) {
  try {
    localStorage.setItem(
      REMEMBER_KEY,
      btoa(encodeURIComponent(JSON.stringify({ username, password }))),
    );
  } catch {}
}
function readRemembered(): { username: string; password: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const saved = JSON.parse(decodeURIComponent(atob(raw))) as {
      username?: unknown;
      password?: unknown;
    };
    if (typeof saved.username !== 'string' || typeof saved.password !== 'string')
      return null;
    return { username: saved.username, password: saved.password };
  } catch {
    return null;
  }
}
function clearRemembered() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {}
}
export default function TeacherDesk() {
  const [user, setUser] = useState<string | null>(null),
    [scope, setScope] = useState<string | null>(null),
    [checking, setChecking] = useState(true),
    [password, setPassword] = useState(''),
    [username, setUsername] = useState(''),
    [remember, setRemember] = useState(true);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [online, setOnline] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null),
    [rows, setRows] = useState<Student[]>([]),
    [logs, setLogs] = useState<Log[]>([]);
  const [query, setQuery] = useState(''),
    [major, setMajor] = useState('all'),
    [className, setClassName] = useState('all'),
    [status, setStatus] = useState('all'),
    [page, setPage] = useState(0),
    [tab, setTab] = useState('students');
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [confirm, setConfirm] = useState<{
      students: Student[];
      status: Student['status'];
    } | null>(null);
  const [profile, setProfile] = useState<Student | null>(null),
    [province, setProvince] = useState('unknown'),
    [city, setCity] = useState('unknown'),
    [district, setDistrict] = useState(''),
    [school, setSchool] = useState('');
  const [photo, setPhoto] = useState<Arrival | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        q: query,
        major: major === 'all' ? '' : major,
        className: className === 'all' ? '' : className,
        status: status === 'all' ? '' : status,
      });
      try {
        const d = await api(
          '/students?' + params,
          undefined,
          undefined,
          signal,
        );
        setRows(d.students);
        setSelected(new Set());
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        if ((e as { status?: number }).status === 401) setUser(null);
        setError((e as Error).message);
      }
    },
    [query, major, className, status],
  );
  useEffect(() => {
    api('/session')
      .then((d) => {
        setUser(d.user);
        setScope(d.major ?? null);
        if (d.major) setMajor(d.major);
      })
      .catch(() => {
        // Session expired or server restarted: silently re-login with the
        // remembered credentials, then wipe them if they no longer work.
        const saved = readRemembered();
        if (!saved) return;
        setUsername(saved.username);
        setPassword(saved.password);
        setRemember(true);
        return api('/login', 'POST', saved)
          .then((d) => {
            setUser(d.user);
            setScope(d.major ?? null);
            if (d.major) setMajor(d.major);
            setPassword('');
          })
          .catch(() => clearRemembered());
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(
      () =>
        load(controller.signal).finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [user, load]);
  useEffect(() => {
    if (!user) return;
    const stream = new EventSource('/api/events');
    stream.addEventListener('stats', (e) => {
      setStats(JSON.parse((e as MessageEvent).data));
      setOnline(true);
    });
    stream.onerror = () => setOnline(false);
    return () => stream.close();
  }, [user]);
  // Refresh after another teacher changes attendance, without clearing the current checkbox selection every heartbeat.
  const remoteRevision = stats
    ? `${stats.checkedIn}:${stats.recent.map((s) => s.id + s.checkedInAt).join(',')}`
    : '';
  // Hold the latest load in a ref: this effect must fire only when the server
  // revision actually changes. Depending on `load` directly re-fires it on
  // every keystroke (load's identity changes with the filters), bypassing the
  // 200ms debounce above and doubling every search request.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!user || !remoteRevision) return;
    void loadRef.current();
  }, [remoteRevision, user]);
  useEffect(() => {
    setPage(0);
  }, [query, major, className, status]);
  useEffect(() => {
    if (!user || tab !== 'logs') return;
    api('/audit')
      .then((d) => setLogs(d.logs))
      .catch((e) => setError(e.message));
  }, [user, tab, remoteRevision]);
  useEffect(() => {
    if (!user) return;
    type ModelContext = {
      registerTool: (
        tool: unknown,
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'search_new_students',
          title: '查找新生',
          description:
            '在已登录的教师工作台查找学生，返回用于确认身份的班级与报到状态，并更新搜索结果。',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string', maxLength: 80 } },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: unknown) => {
            const q = (input as { query?: unknown })?.query;
            if (typeof q !== 'string' || q.length > 80)
              throw Error('query must be a string of at most 80 characters');
            const data = await api('/students?' + new URLSearchParams({ q }));
            setQuery(q);
            setMajor('all');
            setClassName('all');
            setStatus('all');
            setPage(0);
            setRows(data.students);
            return {
              total: data.total,
              students: data.students.map((s: Student) => ({
                id: s.id,
                name: s.name,
                className: s.className,
                status: s.status,
                ordinal: s.ordinal,
              })),
            };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, [user]);
  const STATUS_TEXT: Record<Student['status'], string> = {
    pending: '待报到',
    checked_in: '已报到',
    leave: '请假',
    withdrawn: '退学',
  };
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api('/login', 'POST', { username, password });
      setUser(d.user);
      setScope(d.major ?? null);
      if (d.major) setMajor(d.major);
      if (remember) saveRemembered(username, password);
      else clearRemembered();
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function attendance() {
    if (!confirm) return;
    setBusy(true);
    setError('');
    try {
      const d = await api('/attendance', 'POST', {
        ids: confirm.students.map((s) => s.id),
        status: confirm.status,
      });
      const count = d.students.length;
      setMessage(
        confirm.status === 'checked_in'
          ? `已确认 ${count} 人报到${count === 1 ? ' · 第 ' + d.students[0].ordinal + ' 位' : ''}，大屏已同步`
          : `已将 ${count} 人标记为「${STATUS_TEXT[confirm.status]}」，大屏已同步`,
      );
      setConfirm(null);
      setSelected(new Set());
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pushPhoto(id: string | null) {
    setBusy(true);
    setError('');
    try {
      await api('/photo', 'POST', { studentId: id });
      setMessage(
        id ? '「大学第一刻」已推送到大屏，展示 2 分钟后自动返回' : '大屏已返回数据总览',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError('');
    try {
      await api('/students/' + profile.id + '/profile', 'PATCH', {
        province: province === 'unknown' ? null : province,
        city: city === 'unknown' ? null : city,
        district,
        school,
      });
      setProfile(null);
      setMessage('生源资料已更新，地图已同步');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportExcel() {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q: query,
        major: major === 'all' ? '' : major,
        className: className === 'all' ? '' : className,
        status: status === 'all' ? '' : status,
      });
      const response = await fetch('/api/export?' + params, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw Error(data?.error || '导出失败，请稍后重试');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Mirror the active filters in the filename, same as the server does.
      const parts = [scope ? shortClass(scope) : major === 'all' ? '全院' : major];
      if (className !== 'all') parts.push(shortClass(className));
      const statusText: Record<string, string> = {
        pending: '待报到',
        checked_in: '已报到',
        leave: '请假',
        withdrawn: '退学',
      };
      if (status !== 'all') parts.push(statusText[status]);
      link.download = `2026级新生报到详情_${parts.join('_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`已导出 ${rows.length} 名新生的报到详情 Excel`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / 20)),
    safePage = Math.min(page, pageCount - 1),
    visible = rows.slice(safePage * 20, safePage * 20 + 20);
  const allSelected =
    visible.length > 0 && visible.every((s) => selected.has(s.id));
  const classes =
    stats?.classes.filter((c) => major === 'all' || c.name.includes(major)) ||
    [];
  if (checking)
    return (
      <main className="admin-loading">
        <img className="corner-logo" src="/college-logo.png?v=2" alt="数智科技产业学院" />
        <LoaderCircle className="spin" />
        正在连接教师工作台…
      </main>
    );
  if (!user)
    return (
      <main className="login-page">
        <img className="corner-logo" src="/college-logo.png?v=2" alt="数智科技产业学院" />
        <a href="/" className="back-link">
          <ArrowLeft size={16} />
          返回迎新大屏
        </a>
        <form className="login-card" onSubmit={login}>
          <div className="login-logo">
            <GraduationCap size={35} />
          </div>
          <p className="eyebrow">WELCOME 2026 · TEACHER DESK</p>
          <h1>教师工作台</h1>
          <p>确认每一次抵达，迎接每一位新同学。</p>
          <label>
            教师账号
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            登录密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="remember-row">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(Boolean(v))}
              aria-label="记住账号密码"
            />
            <span>记住账号密码，保持登录状态</span>
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="solid-btn" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowUpRight size={17} />
            )}
            登录工作台
          </button>
          <small>数智科技产业学院 · 2026 级新生报到</small>
        </form>
      </main>
    );
  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" className="admin-brand">
          <img src="/college-logo.png?v=2" alt="数智科技产业学院" />
          <b>教师工作台</b>
        </a>
        <div>
          <span className={`live ${online ? '' : 'offline'}`}>
            <i />
            {online ? '大屏实时同步中' : '连接中断，正在重连'}
          </span>
          <a href="/" target="_blank" rel="noreferrer" className="outline-btn">
            <Monitor size={16} />
            打开大屏
            <ArrowUpRight size={14} />
          </a>
          <button
            className="icon-btn"
            title="退出登录"
            onClick={async () => {
              try {
                await api('/logout', 'POST', {});
                clearRemembered();
                setUser(null);
                setScope(null);
                setMajor('all');
                setRows([]);
                setUsername('');
                setPassword('');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <section className="admin-content">
        <div className="admin-page-title">
          <div>
            <p className="eyebrow">2026 NEW STUDENT REGISTRATION</p>
            <h1>让每一位新同学，安心抵达。</h1>
            <p>搜索学生、核对班级并确认报到，数据将自动同步至迎新大屏。</p>
          </div>
          <div className="teacher-badge">
            {scope ? (
              <>
                {shortClass(scope)} · 迎新老师 <b>{user}</b>
              </>
            ) : (
              <>
                学院管理员 <b>{user}</b>
              </>
            )}
          </div>
        </div>
        <div className="admin-stats">
          {[
            ['应报到', stats?.total],
            ['已报到', stats?.checkedIn],
            ['待报到', stats?.pending],
            ['请假', stats?.leave],
            ['退学', stats?.withdrawn],
            ['实时报到率', stats ? stats.rate.toFixed(1) + '%' : undefined],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value ?? '—'}</strong>
            </article>
          ))}
        </div>
        {(message || error) && (
          <div
            role={error ? 'alert' : 'status'}
            className={`admin-toast ${error ? 'error' : ''}`}
          >
            <span>{error || message}</span>
            <button
              onClick={() => {
                setError('');
                setMessage('');
              }}
              aria-label="关闭消息"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="admin-tabs-row">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="students">
                <UsersIcon />
                学生报到
              </TabsTrigger>
              <TabsTrigger value="logs">
                <ClipboardList size={16} />
                操作记录
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => pushPhoto(null)}
          >
            <Monitor size={15} />
            结束大屏合影展示
          </button>
        </div>
        {tab === 'students' ? (
          <section className="roster-panel">
            <div className="roster-filters">
              <label className="search-input">
                <Search size={18} />
                <input
                  aria-label="搜索姓名、编号、学号或生源学校"
                  placeholder="搜索姓名、编号、学号或生源学校"
                  maxLength={80}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="清空搜索">
                    <X size={15} />
                  </button>
                )}
              </label>
              <FilterSelect
                label="筛选专业"
                value={major}
                onChange={(v) => {
                  setMajor(v);
                  setClassName('all');
                }}
                disabled={Boolean(scope)}
                options={
                  scope
                    ? [{ value: scope, label: scope }]
                    : [
                        { value: 'all', label: '全部专业' },
                        ...(stats?.majors || []).map((c) => ({
                          value: c.name,
                          label: c.name,
                        })),
                      ]
                }
              />
              <FilterSelect
                label="筛选班级"
                value={className}
                onChange={setClassName}
                options={[
                  { value: 'all', label: '全部班级' },
                  ...classes.map((c) => ({
                    value: c.name,
                    label: shortClass(c.name),
                  })),
                ]}
              />
              <FilterSelect
                label="筛选报到状态"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'pending', label: '待报到' },
                  { value: 'checked_in', label: '已报到' },
                  { value: 'leave', label: '请假' },
                  { value: 'withdrawn', label: '退学' },
                ]}
              />
            </div>
            <div className="roster-caption">
              <span>
                {loading ? '正在查找…' : `找到 ${rows.length} 位新生`}
                {selected.size > 0 && <b> · 已选择 {selected.size} 人</b>}
              </span>
              <div className="caption-actions">
                <button
                  className="outline-btn small-btn"
                  disabled={busy || !rows.length}
                  onClick={exportExcel}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Download size={15} />
                  )}
                  导出 Excel
                </button>
                <button
                  className="solid-btn small-btn"
                  disabled={busy || !selected.size}
                  onClick={() =>
                    setConfirm({
                      students: rows.filter((s) => selected.has(s.id)),
                      status: 'checked_in',
                    })
                  }
                >
                  <CheckCheck size={16} />
                  批量确认报到
                </button>
              </div>
            </div>
            <Table className="student-table">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label="选择当前页所有学生"
                      checked={allSelected}
                      onCheckedChange={(v) =>
                        setSelected(
                          v ? new Set(visible.map((s) => s.id)) : new Set(),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>姓名 / 名册编号</TableHead>
                  <TableHead>专业与班级</TableHead>
                  <TableHead className="col-origin">生源地区 / 学校</TableHead>
                  <TableHead>报到状态</TableHead>
                  <TableHead className="col-ordinal">报到序号 / 时间</TableHead>
                  <TableHead className="actions-head">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`选择${s.name} ${s.className}`}
                        checked={selected.has(s.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <strong>{s.name}</strong>
                      <small>{s.studentNo || s.id}</small>
                    </TableCell>
                    <TableCell>
                      <span>{s.major}</span>
                      <small>{shortClass(s.className)}</small>
                    </TableCell>
                    <TableCell className="col-origin">
                      <span className={s.city ? '' : 'muted'}>
                        {s.city || '地区待补充'}
                        {s.district ? ' · ' + s.district : ''}
                      </span>
                      <small className="school-cell" title={s.school || ''}>
                        {s.province || '省份待补充'}
                      </small>
                    </TableCell>
                    <TableCell>
                      <span className={`attendance-badge ${s.status}`}>
                        <i />
                        {STATUS_TEXT[s.status]}
                      </span>
                    </TableCell>
                    <TableCell className="col-ordinal">
                      <span className={s.ordinal ? 'ordinal' : 'muted'}>
                        {s.ordinal ? '第 ' + s.ordinal + ' 位' : '—'}
                      </span>
                      <small>
                        {s.checkedInAt
                          ? new Date(s.checkedInAt).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })
                          : s.ordinal
                            ? '序号保留，待重新报到'
                            : '尚未报到'}
                      </small>
                    </TableCell>
                    <TableCell>
                      <div className="row-actions">
                        {s.status === 'pending' && (
                          <button
                            className="checkin-btn"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                students: [s],
                                status: 'checked_in',
                              })
                            }
                          >
                            <Check size={14} />
                            确认报到
                          </button>
                        )}
                        {s.status === 'checked_in' && (
                          <>
                            <button
                              className="text-btn"
                              disabled={busy}
                              onClick={() => setPhoto(s as Arrival)}
                            >
                              <Camera size={15} />
                              大学第一刻
                            </button>
                            <button
                              className="icon-btn"
                              disabled={busy}
                              title={`撤销${s.name}的报到`}
                              aria-label={`撤销${s.name}的报到`}
                              onClick={() =>
                                setConfirm({ students: [s], status: 'pending' })
                              }
                            >
                              <Undo2 size={14} />
                            </button>
                          </>
                        )}
                        <select
                          className="row-status-select"
                          value={s.status}
                          disabled={busy}
                          aria-label={`修改${s.name}的报到状态`}
                          onChange={(e) => {
                            const next = e.target
                              .value as Student['status'];
                            if (next !== s.status)
                              setConfirm({ students: [s], status: next });
                          }}
                        >
                          {(
                            ['pending', 'checked_in', 'leave', 'withdrawn'] as const
                          ).map((v) => (
                            <option key={v} value={v}>
                              {STATUS_TEXT[v]}
                            </option>
                          ))}
                        </select>
                        <button
                          className="icon-btn"
                          title="补充生源资料"
                          aria-label={`编辑${s.name}的生源资料`}
                          onClick={() => {
                            setProfile(s);
                            setProvince(s.province || 'unknown');
                            setCity(s.city || 'unknown');
                            setDistrict(s.district || '');
                            setSchool(s.school || '');
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!visible.length && (
              <div className="no-results">
                <Search size={26} />
                <h3>没有找到符合条件的学生</h3>
                <p>尝试调整关键词或专业、班级筛选。</p>
                <button
                  className="outline-btn"
                  onClick={() => {
                    setQuery('');
                    setMajor('all');
                    setClassName('all');
                    setStatus('all');
                  }}
                >
                  清空筛选
                </button>
              </div>
            )}
            <div className="roster-pagination">
              <span>每页 20 人 · 共 {rows.length} 人</span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <button
                      className="outline-btn"
                      aria-label="上一页"
                      disabled={safePage === 0}
                      onClick={() => setPage(safePage - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </PaginationItem>
                  <PaginationItem>
                    <span>
                      {safePage + 1} / {pageCount}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <button
                      className="outline-btn"
                      aria-label="下一页"
                      disabled={safePage === pageCount - 1}
                      onClick={() => setPage(safePage + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </section>
        ) : (
          <section className="roster-panel audit-panel">
            <h2>最近 100 条操作记录</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.name}</TableCell>
                    <TableCell>{shortClass(log.class_name)}</TableCell>
                    <TableCell>
                      {{
                        check_in: '确认报到',
                        undo_check_in: '恢复待报到',
                        update_profile: '修改生源资料',
                        leave: '登记请假',
                        withdrawn: '登记退学',
                      }[log.action] || log.action}
                    </TableCell>
                    <TableCell>{log.actor}</TableCell>
                    <TableCell>
                      {new Date(
                        log.created_at.replace(' ', 'T') + 'Z',
                      ).toLocaleString('zh-CN', { hour12: false })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!logs.length && <p className="no-results">暂无操作记录</p>}
          </section>
        )}
        <footer className="admin-footer">
          <span>
            <Radio size={14} />
            报到序号永久保留，重复确认不会重复计数。
          </span>
          <span>
            退学学生自动从应报到人数与大屏统计中移除 · 地区待补充{' '}
            {stats?.quality.cityMissing ?? '—'} 人，可点击铅笔图标完善
          </span>
        </footer>
      </section>
      <AlertDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!busy && !open) setConfirm(null);
        }}
      >
        <AlertDialogContent className="confirm-dialog">
          <AlertDialogTitle>
            {confirm?.students.length === 1
              ? `将 ${confirm.students[0].name} 标记为「${STATUS_TEXT[confirm.status]}」`
              : confirm?.status === 'checked_in'
                ? '批量确认新生报到'
                : `批量标记为「${STATUS_TEXT[confirm?.status || 'pending']}」`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.students.length === 1 ? (
              <>
                {shortClass(confirm.students[0].className)}
                <br />
                {confirm.status === 'checked_in'
                  ? '请核对学生身份与班级，确认后将分配报到序号。'
                  : confirm.status === 'pending'
                    ? '恢复为待报到，原报到序号保留，大屏同步更新。'
                    : confirm.status === 'leave'
                      ? '登记请假：该生仍计入应报到人数，但暂不计为已报到。'
                      : '登记退学：该生将从应报到总人数及全部大屏统计中移除。'}
              </>
            ) : (
              `即将把选中的 ${confirm?.students.length} 名学生标记为「${STATUS_TEXT[confirm?.status || 'pending']}」，状态相同的学生将自动跳过。`
            )}
          </AlertDialogDescription>
          {error && <p className="form-error">{error}</p>}
          <div className="dialog-actions">
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <button className="solid-btn" disabled={busy} onClick={attendance}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              确认{STATUS_TEXT[confirm?.status || 'pending']}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={Boolean(profile)}
        onOpenChange={(open) => {
          if (!busy && !open) setProfile(null);
        }}
      >
        <DialogContent className="profile-dialog">
          <DialogTitle>完善生源资料 · {profile?.name}</DialogTitle>
          <DialogDescription>
            {profile && shortClass(profile.className)} · 保存后地图自动更新
          </DialogDescription>
          <form onSubmit={saveProfile}>
            <label>
              所属省份
              <FilterSelect label="所属省份" value={province} onChange={value => {setProvince(value); setCity('unknown'); setDistrict('');}} options={[{value:'unknown', label:'省份待补充'}, ...divisions.map(p => ({value:p.name, label:p.name}))]} />
            </label>
            <label>
              生源城市
              <FilterSelect
                label="生源城市"
                value={city}
                onChange={value => { setCity(value); setDistrict(''); }}
                options={[
                  { value: 'unknown', label: '地区待补充' },
                  ...(divisions.find(p => p.name === province)?.children || []).map(c => ({value:c.name, label:c.name})),
                ]}
              />
            </label>
            <label>
              区县
              <input
                value={district}
                maxLength={80}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="如：历城区"
              />
            </label>
            <label>
              生源学校
              <input
                value={school}
                maxLength={180}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="填写学校全称"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="solid-btn" disabled={busy}>
              <Check size={16} />
              保存并同步地图
            </button>
          </form>
        </DialogContent>
      </Dialog>
      {photo && (
        <>
          <CardStage>
            <PhotoCard student={photo} onClose={() => setPhoto(null)} />
          </CardStage>
          <div className="photo-teacher-actions">
            <button
              className="solid-btn"
              disabled={busy}
              onClick={() => {
                void pushPhoto(photo.id);
                setPhoto(null);
              }}
            >
              <Monitor size={17} />
              推送至大屏 · 展示 2 分钟
            </button>
          </div>
        </>
      )}
    </main>
  );
}
function UsersIcon() {
  return <GraduationCap size={17} />;
}
