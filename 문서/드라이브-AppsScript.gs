/**
 * 큐앤뱅 대시보드 — 드라이브 파일 도우미 (Apps Script 웹앱)  [v2]
 * 사장님 계정 권한으로 실행 → 폴더 생성·파일 업로드·목록.
 * v2: uploadPath(로컬 폴더 구조 그대로 미러링) + trash(정리) 추가.
 *
 * 다시 배포: 코드 붙여넣고 저장 → 배포 > 배포 관리 > (연필) 수정 >
 *           버전 '새 버전' > 배포. 주소(URL)는 그대로 유지됩니다.
 */

var KEY = 'qnbang2026drive';
var ROOT_NAME = '큐앤뱅 작업파일';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return _json({ ok: false, error: '비밀번호 불일치' });
    switch (body.action) {
      case 'createProject': return _json(createProject(body));
      case 'upload':        return _json(upload(body));
      case 'uploadPath':    return _json(uploadPath(body));
      case 'list':          return _json(list(body));
      case 'trash':         return _json(trash(body));
      case 'rename':        return _json(rename(body));
      default:              return _json({ ok: false, error: '알 수 없는 action: ' + body.action });
    }
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function _root() {
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
}
function _typeFolder(type) {
  var name = (type === '자체') ? '자체' : '2026대행';
  var root = _root();
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

// 새 프로젝트 폴더 생성. 이름 = "YYMMDD_이름" (착수일 기준). 하위 분류는 미러링이 만든다.
// {type, name, date:"260604"}  date 없으면 이름만.
function createProject(body) {
  var parent = _typeFolder(body.type);
  var folderName = (body.date ? body.date + '_' : '') + body.name;
  var f = parent.createFolder(folderName);
  return { ok: true, id: f.getId(), name: folderName };
}

// 폴더 이름 변경 {id, name}
function rename(body) {
  DriveApp.getFolderById(body.id).setName(body.name);
  return { ok: true };
}

// 경로를 따라 하위폴더를 만들며 그 안에 파일 업로드 (로컬 구조 미러링)
// {rootId, relPath:"랜딩페이지/원본참고", filename, mimeType, dataBase64}
function uploadPath(body) {
  var folder = _ensurePath(DriveApp.getFolderById(body.rootId), body.relPath || '');
  // 같은 이름 파일이 이미 있으면 건너뜀(중복 업로드 방지)
  var dup = folder.getFilesByName(body.filename);
  if (dup.hasNext()) return { ok: true, id: dup.next().getId(), name: body.filename, skipped: true };
  var blob = Utilities.newBlob(Utilities.base64Decode(body.dataBase64), body.mimeType, body.filename);
  var file = folder.createFile(blob);
  return { ok: true, id: file.getId(), name: file.getName() };
}

function _ensurePath(root, relPath) {
  if (!relPath) return root;
  var parts = relPath.split('/').filter(function (p) { return p; });
  var f = root;
  for (var i = 0; i < parts.length; i++) {
    var it = f.getFoldersByName(parts[i]);
    f = it.hasNext() ? it.next() : f.createFolder(parts[i]);
  }
  return f;
}

function upload(body) {
  var folder = DriveApp.getFolderById(body.folderId);
  var blob = Utilities.newBlob(Utilities.base64Decode(body.dataBase64), body.mimeType, body.filename);
  var file = folder.createFile(blob);
  return { ok: true, id: file.getId(), name: file.getName() };
}

function list(body) {
  var folder = DriveApp.getFolderById(body.folderId);
  var out = [];
  var fit = folder.getFolders();
  while (fit.hasNext()) { var sf = fit.next(); out.push({ id: sf.getId(), name: sf.getName(), isFolder: true }); }
  var it = folder.getFiles();
  while (it.hasNext()) {
    var file = it.next();
    out.push({
      id: file.getId(), name: file.getName(), mimeType: file.getMimeType(),
      size: String(file.getSize()), modifiedTime: file.getLastUpdated().toISOString(),
      webViewLink: file.getUrl(),
      thumbnailLink: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400',
      isFolder: false,
    });
  }
  return { ok: true, files: out };
}

// 파일/폴더 휴지통으로 (정리용) {id}
function trash(body) {
  DriveApp.getFolderById(body.id).setTrashed(true);
  return { ok: true };
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
