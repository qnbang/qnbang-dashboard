// 실제 시트에 접속하지 않고 수신함→할 일의 재시도와 입력 처리를 확인한다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

const taskHeader = ['할일ID', '할 일', '상태', '담당', '프로젝트ID', '출처', '생성시각', '기한'];
const taskRows = [];
const inboxHeader = ['메시지ID', '수신ID', '할일ID', '프로젝트ID', '처리상태'];
const inboxRows = [['메시지1', '수신1', '', '', '확인 전']];
let appends = 0;
const values = {
  async get({ range }) {
    return { data: { values: range.startsWith('프로젝트!') ? [['프로젝트ID', '원장시트ID'], ['P1', 'ledger1']] : range.startsWith('수신연결!') ? [inboxHeader, ...inboxRows] : [taskHeader, ...taskRows] } };
  },
  async append({ valueInputOption, requestBody }) {
    assert.equal(valueInputOption, 'RAW');
    taskRows.push(...requestBody.values); appends += 1;
  },
  async batchUpdate({ requestBody }) {
    assert.equal(requestBody.valueInputOption, 'RAW');
    for (const item of requestBody.data) {
      const match = item.range.match(/!([A-Z])(\d+)/);
      inboxRows[Number(match[2]) - 2][match[1].charCodeAt(0) - 65] = item.values[0][0];
    }
  },
};
function load(path) {
  const code = stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, ''));
  const context = vm.createContext({ randomUUID, process: { env: { GOOGLE_SA_JSON: '{}' } }, google: { auth: { JWT: class {} }, sheets: () => ({ spreadsheets: { values } }) }, NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } });
  return vm.runInContext(`${code}\n({ POST: typeof POST === 'undefined' ? undefined : POST, PATCH })`, context);
}
const request = (body) => ({ json: async () => body });
const tasks = load('../app/api/operating/project-tasks/route.ts');
const inbox = load('../app/api/operating/inbox/route.ts');
await tasks.POST(request({ projectId: 'P1', title: '수동 하나' }));
await tasks.POST(request({ projectId: 'P1', title: '수동 둘' }));
assert.equal(appends, 2, '같은 기본 출처의 수동 할 일도 각각 추가');
const body = { projectId: 'P1', title: '=IMPORTXML("https://example.com")', owner: '담당', due: '2026-09-20', inboxId: '수신1' };
const first = await tasks.POST(request(body));
const retry = await tasks.POST(request(body));
assert.equal(retry.data.reused, true);
assert.equal(first.data.task.id, retry.data.task.id);
assert.equal(appends, 3, '동일 수신 재시도는 추가하지 않음');
assert.equal(taskRows[2][1], body.title);
assert.equal(taskRows[2][7], body.due);
assert.match(taskRows[2][6], /^\d{4}-\d{2}-\d{2}T/);
assert.equal((await tasks.POST(request({ ...body, due: '2026-02-30' }))).status, 400);
assert.equal((await inbox.PATCH(request({ inboxId: '수신1', status: '검토중' }))).status, 200);
assert.equal(inboxRows[0][4], '검토중');
assert.equal((await inbox.PATCH(request({ inboxId: '수신1', status: '무시' }))).status, 200);
assert.equal(inboxRows[0][4], '무시');
const link = { inboxId: '수신1', taskId: first.data.task.id, projectId: 'P1', status: '확정 반영' };
assert.equal((await inbox.PATCH(request(link))).status, 200);
assert.equal(inboxRows[0][3], 'P1');
assert.equal(inboxRows[0][4], '확정 반영');
assert.equal((await inbox.PATCH(request(link))).status, 200);
assert.equal((await inbox.PATCH(request({ ...link, taskId: '다른할일' }))).status, 409);
assert.equal((await inbox.PATCH(request({ inboxId: '수신1', status: '무시' }))).status, 409);
console.log('수신함 회귀검사 통과: 수동 추가, 재시도, 날짜, 원문 보존, 처리 상태, 연결 충돌');
taskHeader[5] = '원문ID'; taskHeader[7] = '마감';
const actualHeader = await tasks.POST(request({ ...body, inboxId: '수신2' }));
assert.equal(actualHeader.status, 200);
assert.equal(taskRows.at(-1)[5], '수신2');
assert.equal(taskRows.at(-1)[7], body.due);
assert.equal((await tasks.POST(request({ ...body, inboxId: '수신2' }))).data.reused, true);
console.log('실제 원문ID·마감 헤더 저장 및 재시도 검사 통과');
