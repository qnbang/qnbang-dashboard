import { copyFile, lstat, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [source, target] = process.argv.slice(2);
if (!source || !target) throw new Error('원본과 대상 경로가 필요합니다.');

const 제외폴더 = new Set(['.git', '.next', 'node_modules', '__pycache__', 'venv', '.venv']);
const 제외파일 = (name) => name === '.DS_Store' || name.endsWith('.pyc') || name.endsWith('.log') || name === '.env' || name.startsWith('.env.');
const 결과 = { 시작: new Date().toISOString(), 복사: 0, 건너뜀: 0, 오류: [] };

async function 같은파일(원본, 대상) {
  try { return (await stat(원본)).size === (await stat(대상)).size; } catch { return false; }
}

async function 옮길내용(원본경로, 대상경로) {
  let 항목들;
  try {
    항목들 = await readdir(원본경로, { withFileTypes: true });
    await mkdir(대상경로, { recursive: true });
  } catch (error) {
    결과.오류.push({ 경로: 원본경로, 사유: error instanceof Error ? error.message : String(error) });
    return;
  }
  for (const 항목 of 항목들) {
    if (항목.isDirectory() && 제외폴더.has(항목.name)) { 결과.건너뜀 += 1; continue; }
    if (항목.isFile() && 제외파일(항목.name)) { 결과.건너뜀 += 1; continue; }
    const 원본 = path.join(원본경로, 항목.name);
    const 대상 = path.join(대상경로, 항목.name);
    try {
      if (항목.isDirectory()) await 옮길내용(원본, 대상);
      else if (항목.isFile()) {
        if (await 같은파일(원본, 대상)) 결과.건너뜀 += 1;
        else { await copyFile(원본, 대상); 결과.복사 += 1; }
      } else if ((await lstat(원본)).isSymbolicLink()) 결과.건너뜀 += 1;
    } catch (error) {
      결과.오류.push({ 경로: 원본, 사유: error instanceof Error ? error.message : String(error) });
    }
  }
}

await 옮길내용(source, target);
결과.완료 = new Date().toISOString();
await writeFile(path.join(target, '_이관결과.json'), JSON.stringify(결과, null, 2));
console.log(JSON.stringify({ 복사: 결과.복사, 건너뜀: 결과.건너뜀, 오류: 결과.오류.length }));
