// 가상 공유 좌표 해석기 — 게시판의 "저장소 파일이 아닌 글"도 공유할 수 있게 한다.
// 공유 시스템(share.ts·share 페이지)은 repo+path 로 문서를 찾는데, 직접 쓴 글/시트 리서치/허브 회의록은
// 실제 파일이 없다. 그래서 repo 를 '@post'·'@sheet'·'@hub' 가상 좌표로 두고, 여기서 현재 본문을 즉석에서
// 마크다운으로 만들어 준다(스냅샷 아님 → 원본을 고치면 공유 페이지도 바로 최신).
import { getBoard } from './boards';
import { getSheets } from './sheetCache';
import { sheetToObjects } from './sheetUtil';
import { HUB } from './hubs';

// repo 가 가상 좌표인지
export function isVirtualRepo(repo: string): boolean {
  return repo === '@post' || repo === '@sheet' || repo === '@hub';
}

// 가상 좌표(repo,path) → 마크다운. 못 찾으면 null(공유 페이지가 404 처리).
export async function resolveVirtualDoc(repo: string, path: string): Promise<string | null> {
  if (repo === '@post') {
    // path = 전역 글 id (boards/posts.json)
    const { entries } = await getBoard('posts');
    const e = entries.find((x) => x.id === path);
    if (!e) return null;
    const heading = e.title ? `# ${e.title}\n\n` : '';
    return heading + (e.body || e.desc || '');
  }
  if (repo === '@sheet') {
    // path = 과업 시트 행 id — 리서치 글의 본문 = 메모
    const sh = await getSheets();
    const row = sheetToObjects(sh['과업']).find((t) => (t['id'] || '') === path);
    if (!row) return null;
    const title = row['프로젝트'] || row['과업명'] || '';
    return (title ? `# ${title}\n\n` : '') + (row['메모'] || row['현재상태'] || '');
  }
  if (repo === '@hub') {
    // path = `${hubKey}/${idx}` — 허브 회의 게시판의 한 항목
    const slash = path.lastIndexOf('/');
    const key = path.slice(0, slash);
    const idx = Number(path.slice(slash + 1));
    if (!HUB[key]) return null;
    const { entries } = await getBoard(key);
    const e = entries[idx];
    if (!e) return null;
    return (e.title ? `# ${e.title}\n\n` : '') + (e.body || e.desc || '');
  }
  return null;
}
