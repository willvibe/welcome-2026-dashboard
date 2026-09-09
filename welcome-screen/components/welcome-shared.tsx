'use client';
import { useEffect, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import {
  Cake,
  GraduationCap,
  Heart,
  MapPin,
  PenLine,
  Quote,
  School,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { Arrival, CardDetail } from '@/lib/types';
export const shortClass = (name: string) =>
  name
    .replace('2026级', '')
    .replace('人工智能技术应用', '人工智能')
    .replace('金融科技应用', '金融科技');

// Full-screen stage for the PhotoCard: one fixed 1920×1080 (16:9) design
// canvas on every device — desktop and phone alike. The canvas is scaled
// to fit (contain) and centered, so what you see — and the PNG you
// download (3840×2160) — is identical everywhere. No responsive layout.
export function CardStage({
  children,
  stageRef,
}: {
  children: ReactNode;
  stageRef?: Ref<HTMLDivElement>;
}) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () =>
      setScale(
        Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
      );
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div
      ref={stageRef}
      className="card-stage"
      style={{ '--card-scale': scale } as CSSProperties}
    >
      {children}
    </div>
  );
}

type Tile = {
  icon: typeof Users;
  label: string;
  value: number | null;
  caption: string;
};
export function PhotoCard({
  student,
  onClose,
}: {
  student: Arrival;
  onClose?: () => void;
}) {
  const [card, setCard] = useState<CardDetail | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setCard(null);
    fetch(`/api/card/${student.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCard(d as CardDetail | null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [student.id]);
  const lastChar = student.name.slice(-1);
  const zodiac = card?.student.zodiac;
  const tiles: Tile[] = [
    {
      icon: Users,
      label: '同乡',
      value: card ? card.sameCity : null,
      caption:
        card?.sameCity == null
          ? '生源地区待补充'
          : `和你一样来自${student.city || '家乡'}`,
    },
    {
      icon: School,
      label: '高中校友',
      value: card ? card.sameSchool : null,
      caption:
        card?.sameSchool == null ? '生源学校待补充' : '与你毕业于同一所学校',
    },
    {
      icon: Heart,
      label: '同好',
      value: card ? card.sameHobby : null,
      caption: card
        ? card.sharedHobbies.length
          ? `同样热爱${card.sharedHobbies.join('、')}`
          : card.sameHobby
            ? '与你兴趣相投'
            : '你的热爱独一无二'
        : '与你兴趣相投',
    },
    {
      icon: Star,
      label: '同一星座',
      value: card ? card.sameZodiac : null,
      caption:
        card?.sameZodiac == null ? '生日待补充' : `都是${zodiac || '同星座'}`,
    },
    {
      icon: PenLine,
      label: '名字尾字',
      value: card ? card.sameLastChar : null,
      caption: `名字里都有一个「${lastChar}」`,
    },
    {
      icon: Cake,
      label: '同天生日',
      value: card ? card.sameBirthday : null,
      caption: card?.sameBirthday ? '和你同一天生日' : '这一天因你而独一无二',
    },
  ];
  return (
    <div className="photo-mode">
      <div className="photo-orbit orbit-one" />
      <div className="photo-orbit orbit-two" />
      <img
        className="photo-logo"
        src="/college-logo.png?v=2"
        alt="数智科技产业学院"
      />
      {onClose && (
        <button
          className="photo-close icon-btn"
          onClick={onClose}
          aria-label="返回数据大屏"
        >
          <X />
        </button>
      )}
      <div className="photo-college">数智科技产业学院 · 2026级迎新</div>
      <p className="eyebrow">HELLO, NEW CHAPTER</p>
      <h1>
        你好，<em>{student.name}</em>同学！
      </h1>
      <div className="photo-number">
        <span>你是学院第</span>
        <strong>{String(student.ordinal).padStart(3, '0')}</strong>
        <span>位报到的新同学</span>
      </div>
      <div className="photo-info">
        <GraduationCap />
        {shortClass(student.className)}
        {student.city && (
          <>
            <i />
            <MapPin />
            {student.city}
          </>
        )}
        {zodiac && (
          <>
            <i />
            <Sparkles />
            {zodiac}
          </>
        )}
      </div>
      <section className="photo-fate" aria-label="缘分档案">
        <header>
          <span className="photo-fate-rule" />
          你的 2026 级缘分档案
          <span className="photo-fate-rule" />
        </header>
        <div className="photo-stats">
          {tiles.map((t) => (
            <article key={t.label} className={card ? '' : 'photo-tile-loading'}>
              <t.icon />
              <div>
                <b>
                  {card ? (t.value ?? '—') : '…'}
                  {card && t.value !== null && <small>位</small>}
                </b>
                <span>{t.label}</span>
              </div>
              <p>{card ? t.caption : '正在生成…'}</p>
            </article>
          ))}
        </div>
      </section>
      <blockquote className={`photo-blessing ${card ? '' : 'photo-hidden'}`}>
        <Quote />
        <p>{card?.message || '…'}</p>
      </blockquote>
      <div className="photo-bottom">
        <span>我的大学第一刻</span>
        <span>
          {new Date(student.checkedInAt).toLocaleDateString('zh-CN')} · WELCOME
          2026
        </span>
      </div>
    </div>
  );
}
