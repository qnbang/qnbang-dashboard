import { NextResponse } from 'next/server';
import { getSheets } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';

type 원장행 = { id: string; project: string; task: string; client: string; owner: string; position: string; status: string; next: string; due: string; updatedAt: string; category: string };

function 표준프로젝트명(project: string, client: string) {
  if (client === '베스트구조' || project === '업무자동화 POC') return '004_베스트구조';
  if (project.includes('망원 야간보물찾기')) return '003_망원 골목형상점가 야간보물찾기';
  if (client === '좋은움직임연구소' || project.includes('좋은움직임연구소')) return '007_좋은움직임연구소 러너 세션';
  if (project.includes('다리마티')) return '005_다리마티 렉스트림 행사부스';
  if (project === '스레드 링크 자동수집기') return '스레드 링크 자동수집기';
  if (project === '자동화청년') return '자동화청년';
  if (['매크로 투자 브리핑', '홈페이지 리뉴얼', '디자인 포폴 디벨롭', '크리에이티브지식 통합위키', '아트 디렉터 에이전트', '큐앤뱅 디자인 시스템', '큐앤뱅 네이버 광고 셋팅', '바이브코딩 인터랙션 위키', '웹 인터랙션 갤러리', '크리에이티브 인덱스', '큐앤뱅 계정 관리'].includes(project)) return '큐앤뱅 서비스개발';
  return project;
}

function 행읽기(rows: unknown[][]): 원장행[] {
  const [header = [], ...body] = rows;
  const column = (name: string) => (header as unknown[]).findIndex((item) => String(item) === name);
  const index = { id: column('id'), project: column('프로젝트'), task: column('과업명'), client: column('고객'), owner: column('담당자'), position: column('공위치'), status: column('현재상태'), next: column('다음할일'), due: column('기한'), updatedAt: column('갱신일'), category: column('분류') };
  const value = (row: unknown[], key: keyof typeof index) => index[key] >= 0 ? String(row[index[key]] ?? '').trim() : '';
  return body.filter((row): row is unknown[] => Array.isArray(row)).map((row) => {
    const originalProject = value(row, 'project') || value(row, 'task');
    const client = value(row, 'client');
    return { id: value(row, 'id'), project: 표준프로젝트명(originalProject, client), task: value(row, 'task') || originalProject, client, owner: value(row, 'owner'), position: value(row, 'position') || '받은일', status: value(row, 'status'), next: value(row, 'next'), due: value(row, 'due'), updatedAt: value(row, 'updatedAt'), category: value(row, 'category') };
  }).filter((row) => row.project);
}

function 분류(position: string, archive: boolean) {
  if (archive || position === '완수') return '완료·과거';
  if (position === '보류') return '보류';
  if (position === '고객대기') return '고객대기';
  return '현재 진행';
}

const 상태우선순위: Record<string, number> = { '현재 진행': 4, '고객대기': 3, '보류': 2, '완료·과거': 1 };

function 보관프로젝트(project: string) {
  return ['모호소 건축사사무소', '제주 보름 혼술바 브랜딩', '브이큐 업무자동화'].some((name) => project.includes(name));
}

export async function GET() {
  try {
    const sheets = await getSheets();
    const active = 행읽기((sheets?.['과업'] as unknown[][]) || []).filter((item) => !보관프로젝트(item.project));
    const archived = 행읽기((sheets?.['아카이브'] as unknown[][]) || []).filter((item) => !보관프로젝트(item.project));
    const all = [...active.map((item) => ({ ...item, archive: false })), ...archived.map((item) => ({ ...item, archive: true }))];
    const projects = Object.values(all.reduce<Record<string, { name: string; client: string; owner: string; state: string; position: string; status: string; next: string; updatedAt: string; taskCount: number }>>((result, task) => {
      const state = 분류(task.position, task.archive);
      const current = result[task.project];
      if (!current) result[task.project] = { name: task.project, client: task.client, owner: task.owner, state, position: task.position, status: task.status, next: task.next, updatedAt: task.updatedAt, taskCount: 1 };
      else {
        current.taskCount += 1;
        if (상태우선순위[state] > 상태우선순위[current.state]) {
          current.state = state;
          current.position = task.position;
          current.status = task.status;
          current.next = task.next;
          current.updatedAt = task.updatedAt;
          current.client = task.client || current.client;
          current.owner = task.owner || current.owner;
        }
      }
      return result;
    }, {})).sort((a, b) => 상태우선순위[b.state] - 상태우선순위[a.state] || String(b.updatedAt).localeCompare(String(a.updatedAt), 'ko'));
    const count = projects.reduce<Record<string, number>>((result, project) => { result[project.state] = (result[project.state] || 0) + 1; return result; }, {});
    return NextResponse.json({ ok: true, projects, tasks: all, count, updatedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }) });
  } catch {
    return NextResponse.json({ ok: false, message: '기존 과업 원장을 읽지 못했습니다.' }, { status: 503 });
  }
}
