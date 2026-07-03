// 회의 게시판 — /board/<key> (허브 nav 의 board:<key> 항목이 iframe 으로 연다)
// 목록은 상태 전용 repo(qnbang-dashboard-data)의 boards/<key>.json 에서 읽는다(코드 배포 무관).
// 로그인(쿠키)한 사람에게만 '회의 추가/삭제'가 보인다. 외부 파트너는 읽기전용.
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { HUB } from '@/lib/hubs';
import { getBoard } from '@/lib/boards';
import BoardView from './BoardView';

export const dynamic = 'force-dynamic'; // 매 요청마다 최신 목록(토글·추가 즉시 반영)

export default async function BoardPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const cfg = HUB[key];
  if (!cfg || !cfg.nav.some((n) => n.src === `board:${key}`)) notFound();
  const { entries } = await getBoard(key);
  const jar = await cookies();
  const authed = jar.get('qnbang_auth')?.value === process.env.AUTH_TOKEN;
  return <BoardView hubKey={key} project={cfg.title} footer={cfg.footerText ?? ''} entries={entries} authed={authed} />;
}
