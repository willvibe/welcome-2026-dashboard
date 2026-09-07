import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '2026迎新 · 数智科技产业学院',
  description: '2026级新生实时报到、同乡地图与新生画像。',
  icons: { icon: '/college-logo.png' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
