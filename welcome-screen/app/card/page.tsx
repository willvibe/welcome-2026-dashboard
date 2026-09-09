import type { Metadata } from 'next';
import CardLookup from '@/components/card-lookup';
export const metadata: Metadata = {
  title: '大学第一刻 · 2026迎新',
};
export default function CardPage() {
  return <CardLookup />;
}
