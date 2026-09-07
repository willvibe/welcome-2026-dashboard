'use client';
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- A focusable scroll region lets keyboard users reach every district. */
import { useEffect, useRef } from 'react';
import type { City } from '@/lib/types';

export function DistrictList({ city, paused }: { city: City; paused: boolean }) {
  const viewport = useRef<HTMLElement>(null);
  const manualUntil = useRef(0);
  const signature = city.districts.map((s) => `${s.name}:${s.total}`).join('|');
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [city.name]);
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    let waitUntil = Date.now() + 1800;
    let position = viewport.current?.scrollTop || 0;
    const timer = setInterval(() => {
      const list = viewport.current;
      if (!list || Date.now() < Math.max(waitUntil, manualUntil.current))
        return;
      const max = list.scrollHeight - list.clientHeight;
      if (max <= 1) return;
      if (list.scrollTop >= max - 1) {
        list.scrollTop = position = 0;
        waitUntil = Date.now() + 1800;
      } else {
        position = Math.max(position, list.scrollTop) + 0.8;
        list.scrollTop = position;
        if (list.scrollTop >= max - 1) waitUntil = Date.now() + 1800;
      }
    }, 50);
    return () => clearInterval(timer);
  }, [city.name, signature, paused]);
  const hold = () => {
    manualUntil.current = Date.now() + 6000;
  };
  return (
    <section
      className="a-hometown-schools"
      ref={viewport}
      tabIndex={0}
      aria-label={`${city.name}全部${city.districts.length}个生源区县，可滚动查看`}
      onWheel={hold}
      onTouchStart={hold}
    >
      {city.districts.length ? (
        <div className="a-school-track">
          {city.districts.map((s) => (
            <div key={s.name}>
              <span title={s.name}>{s.name}</span>
              <b>
                {s.total}
                <small>人</small>
              </b>
            </div>
          ))}
        </div>
      ) : (
        <span className="a-school-empty">暂无已知生源区县</span>
      )}
    </section>
  );
}
