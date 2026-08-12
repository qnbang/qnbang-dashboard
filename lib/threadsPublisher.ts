import { sheetsWriteClient } from '@/lib/sheets';

export const THREADS_HEADERS = [
  '콘텐츠ID', '제목', '예약시각', '본문', '이어쓰기1', '이어쓰기2', '이어쓰기3', '상태', '즉시발행',
  '실행ID', '잠금시각', '본문게시ID', '이어쓰기1게시ID', '이어쓰기2게시ID', '이어쓰기3게시ID',
  '발행시각', '시도횟수', '마지막오류', '수정시각',
] as const;

export type ThreadsStatus = '보관함' | '예약됨' | '발행됨' | '오류' | '중지됨';
export type ThreadsPost = Record<(typeof THREADS_HEADERS)[number], string>;

const sheetId = () => {
  const value = process.env.THREADS_SHEET_ID;
  if (!value) throw new Error('스레드 발행 원장이 아직 연결되지 않았습니다.');
  return value;
};

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

export async function ensureThreadsSheet() {
  const sheets = sheetsWriteClient();
  const spreadsheetId = sheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const found = meta.data.sheets?.find((sheet) => sheet.properties?.title === '발행대기');
  if (!found) throw new Error('발행 원장에 발행대기 탭이 없습니다. 기존 원장을 먼저 연결해주세요.');
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'발행대기'!1:1" });
  const header = current.data.values?.[0] || [];
  if (header.length === 0) throw new Error('발행 원장 헤더가 비어 있습니다. 기존 원장을 먼저 확인해주세요.');
  const missing = THREADS_HEADERS.filter((name) => !header.includes(name));
  if (missing.length) throw new Error(`발행 원장 열 구성이 맞지 않습니다: ${missing.join(', ')}`);
  return header;
}

export async function listThreadsPosts() {
  const header = await ensureThreadsSheet();
  const spreadsheetId = sheetId();
  const response = await sheetsWriteClient().spreadsheets.values.get({ spreadsheetId, range: "'발행대기'!A2:S" });
  return (response.data.values || [])
    .map((row, index) => ({ row: index + 2, ...Object.fromEntries(header.map((key, column) => [key, String(row[column] || '')])) }))
    .filter((post) => post.콘텐츠ID)
    .sort((a, b) => `${a.예약시각 || '9999'}`.localeCompare(`${b.예약시각 || '9999'}`));
}

export async function appendThreadsPost(input: Pick<ThreadsPost, '제목' | '예약시각' | '본문' | '이어쓰기1' | '이어쓰기2' | '이어쓰기3' | '상태'>) {
  await ensureThreadsSheet();
  const now = new Date().toISOString();
  const post: ThreadsPost = {
    콘텐츠ID: `threads-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    제목: input.제목.trim(), 예약시각: input.예약시각, 본문: input.본문.trim(),
    이어쓰기1: input.이어쓰기1.trim(), 이어쓰기2: input.이어쓰기2.trim(), 이어쓰기3: input.이어쓰기3.trim(),
    상태: input.상태, 즉시발행: '', 실행ID: '', 잠금시각: '', 본문게시ID: '', 이어쓰기1게시ID: '', 이어쓰기2게시ID: '', 이어쓰기3게시ID: '',
    발행시각: '', 시도횟수: '0', 마지막오류: '', 수정시각: now,
  };
  await sheetsWriteClient().spreadsheets.values.append({
    spreadsheetId: sheetId(), range: "'발행대기'!A:S", valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [THREADS_HEADERS.map((name) => post[name])] },
  });
  return post;
}

export async function patchThreadsPost(id: string, patch: Partial<Pick<ThreadsPost, '제목' | '예약시각' | '본문' | '이어쓰기1' | '이어쓰기2' | '이어쓰기3' | '상태' | '즉시발행'>>) {
  const posts = await listThreadsPosts();
  const target = posts.find((post) => post.콘텐츠ID === id);
  if (!target) throw new Error('콘텐츠를 찾지 못했습니다.');
  if (target.상태 === '발행됨') throw new Error('이미 발행된 콘텐츠는 수정할 수 없습니다.');
  const next = { ...target, ...patch, 수정시각: new Date().toISOString() };
  const row = target.row;
  await sheetsWriteClient().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${quote('발행대기')}!A${row}:I${row}`, values: [THREADS_HEADERS.slice(0, 9).map((name) => next[name])] },
        { range: `${quote('발행대기')}!S${row}`, values: [[next.수정시각]] },
      ],
    },
  });
  return next;
}
