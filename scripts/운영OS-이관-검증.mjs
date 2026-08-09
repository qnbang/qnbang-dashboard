import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [source, target] = process.argv.slice(2);
if (!source || !target) throw new Error('원본과 대상 경로가 필요합니다.');

const 제외폴더 = new Set(['.git', '.next', 'node_modules', '__pycache__', 'venv', '.venv']);
const 제외파일 = (name) => name === '.DS_Store' || name.endsWith('.pyc') || name.endsWith('.log') || name === '.env' || name.startsWith('.env.');
const 결과 = { 검사: 0, 일치: 0, 누락: [], 크기불일치: [] };

async function 검사(원본경로, 대상경로) {
  for (const 항목 of await readdir(원본경로, { withFileTypes: true })) {
    if (항목.isDirectory() && 제외폴더.has(항목.name)) continue;
    if (항목.isFile() && 제외파일(항목.name)) continue;
    const 원본 = path.join(원본경로, 항목.name);
    const 대상 = path.join(대상경로, 항목.name);
    if (항목.isDirectory()) await 검사(원본, 대상);
    else if (항목.isFile()) {
      결과.검사 += 1;
      try {
        const [원본정보, 대상정보] = await Promise.all([stat(원본), stat(대상)]);
        if (원본정보.size === 대상정보.size) 결과.일치 += 1;
        else 결과.크기불일치.push({ 경로: path.relative(source, 원본), 원본: 원본정보.size, 대상: 대상정보.size });
      } catch { 결과.누락.push(path.relative(source, 원본)); }
    }
  }
}

await 검사(source, target);
await writeFile(path.join(target, '_이관검증결과.json'), JSON.stringify(결과, null, 2));
console.log(JSON.stringify({ 검사: 결과.검사, 일치: 결과.일치, 누락: 결과.누락.length, 크기불일치: 결과.크기불일치.length }));
