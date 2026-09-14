// 폴더 기반 범위·동일 번호 충돌·자체브랜드 분리·최소 메뉴 회귀검사.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const route=stripTypeScriptTypes(readFileSync(new URL('../app/api/operating/projects/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''));
const {scope,lifecycle}=vm.runInNewContext(`${route}\n({scope:운영대상,lifecycle:수명주기})`,{});
const actual=scope([
 {프로젝트ID:'P-002',프로젝트명:'002_옛 고객',구분:'대행','드라이브 폴더':'https://drive.google.com/drive/folders/old'},
 {프로젝트ID:'P-025',프로젝트명:'옛 이름',구분:'대행',상태:'완료','드라이브 폴더':'https://drive.google.com/drive/folders/done'},
 {프로젝트ID:'L-01',프로젝트명:'과거',구분:'과거 기록','드라이브 폴더':'https://drive.google.com/drive/folders/legacy'},
 {프로젝트ID:'B-007',프로젝트명:'자동화청년',구분:'자체브랜드'},
 {프로젝트ID:'B-008',프로젝트명:'반보',구분:'자체브랜드'},
], [{id:'new',name:'002_봉밀가'},{id:'done',name:'025_롯데웰푸드'},{id:'archive',name:'2026 이전 프로젝트'}]);
assert.deepEqual(Array.from(actual,x=>x.프로젝트명),['002_봉밀가','025_롯데웰푸드','자동화청년','반보']);
assert.equal(actual[0].프로젝트ID,'folder-new');assert.equal(actual[0].상태,'확인 필요');assert.equal(actual[1].상태,'완료');
assert.equal(lifecycle('확인 필요',''),'확인 필요');
const page=readFileSync(new URL('../app/operating/page.tsx',import.meta.url),'utf8');
const menu=page.match(/items: \[([^\]]+)\]/)[1].match(/'[^']+'/g).map(s=>s.slice(1,-1));
assert.deepEqual(menu,['홈','수신함','할 일','캘린더','프로젝트','자체브랜드','고객 관리','재무·정산']);
for(const endpoint of ['experiments','tools','sync-log'])assert.ok(!page.includes(`fetch('/api/operating/${endpoint}')`));
assert.ok(page.includes('projects={projectItems}'));assert.ok(page.includes('!자체브랜드(p)'));assert.ok(page.includes('brandItems.map'));
console.log('폴더ID 범위·브랜드 분리·8개 메뉴 검사 통과');
const executionFilter=page.match(/const executionTasks = ([^;]+);/)[1];
const execution=vm.runInNewContext(executionFilter,{currentProjects:[{name:'진행 프로젝트'}],homeTasks:[{project:'고객대기 프로젝트',title:'회신 후 실행'},{project:'진행 프로젝트',title:'지금 실행'}]});
assert.deepEqual(Array.from(execution,t=>t.title),['지금 실행']);
assert.ok(page.includes('executionTasks.slice(0,3)'));
console.log('홈 실행 목록에서 고객대기 과업 제외 검사 통과');
