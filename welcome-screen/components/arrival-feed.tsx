'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The scroll region needs keyboard focus for Page Up/Down and arrow scrolling. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Camera,
  ChevronRight,
  GraduationCap,
  RotateCw,
} from 'lucide-react';
import type { Arrival } from '@/lib/types';
import { shortClass } from './welcome-shared';

export function ArrivalFeed({
  recent,
  checkedIn,
  live,
  onSelect,
}: {
  recent: Arrival[];
  checkedIn: number;
  live: boolean;
  onSelect: (student: Arrival) => void;
}) {
  const [history, setHistory] = useState<Arrival[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [past, setPast] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const anchor = useRef<{ id: string; offset: number } | null>(null);
  const revision = `${checkedIn}:${recent.map((s) => `${s.id}:${s.checkedInAt}`).join('|')}`;
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    fetch('/api/arrivals', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error('无法加载历史报到');
        const data = (await response.json()) as { arrivals: Arrival[] };
        if (!Array.isArray(data.arrivals)) throw Error('报到记录格式不正确');
        if (controller.signal.aborted) return;
        const list = listRef.current;
        // Keep the same student in view when a new arrival is prepended.
        if (list && list.scrollTop > 2) {
          const top = list.getBoundingClientRect().top;
          const first = Array.from(
            list.querySelectorAll<HTMLElement>('[data-arrival-id]'),
          ).find((row) => row.getBoundingClientRect().bottom > top + 1);
          anchor.current = first
            ? {
                id: first.dataset.arrivalId!,
                offset: first.getBoundingClientRect().top - top,
              }
            : null;
        } else anchor.current = null;
        setHistory(data.arrivals);
        setError(false);
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [revision, live, retry]);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !anchor.current) return;
    const row = Array.from(
      list.querySelectorAll<HTMLElement>('[data-arrival-id]'),
    ).find((node) => node.dataset.arrivalId === anchor.current!.id);
    if (row)
      list.scrollTop +=
        row.getBoundingClientRect().top -
        list.getBoundingClientRect().top -
        anchor.current.offset;
    anchor.current = null;
  }, [history]);
  const arrivals = history ?? recent;
  return (
    <div className="a-arrivals-window">
      <section
        className="a-arrivals-list"
        ref={listRef}
        tabIndex={0}
        aria-label="报到记录，默认显示最近5位，向下滚动查看历史并打开大学第一刻"
        onScroll={(event) => setPast(event.currentTarget.scrollTop > 2)}
      >
        {arrivals.length ? (
          arrivals.map((student) => (
            <button
              key={student.id}
              data-arrival-id={student.id}
              className="a-arrival-entry"
              title={`${new Date(student.checkedInAt).toLocaleString('zh-CN', { hour12: false })} · 查看${student.name}的第${student.ordinal}位报到「大学第一刻」`}
              onClick={() => onSelect(student)}
            >
              <span className="a-ar-name">{student.name}</span>
              <span className="a-ar-class" title={student.className}>
                {shortClass(student.className)}
              </span>
              <b className="a-ar-ordinal">
                #{String(student.ordinal).padStart(3, '0')}
              </b>
              <span className="a-ar-city">
                {student.city?.replace('市', '') || '待补充'}
              </span>
            </button>
          ))
        ) : (
          <div className="a-empty-arrivals">
            <div>
              <GraduationCap size={24} />
              <i />
              <i />
            </div>
            <strong>
              {live ? '第一位新同学，会是你吗？' : '正在连接报到服务'}
            </strong>
            <p>每次报到，都会点亮这里</p>
          </div>
        )}
      </section>
      <div className="a-arrival-actions">
        <button
          className="a-photo-link"
          disabled={!recent.length}
          onClick={() => recent[0] && onSelect(recent[0])}
        >
          <Camera size={14} />
          <span className="a-photo-label">留住大学的第一刻</span>
          <span className="a-photo-label-compact">最新合影</span>
          <ChevronRight size={14} />
        </button>
        {error ? (
          <button
            className="a-history-link"
            onClick={() => setRetry((value) => value + 1)}
          >
            <RotateCw size={11} />
            重试历史
          </button>
        ) : past ? (
          <button
            className="a-history-link"
            onClick={() =>
              listRef.current?.scrollTo({ top: 0, behavior: 'auto' })
            }
          >
            <ArrowUp size={11} />
            回到最新
          </button>
        ) : (
          <span className="a-history-hint">
            {arrivals.length > 5
              ? `共 ${arrivals.length} 人 · 下滑查看`
              : '最近报到'}
          </span>
        )}
      </div>
    </div>
  );
}
