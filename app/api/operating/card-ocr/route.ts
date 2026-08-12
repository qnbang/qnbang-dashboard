import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const 최대이미지바이트 = 8 * 1024 * 1024;

function 명함필드(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = text.match(/(?:\+?82[-.\s]?)?(?:0?1[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/)?.[0] || '';
  const roleLine = lines.find((line) => /(대표|이사|실장|팀장|부장|차장|과장|대리|매니저|디렉터|책임|연구원|CEO|Director|Manager)/i.test(line)) || '';
  const companyLine = lines.find((line) => /(주식회사|\(주\)|유한회사|협회|연구소|스튜디오|센터|컴퍼니|company|studio|inc\.?|corp\.?|co\.,?\s*ltd)/i.test(line)) || '';
  const nameCandidates = lines.filter((line) => /^[가-힣]{2,4}$/.test(line) && !/(대표|이사|실장|팀장|부장|차장|과장|대리)/.test(line));
  return {
    이름: nameCandidates[0] || '',
    회사명: companyLine,
    직함: roleLine.replace(nameCandidates[0] || /^$/, '').trim(),
    연락처: phone,
    이메일: email,
  };
}

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await request.json() as { imageBase64?: string; mimeType?: string };
    if (!imageBase64 || !mimeType?.startsWith('image/')) return NextResponse.json({ error: '명함 이미지를 확인할 수 없습니다.' }, { status: 400 });
    if (Buffer.byteLength(imageBase64, 'base64') > 최대이미지바이트) return NextResponse.json({ error: '명함 이미지는 8MB 이하로 올려 주세요.' }, { status: 413 });
    const serviceAccount = JSON.parse(process.env.GOOGLE_SA_JSON || '');
    const auth = new google.auth.JWT({ email: serviceAccount.client_email, key: serviceAccount.private_key, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const token = await auth.getAccessToken();
    if (!token.token) throw new Error('OCR 인증 토큰을 받을 수 없습니다.');
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', { method: 'POST', headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ image: { content: imageBase64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] }) });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: result?.error?.message || 'OCR 서비스를 사용할 수 없습니다.' }, { status: 502 });
    const text = result?.responses?.[0]?.fullTextAnnotation?.text?.trim() || result?.responses?.[0]?.textAnnotations?.[0]?.description?.trim() || '';
    if (!text) return NextResponse.json({ error: '명함에서 읽을 수 있는 글자를 찾지 못했습니다.' }, { status: 422 });
    return NextResponse.json({ text, fields: 명함필드(text) });
  } catch {
    return NextResponse.json({ error: 'OCR 설정 또는 이미지 처리에 실패했습니다.' }, { status: 500 });
  }
}
