'use client';
import { useRef, useState, type FormEvent } from 'react';
import { toBlob, toPng } from 'html-to-image';
import {
  ArrowLeft,
  Download,
  GraduationCap,
  LoaderCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { PhotoCard } from '@/components/welcome-shared';
import type { Arrival } from '@/lib/types';

// Students look up their own commemorative card by roster id (e.g. 01-001)
// and can download it as a PNG keepsake.
export default function CardLookup() {
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [student, setStudent] = useState<Arrival | null>(null);
  const [saving, setSaving] = useState(false);
  const shot = useRef<HTMLDivElement>(null);
  async function lookup(e: FormEvent) {
    e.preventDefault();
    const id = studentId.trim().toUpperCase();
    if (!/^\d{11}$/.test(id) && !/^\d{17}[\dX]$/.test(id)) {
      setError('请输入学号（11 位数字）或身份证号（18 位）');
      return;
    }
    setBusy(true);
    setError('');
    setStudent(null);
    try {
      const res = await fetch(`/api/card/${id}`);
      const data = (await res.json()) as {
        error?: string;
        student: Arrival;
      };
      if (!res.ok) throw Error(data.error || '查询失败，请稍后重试');
      setStudent(data.student);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!shot.current || !student) return;
    setSaving(true);
    try {
      // PhotoCard renders a fixed full-screen layer; capturing its wrapper
      // would yield an empty canvas, so capture the layer itself.
      const target =
        (shot.current.querySelector('.photo-mode') as HTMLElement | null) ??
        shot.current;
      // Capture options give a clean, borderless full shot: hide the layer's
      // scrollbars and drop the oversized orbit rings that read as borders.
      const capture = {
        pixelRatio: 2,
        backgroundColor: '#061525',
        style: { overflow: 'hidden' },
        filter: (node: HTMLElement) =>
          !(node.classList && node.classList.contains('photo-orbit')),
      };
      // Two passes: the first warms up embedded fonts, the second renders crisp.
      await toPng(target, capture);
      // Download as a Blob URL — multi-MB data: URLs get truncated by some
      // browsers (phones especially), which corrupted the earlier PNGs.
      const blob = await toBlob(target, capture);
      if (!blob) throw Error('EMPTY');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `2026迎新合影卡_${student.name}.png`;
      link.click();
      // Free the screenshot from browser memory once the download is done.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError('图片生成失败，请截图保存或稍后重试');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="card-lookup-page">
      <a href="/" className="back-link">
        <ArrowLeft size={16} />
        返回迎新大屏
      </a>
      <form className="card-lookup-box" onSubmit={lookup}>
        <div className="card-lookup-head">
          <div className="login-logo">
            <GraduationCap size={26} />
          </div>
          <div>
            <h1>我的迎新合影卡</h1>
            <p className="card-lookup-sub">MY WELCOME CARD · 查看并保存留念</p>
          </div>
        </div>
        <label>
          学号 / 身份证号
          <div className="card-id-input">
            <Search size={18} />
            <input
              value={studentId}
              onChange={(e) =>
                setStudentId(
                  e.target.value.replace(/[^0-9Xx]/g, '').slice(0, 18),
                )
              }
              placeholder="学号或身份证号，自动识别"
              maxLength={18}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
            />
          </div>
        </label>
        <p className="card-lookup-help">
          <i>· 学号：11 位数字，如 20260701001</i>
          <i>· 身份证号：18 位，还不知道学号的同学用这项查询</i>
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="solid-btn" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Sparkles size={17} />
          )}
          查看我的合影卡
        </button>
        <small>数智科技产业学院 · 2026 级新生报到</small>
      </form>
      {student && (
        <>
          <div ref={shot}>
            <PhotoCard student={student} />
          </div>
          <div className="card-save-actions">
            <button className="solid-btn" disabled={saving} onClick={download}>
              {saving ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Download size={17} />
              )}
              保存合影卡图片
            </button>
            <button className="outline-btn" onClick={() => setStudent(null)}>
              再查一位
            </button>
          </div>
        </>
      )}
    </main>
  );
}
