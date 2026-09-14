// 확인한 실제 원장 형식의 읽기 회귀검사. 네트워크·원장 쓰기 없음.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const code = stripTypeScriptTypes(readFileSync(new URL('../app/api/operating/projects/route.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, ''));
const { normalize, lifecycle } = vm.runInNewContext(`${code}\n({ normalize: 할일정규화, lifecycle: 수명주기 })`, {});
const header = ['할일ID', '프로젝트ID', '진행ID', '할 일', '상태', '담당', '마감', '거래상대ID', '일정ID', '원문ID', '생성시각'];
const row = values => Object.fromEntries(header.map((key,i)=>[key,values[i]||'']));
const normal = normalize(row(['P-003-T001','P-003','P-003-G001','행사 기획','완료','담당','2026-09-19','','','수신1']), 'P-003');
assert.equal(normal.title,'행사 기획');assert.equal(normal.due,'2026-09-19');assert.equal(normal.source,'수신1');
assert.equal(normalize(row(['P-003-T001','P-003','P-003-G001','행사 기획','고객대기','담당']), 'P-001').validShape,false);
const legacy = normalize(row(['B-002-T-M017','홈페이지 리뉴얼','확인 필요','담당','완료','','기존 대시보드 이관']), 'B-002');
assert.equal(legacy.title,'홈페이지 리뉴얼');assert.equal(legacy.status,'완료');
const older = normalize(row(['이관-20260810-T11','보안 경고 확인','진행 중','담당','큐앤뱅 계정 관리','','기존 과업 원장']), 'B-002');
assert.equal(older.title,'큐앤뱅 계정 관리');assert.equal(older.next,'보안 경고 확인');
assert.equal(lifecycle('제안중(계약전)',''),'착수 전');
assert.equal(lifecycle('진행 중',''),'현재 진행');
console.log('프로젝트 읽기 회귀검사 통과: 실제 헤더, 과거행, 다른 프로젝트ID, 착수 전 상태');
