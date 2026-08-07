import { readFile } from "node:fs/promises";
import { google } from "googleapis";

const rootFolderName = "00_운영OS_실험";
const ownerEmail = "chairlie92.biz@gmail.com";
const spreadsheetTitle = "큐앤뱅 운영OS 실험 원장";

const sheets = [
  ["고객", ["고객ID", "고객사명", "담당자", "연락처", "상태", "최근대화일", "메모", "드라이브폴더", "생성일", "수정일"]],
  ["프로젝트", ["프로젝트ID", "프로젝트명", "고객ID", "상태", "담당자", "시작일", "마감일", "드라이브폴더", "다음행동", "생성일", "수정일"]],
  ["할일", ["할일ID", "제목", "프로젝트ID", "고객ID", "담당자", "상태", "마감일", "시간", "원문출처", "원문링크", "캘린더이벤트ID", "생성일", "수정일"]],
  ["일정", ["일정ID", "제목", "프로젝트ID", "고객ID", "시작", "종료", "출처", "구글캘린더이벤트ID", "메모"]],
  ["수신연결", ["수신ID", "채널", "메시지ID", "보낸이", "본문", "수신시각", "고객ID", "프로젝트ID", "할일ID", "처리상태", "원문링크"]],
  ["정산확인대기", ["거래ID", "거래시각", "상대", "입금액", "출금액", "자동분류", "확신도", "후보고객ID", "후보프로젝트ID", "확인상태", "확인자", "확인일", "원문링크"]],
  ["공용도구", ["도구ID", "이름", "목적", "소유자", "맥지원", "윈도우지원", "드라이브링크", "사용법링크", "상태"]],
  ["설정", ["키", "값", "설명"]],
];

const key = JSON.parse(await readFile(new URL("../google-key.json", import.meta.url), "utf8"));
const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });
const sheetsApi = google.sheets({ version: "v4", auth });

const existing = await drive.files.list({
  q: `name = '${spreadsheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
  fields: "files(id, webViewLink)",
  pageSize: 1,
});

if (existing.data.files?.[0]?.webViewLink) {
  console.log(JSON.stringify({ status: "already_exists", url: existing.data.files[0].webViewLink }));
  process.exit(0);
}

const root = await drive.files.list({
  q: `name = '${rootFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: "files(id)",
  pageSize: 1,
});
const rootId = root.data.files?.[0]?.id;
const created = await sheetsApi.spreadsheets.create({
  requestBody: {
    properties: { title: spreadsheetTitle },
    sheets: sheets.map(([title]) => ({ properties: { title } })),
  },
  fields: "spreadsheetId,spreadsheetUrl,sheets.properties",
});
const spreadsheetId = created.data.spreadsheetId;
if (!spreadsheetId || !created.data.spreadsheetUrl) throw new Error("실험 원장을 만들지 못했습니다.");

const data = sheets.flatMap(([title, headers]) => [{ range: `'${title}'!A1`, values: [headers] }]);
await sheetsApi.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: { valueInputOption: "USER_ENTERED", data },
});
await sheetsApi.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: created.data.sheets?.flatMap((sheet) => {
      const id = sheet.properties?.sheetId;
      if (id === undefined) return [];
      return [
        { updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
        { repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.16, green: 0.18, blue: 0.35 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
        { autoResizeDimensions: { dimensions: { sheetId: id, dimension: "COLUMNS", startIndex: 0, endIndex: 20 } } },
      ];
    }) ?? [],
  },
});

await drive.permissions.create({
  fileId: spreadsheetId,
  requestBody: { type: "user", role: "writer", emailAddress: ownerEmail },
  sendNotificationEmail: false,
});

let storedInPilotFolder = false;
if (rootId) {
  await drive.files.update({ fileId: spreadsheetId, addParents: rootId, fields: "id" });
  storedInPilotFolder = true;
}

console.log(JSON.stringify({ status: "created", url: created.data.spreadsheetUrl, storedInPilotFolder }));
