import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '큐앤뱅 대시보드',
  description: '큐앤뱅 지출·업무 통합 대시보드',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
