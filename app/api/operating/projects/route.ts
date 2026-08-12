import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
// 중앙 인덱스나 프로젝트 링크가 바뀌면 개발 서버 모듈 캐시도 새로 읽는다. 2026-08-12 좋은움직임연구소 최신화 반영.

const indexSpreadsheetId = '1RnmSplWT2-Aqk-flDInpWMljKwBbUes1q6pab9j3dfo';
const 캐시시간 = 300_000;
let 정상응답캐시: { at: number; data: 프로젝트응답 } | null = null;
let 진행중조회: Promise<프로젝트응답> | null = null;

type 프로젝트응답 = { ok: true; indexCount: number; items: unknown[]; pending: unknown[]; updatedAt: string };

type 행 = Record<string, string>;

function 표행(rows: unknown[][]): 행[] {
  const [header = [], ...body] = rows;
  return body.map((row) => Object.fromEntries(header.map((key, index) => [String(key), String(row[index] ?? '')])));
}

function 진행률(rows: 행[]) {
  if (!rows.length) return 0;
  const 완료 = rows.filter((row) => ['완료', '완수', '전달 완료'].includes(row['상태'])).length;
  return Math.round((완료 / rows.length) * 100);
}

function 시트ID(url: string) {
  return url.match(/\/d\/([\w-]+)/)?.[1] || '';
}

function 열문자(index: number) {
  let result = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(((value - 1) % 26) + 65) + result;
  return result;
}

function 수명주기(status: string, storage: string) {
  if (['보류', '확인 필요'].includes(status)) return '보류';
  if (status === '고객대기') return '고객대기';
  if (storage === '보관' || ['보관', '폐기 기록', '완료'].includes(status)) return '완료·과거';
  return '현재 진행';
}

const 다른프로젝트로이관 = new Set(['디자인 포폴 디벨롭', '크리에이티브지식 통합위키', '아트 디렉터 에이전트', '큐앤뱅 디자인 시스템', '바이브코딩 인터랙션 위키', '웹 인터랙션 갤러리', '크리에이티브 인덱스']);
const 완료상태 = new Set(['완료', '완수', '전달 완료', '폐기', '종료']);

function 상태확인메모(title: string) {
  return title.includes('운영 상태와 다음 행동 확인') || title === '현재 상태 확인' || title === '다음 행동 확인';
}

function 할일정규화(row: 행, projectId: string) {
  const shifted = row['프로젝트ID'] && row['프로젝트ID'] !== projectId;
  if (!shifted) return { id: row['할일ID'] || row['ID'], title: row['할 일'] || row['제목'], status: row['상태'], owner: row['담당'], next: row['다음 행동'], stream: row['연결 진행'] || row['진행ID'], due: row['마감'] || row['확인 시점'], source: row['출처'], validShape: true };
  const oldShape = Boolean(row['상태']);
  return oldShape
    ? { id: row['할일ID'], title: row['상태'], status: row['진행ID'], owner: row['할 일'], next: '', stream: row['프로젝트ID'], due: row['담당'], source: row['마감'], validShape: false }
    : { id: row['할일ID'], title: row['프로젝트ID'], status: row['진행ID'], owner: row['할 일'], next: '', stream: '', due: '', source: row['마감'], validShape: false };
}

async function 실제조회(): Promise<프로젝트응답> {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const indexResponse = await sheets.spreadsheets.values.get({ spreadsheetId: indexSpreadsheetId, range: "'프로젝트'!A:Z" });
    const indexRows = 표행((indexResponse.data.values as unknown[][]) || []);
    const pendingResponse = await sheets.spreadsheets.values.get({ spreadsheetId: indexSpreadsheetId, range: "'이관대기 프로젝트'!A:Z" }).catch(() => ({ data: { values: [] as unknown[][] } }));
    const pending = 표행((pendingResponse.data.values as unknown[][]) || []).filter((row) => !['연결 완료', '폐기', '제외'].includes(row['이관상태'])).map((row) => ({
      name: row['레거시 프로젝트명'], client: row['고객'], position: row['현재 위치'], status: row['현재 상태'], owner: row['담당'], next: row['다음 행동'], due: row['기한'], updatedAt: row['마지막 갱신'], taskCount: row['연결된 과업 수'],
    })).filter((row) => row.name);
    const items = await Promise.all(indexRows.map(async (row) => {
      const spreadsheetUrl = row['프로젝트 운영원장'] || row['원장링크'] || '';
      const spreadsheetId = row['원장시트ID'] || 시트ID(spreadsheetUrl);
      const storage = row['보관상태'] || '';
      const base = {
        id: row['프로젝트ID'],
        name: row['프로젝트명'],
        client: row['고객사'] || (row['구분'] === '자체' ? '큐앤뱅' : '거래상대 확인 필요'),
        status: row['상태'] || '상태 확인 필요',
        owner: row['담당'] || '담당 확인 필요',
        lifecycle: 수명주기(row['상태'] || '', storage),
        storage,
        driveUrl: row['드라이브 폴더'] || '',
        spreadsheetId,
        spreadsheetUrl,
        contractEstimateUrl: row['계약·견적 폴더'] || '',
      };
      if (!spreadsheetId) return { ...base, readable: false, reason: '운영원장 연결 대기', workstreams: [], tasks: [] };
      try {
        const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ['개요!A:B', '진행!A:H', '할일!A:H', '결정!A:E', '일정!A:F', '이력!A:C', '링크!A:E'] });
        const values = response.data.valueRanges?.map((range) => (range.values as unknown[][]) || []) || [];
        const overview = Object.fromEntries((values[0] || []).slice(1).map((item) => [String(item[0] ?? ''), String(item[1] ?? '')]));
        const workstreams = 표행(values[1] || []).map((item) => ({
          name: item['진행 묶음명'] || item['이름'], outcome: item['만들 결과'] || item['결과'], status: item['상태'], owner: item['담당'], next: item['다음 행동'], due: item['마감 또는 확인 시점'] || item['마감'], links: item['문서·자료 링크'] || item['링크'],
        })).filter((item) => item.name);
        const taskMap = new Map<string, ReturnType<typeof 할일정규화>>();
        표행(values[2] || []).map((item) => 할일정규화(item, base.id)).filter((item) => item.title && !상태확인메모(item.title)).filter((item) => !(base.id === 'B-002' && (item.title === '큐앤뱅 네이버 광고 셋팅' || 다른프로젝트로이관.has(item.title)))).forEach((item) => taskMap.set(item.title, item));
        const tasks = [...taskMap.values()].map(({ validShape: _validShape, ...item }) => item);
        const decisions = 표행(values[3] || []).map((item) => ({ id: item['결정ID'] || item['ID'], title: item['결정'] || item['내용'], detail: item['이유'], actor: item['결정자'], at: item['시각'], kind: '결정' })).filter((item) => item.title);
        const schedules = 표행(values[4] || []).map((item) => ({ id: item['일정ID'] || item['ID'], title: item['일정명'] || item['제목'], detail: item['메모'], actor: item['담당'], at: item['시작'], end: item['종료'], kind: '일정' })).filter((item) => item.title);
        const histories = 표행(values[5] || []).map((item) => ({ id: item['시각'], title: item['내용'], actor: item['기록자'], at: item['시각'], kind: '이력' })).filter((item) => item.title);
        const links = 표행(values[6] || []).map((item) => ({ name: item['이름'], purpose: item['용도'], url: item['URL'], stream: item['연결 진행'] })).filter((item) => item.url);
        if (base.contractEstimateUrl && !links.some((item) => item.url === base.contractEstimateUrl)) links.push({ name: '계약·견적', purpose: '행정 원본 폴더', url: base.contractEstimateUrl, stream: '프로젝트 공통' });
        const hasNextAction = Boolean(String(overview['다음 행동'] || '').trim()) || workstreams.some((item) => item.next && !['완료', '완수', '전달 완료'].includes(item.status));
        const hasOpenTask = tasks.some((item) => !완료상태.has(item.status));
        const lifecycle = base.lifecycle === '현재 진행' && !hasNextAction && !hasOpenTask ? '보류' : base.lifecycle;
        const status = lifecycle === '보류' && base.lifecycle === '현재 진행' ? '상태 확인 필요' : (overview['상태'] || base.status);
        return { ...base, status, lifecycle, owner: overview['담당'] || base.owner, client: overview['거래상대'] || overview['고객사'] || base.client, due: overview['확인 시점'] || '', readable: true, overview, workstreams, tasks, decisions, schedules, histories, links, progress: 진행률(workstreams) };
      } catch {
        return { ...base, readable: false, reason: '대시보드 읽기 권한 확인 필요', workstreams: [], tasks: [] };
      }
    }));
    return { ok: true, indexCount: indexRows.length, items, pending, updatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }) };
}

export async function GET() {
  if (정상응답캐시 && Date.now() - 정상응답캐시.at < 캐시시간) return NextResponse.json(정상응답캐시.data);
  try {
    진행중조회 ||= 실제조회();
    const data = await 진행중조회;
    정상응답캐시 = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch {
    if (정상응답캐시) return NextResponse.json({ ...정상응답캐시.data, cached: true });
    return NextResponse.json({ ok: false, message: '프로젝트 통합 인덱스를 잠시 읽지 못했습니다. 잠시 뒤 자동으로 다시 시도합니다.' }, { status: 503 });
  } finally {
    진행중조회 = null;
  }
}

export async function PATCH(request: Request) {
  const allowed = new Set(['진행 중', '고객대기', '보류', '완료']);
  try {
    const body = await request.json();
    const projectId = String(body.projectId || '').trim();
    const status = String(body.status || '').trim();
    const owner = String(body.owner || '').trim();
    const goal = String(body.goal || '').trim();
    const next = String(body.next || '').trim();
    const blocker = String(body.blocker || '').trim();
    const due = String(body.due || '').trim();
    if (!projectId || !allowed.has(status) || !owner || !next) return NextResponse.json({ ok: false, error: '상태·담당·다음 행동을 확인해 주세요.' }, { status: 400 });

    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const indexResponse = await sheets.spreadsheets.values.get({ spreadsheetId: indexSpreadsheetId, range: "'프로젝트'!A:Z" });
    const [header = [], ...rows] = indexResponse.data.values || [];
    const column = Object.fromEntries(header.map((item, index) => [String(item), index]));
    const rowIndex = rows.findIndex((row) => String(row[column['프로젝트ID']] || '') === projectId);
    const statusColumn = column['상태'];
    const ownerColumn = column['담당'];
    if (rowIndex < 0 || statusColumn === undefined || ownerColumn === undefined) throw new Error('중앙 운영원장에서 프로젝트 상태·담당 칸을 찾지 못했습니다.');
    const row = rows[rowIndex];
    const previousStatus = String(row[statusColumn] || '');
    const ledgerUrl = String(row[column['프로젝트 운영원장']] || row[column['원장링크']] || '');
    const ledgerId = 시트ID(ledgerUrl) || String(row[column['원장시트ID']] || '');
    if (!ledgerId) throw new Error('프로젝트 운영원장 연결을 확인하지 못했습니다.');

    const indexStatusRange = `'프로젝트'!${열문자(statusColumn)}${rowIndex + 2}`;
    const indexOwnerRange = `'프로젝트'!${열문자(ownerColumn)}${rowIndex + 2}`;
    const previousOwner = String(row[ownerColumn] || '');
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: indexSpreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: [{ range: indexStatusRange, values: [[status]] }, { range: indexOwnerRange, values: [[owner]] }] } });
    try {
      const overviewResponse = await sheets.spreadsheets.values.get({ spreadsheetId: ledgerId, range: "'개요'!A:B" });
      const overviewRows = overviewResponse.data.values || [];
      const updates = [['상태', status], ['담당', owner], ['목표', goal], ['다음 행동', next], ['막힘', blocker], ['확인 시점', due]];
      const data: { range: string; values: string[][] }[] = [];
      const missing: string[][] = [];
      for (const [key, value] of updates) {
        const targetRow = overviewRows.findIndex((item) => String(item[0] || '').trim() === key);
        if (targetRow >= 0) data.push({ range: `'개요'!B${targetRow + 1}`, values: [[value]] });
        else missing.push([key, value]);
      }
      if (data.length) await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: ledgerId, requestBody: { valueInputOption: 'USER_ENTERED', data } });
      if (missing.length) await sheets.spreadsheets.values.append({ spreadsheetId: ledgerId, range: "'개요'!A:B", valueInputOption: 'USER_ENTERED', requestBody: { values: missing } });
    } catch (error) {
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: indexSpreadsheetId, requestBody: { valueInputOption: 'USER_ENTERED', data: [{ range: indexStatusRange, values: [[previousStatus]] }, { range: indexOwnerRange, values: [[previousOwner]] }] } }).catch(() => undefined);
      throw error;
    }

    정상응답캐시 = null;
    const lifecycle = 수명주기(status, String(row[column['보관상태']] || ''));
    return NextResponse.json({ ok: true, project: { id: projectId, status, lifecycle, owner, summary: goal, next, blocker, due } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : '프로젝트 상태를 바꾸지 못했습니다.' }, { status: 500 });
  }
}
