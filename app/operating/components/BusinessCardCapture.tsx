'use client';

import { ChangeEvent, useEffect, useId, useRef, useState } from 'react';

export type 명함등록값 = {
  이름: string;
  회사명: string;
  직함: string;
  연락처: string;
  이메일: string;
  구분: '회사' | '개인' | '담당자';
  메모: string;
  원문: string;
  이미지?: File;
};

type 명함등록컴포넌트속성 = {
  기본값?: Partial<명함등록값>;
  onSubmit?: (값: 명함등록값) => void | Promise<void>;
  onCancel?: () => void;
  제출문구?: string;
};

const 빈값: Omit<명함등록값, '이미지'> = {
  이름: '',
  회사명: '',
  직함: '',
  연락처: '',
  이메일: '',
  구분: '담당자',
  메모: '',
  원문: '',
};

const 라벨스타일 = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 7,
  color: 'var(--muted, #667085)',
  fontSize: 13,
  fontWeight: 600,
};

const 입력스타일 = {
  width: '100%',
  minHeight: 44,
  boxSizing: 'border-box' as const,
  border: '1px solid var(--line, #e5e7eb)',
  borderRadius: 8,
  padding: '0 12px',
  background: 'var(--canvas, #fff)',
  color: 'var(--ink, #182230)',
  font: '400 14px inherit',
};

/**
 * 카메라 또는 이미지 선택 뒤 사람이 내용을 확인해서 등록하는 명함 입력 화면입니다.
 * OCR 연결 전에는 원문 입력란을 바로 수정해 사용할 수 있습니다.
 */
export default function BusinessCardCapture({ 기본값, onSubmit, onCancel, 제출문구 = '고객 정보에 등록' }: 명함등록컴포넌트속성) {
  const [값, set값] = useState<Omit<명함등록값, '이미지'>>({ ...빈값, ...기본값 });
  const [이미지, set이미지] = useState<File>();
  const [미리보기, set미리보기] = useState<string>();
  const [저장중, set저장중] = useState(false);
  const [인식상태, set인식상태] = useState<'대기' | '읽는 중' | '완료' | '지원 안 됨' | '실패'>('대기');
  const [카메라스트림, set카메라스트림] = useState<MediaStream>();
  const [카메라상태, set카메라상태] = useState<'대기' | '연결 중' | '권한 거부' | '지원 안 됨' | '오류'>('대기');
  const 파일입력아이디 = useId();
  const 비디오참조 = useRef<HTMLVideoElement>(null);
  const 미리보기주소참조 = useRef<string | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (미리보기주소참조.current) URL.revokeObjectURL(미리보기주소참조.current);
    };
  }, []);

  useEffect(() => {
    if (!카메라스트림 || !비디오참조.current) return;
    비디오참조.current.srcObject = 카메라스트림;
    비디오참조.current.play().catch(() => set카메라상태('오류'));
    return () => 카메라스트림.getTracks().forEach((트랙) => 트랙.stop());
  }, [카메라스트림]);

  const 값변경 = (항목: keyof Omit<명함등록값, '이미지'>, 내용: string) => {
    set값((현재) => ({ ...현재, [항목]: 내용 }));
  };

  const 이미지설정 = (파일: File) => {
    if (미리보기주소참조.current) URL.revokeObjectURL(미리보기주소참조.current);
    const 주소 = URL.createObjectURL(파일);
    미리보기주소참조.current = 주소;
    set이미지(파일);
    set미리보기(주소);
  };

  const 파일선택 = (event: ChangeEvent<HTMLInputElement>) => {
    const 선택한파일 = event.target.files?.[0];
    if (선택한파일) {
      이미지설정(선택한파일);
      set인식상태('대기');
    }
  };

  const 카메라시작 = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      set카메라상태('지원 안 됨');
      return;
    }
    카메라스트림?.getTracks().forEach((트랙) => 트랙.stop());
    set카메라상태('연결 중');
    try {
      const 스트림 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      set카메라스트림(스트림);
      set카메라상태('대기');
    } catch (오류) {
      const 이름 = 오류 instanceof DOMException ? 오류.name : '';
      set카메라상태(이름 === 'NotAllowedError' || 이름 === 'SecurityError' ? '권한 거부' : '오류');
    }
  };

  const 카메라종료 = () => set카메라스트림(undefined);

  const 촬영하기 = () => {
    const 비디오 = 비디오참조.current;
    if (!비디오 || !비디오.videoWidth || !비디오.videoHeight) {
      set카메라상태('오류');
      return;
    }
    const 캔버스 = document.createElement('canvas');
    캔버스.width = 비디오.videoWidth;
    캔버스.height = 비디오.videoHeight;
    캔버스.getContext('2d')?.drawImage(비디오, 0, 0, 캔버스.width, 캔버스.height);
    캔버스.toBlob((결과) => {
      if (!결과) {
        set카메라상태('오류');
        return;
      }
      이미지설정(new File([결과], `명함-${new Date().toISOString().slice(0, 10)}.jpg`, { type: 'image/jpeg' }));
      set인식상태('대기');
      카메라종료();
    }, 'image/jpeg', 0.92);
  };

  const 명함내용읽기 = async () => {
    if (!이미지) return;
    set인식상태('읽는 중');
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(이미지);
      });
      const response = await fetch('/api/operating/card-ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64, mimeType: 이미지.type }) });
      const result = await response.json();
      if (!response.ok || !result.text) throw new Error(result.error || '명함을 읽지 못했습니다.');
      set값((현재) => ({ ...현재, 원문: result.text }));
      set인식상태('완료');
    } catch {
      set인식상태('실패');
    }
  };

  const 제출 = async () => {
    if (!값.이름.trim() && !값.회사명.trim()) return;
    set저장중(true);
    try {
      await onSubmit?.({ ...값, 이미지 });
    } finally {
      set저장중(false);
    }
  };

  return <section aria-label="명함 등록" style={{ border: '1px solid var(--line, #e5e7eb)', borderRadius: 12, background: 'var(--canvas, #fff)', padding: 24 }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, paddingBottom: 20, borderBottom: '1px solid var(--line, #e5e7eb)' }}>
      <div>
        <h2 style={{ margin: '0 0 6px', color: 'var(--ink, #182230)', fontSize: 20, lineHeight: 1.4 }}>명함 등록</h2>
        <p style={{ margin: 0, color: 'var(--muted, #667085)', fontSize: 13, lineHeight: 1.6 }}>사진을 올린 뒤, 읽은 내용을 확인해 고객·개인·담당자 정보로 연결합니다.</p>
      </div>
      <span style={{ alignSelf: 'flex-start', borderRadius: 999, background: '#f1f2ff', color: 'var(--accent, #5046e5)', padding: '6px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>기기 안에서 인식</span>
    </header>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, .72fr)', gap: 20, margin: '22px 0' }}>
      <div>
        {카메라스트림 ? <video ref={비디오참조} muted playsInline aria-label="명함 촬영 카메라" style={{ display: 'block', width: '100%', minHeight: 178, maxHeight: 280, borderRadius: 10, background: '#151822', objectFit: 'cover' }} /> : <label htmlFor={파일입력아이디} style={{ display: 'flex', minHeight: 178, cursor: 'pointer', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, border: '1px dashed var(--muted, #667085)', borderRadius: 10, background: 'var(--surface, #f7f8fa)', color: 'var(--muted, #667085)', textAlign: 'center', padding: 16 }}>
          {미리보기 ? <img src={미리보기} alt="촬영하거나 선택한 명함 미리보기" style={{ maxWidth: '100%', maxHeight: 154, borderRadius: 6, objectFit: 'contain' }} /> : <><strong style={{ color: 'var(--ink, #182230)', fontSize: 14 }}>대시보드에서 명함을 바로 촬영</strong><small style={{ fontSize: 12, lineHeight: 1.5 }}>아래 카메라 시작을 누르거나 이미지를 선택해 주세요.</small></>}
          <input id={파일입력아이디} type="file" accept="image/*" capture="environment" onChange={파일선택} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} />
        </label>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {카메라스트림 ? <><button type="button" onClick={촬영하기} style={{ minHeight: 38, padding: '0 12px', border: 0, borderRadius: 8, background: 'var(--accent, #5046e5)', color: '#fff', font: '600 13px inherit', cursor: 'pointer' }}>이 화면으로 촬영</button><button type="button" onClick={카메라종료} style={{ minHeight: 38, padding: '0 12px', border: '1px solid var(--line, #e5e7eb)', borderRadius: 8, background: 'var(--canvas, #fff)', color: 'var(--ink, #182230)', font: '600 13px inherit', cursor: 'pointer' }}>카메라 종료</button></> : <><button type="button" onClick={카메라시작} disabled={카메라상태 === '연결 중'} style={{ minHeight: 38, padding: '0 12px', border: 0, borderRadius: 8, background: 카메라상태 === '연결 중' ? '#e9eaf0' : 'var(--accent, #5046e5)', color: 카메라상태 === '연결 중' ? '#98a2b3' : '#fff', font: '600 13px inherit', cursor: 카메라상태 === '연결 중' ? 'wait' : 'pointer' }}>{카메라상태 === '연결 중' ? '카메라 연결 중…' : '카메라 시작'}</button><label htmlFor={파일입력아이디} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 38, boxSizing: 'border-box', padding: '0 12px', border: '1px solid var(--line, #e5e7eb)', borderRadius: 8, background: 'var(--canvas, #fff)', color: 'var(--ink, #182230)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>이미지 선택</label></>}
        </div>
        {(카메라상태 === '권한 거부' || 카메라상태 === '지원 안 됨' || 카메라상태 === '오류') && <p role="status" style={{ margin: '9px 0 0', color: 'var(--muted, #667085)', fontSize: 12, lineHeight: 1.55 }}>{카메라상태 === '권한 거부' ? '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라를 허용하거나 이미지 선택을 이용해 주세요.' : 카메라상태 === '지원 안 됨' ? '이 브라우저에서는 카메라 촬영을 지원하지 않습니다. 이미지 선택을 이용해 주세요.' : '카메라를 시작하지 못했습니다. 다른 앱이 사용 중인지 확인하거나 이미지 선택을 이용해 주세요.'}</p>}
      </div>
      <label style={라벨스타일}>명함 원문
        <textarea value={값.원문} onChange={(event) => 값변경('원문', event.target.value)} placeholder="OCR 연결 전에는 명함에 적힌 내용을 직접 붙여 넣을 수 있습니다." style={{ ...입력스타일, minHeight: 178, padding: 12, resize: 'vertical' }} />
      </label>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '-6px 0 20px', padding: 12, borderRadius: 8, background: 'var(--surface, #f7f8fa)' }}>
      <button type="button" disabled={!이미지 || 인식상태 === '읽는 중'} onClick={명함내용읽기} style={{ minHeight: 38, flexShrink: 0, padding: '0 12px', border: 0, borderRadius: 8, background: !이미지 || 인식상태 === '읽는 중' ? '#e9eaf0' : 'var(--accent, #5046e5)', color: !이미지 || 인식상태 === '읽는 중' ? '#98a2b3' : '#fff', font: '600 13px inherit', cursor: !이미지 || 인식상태 === '읽는 중' ? 'not-allowed' : 'pointer' }}>{인식상태 === '읽는 중' ? '명함 읽는 중…' : '명함 내용 읽기'}</button>
      <p role="status" style={{ margin: 0, color: 'var(--muted, #667085)', fontSize: 12, lineHeight: 1.55 }}>
        {인식상태 === '실패' ? 'OCR이 명함을 읽지 못했습니다. 사진을 다시 찍거나 원문을 직접 입력해 주세요.' : 인식상태 === '완료' ? 'OCR이 읽은 내용을 원문 칸에 넣었습니다. 정확도를 확인해 수정해 주세요.' : '촬영 이미지는 큐앤뱅 구글 클라우드 OCR에서 읽고, 인식 결과는 사람이 확인한 뒤에만 등록합니다.'}
      </p>
    </div>

    <p style={{ margin: '-8px 0 20px', color: 'var(--muted, #667085)', fontSize: 12, lineHeight: 1.55 }}>자동 인식 결과도 바로 저장하지 않습니다. 아래 정보를 사람이 확인·수정한 뒤 등록합니다.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
      <label style={라벨스타일}>구분
        <select value={값.구분} onChange={(event) => 값변경('구분', event.target.value)} style={입력스타일}>
          <option value="회사">회사</option>
          <option value="개인">개인</option>
          <option value="담당자">담당자</option>
        </select>
      </label>
      <label style={라벨스타일}>이름
        <input value={값.이름} onChange={(event) => 값변경('이름', event.target.value)} placeholder="예: 홍길동" style={입력스타일} />
      </label>
      <label style={라벨스타일}>회사명
        <input value={값.회사명} onChange={(event) => 값변경('회사명', event.target.value)} placeholder="예: 큐앤뱅" style={입력스타일} />
      </label>
      <label style={라벨스타일}>직함
        <input value={값.직함} onChange={(event) => 값변경('직함', event.target.value)} placeholder="예: 대표, 마케팅 담당" style={입력스타일} />
      </label>
      <label style={라벨스타일}>연락처
        <input inputMode="tel" value={값.연락처} onChange={(event) => 값변경('연락처', event.target.value)} placeholder="010-0000-0000" style={입력스타일} />
      </label>
      <label style={라벨스타일}>이메일
        <input inputMode="email" value={값.이메일} onChange={(event) => 값변경('이메일', event.target.value)} placeholder="name@company.com" style={입력스타일} />
      </label>
      <label style={{ ...라벨스타일, gridColumn: '1 / -1' }}>메모
        <input value={값.메모} onChange={(event) => 값변경('메모', event.target.value)} placeholder="만난 자리, 연결할 고객사·프로젝트 등" style={입력스타일} />
      </label>
    </div>

    <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--line, #e5e7eb)' }}>
      {onCancel && <button type="button" onClick={onCancel} style={{ minHeight: 42, padding: '0 14px', border: '1px solid var(--line, #e5e7eb)', borderRadius: 8, background: 'var(--canvas, #fff)', color: 'var(--ink, #182230)', font: '600 14px inherit', cursor: 'pointer' }}>취소</button>}
      <button type="button" disabled={저장중 || (!값.이름.trim() && !값.회사명.trim())} onClick={제출} style={{ minHeight: 42, padding: '0 14px', border: 0, borderRadius: 8, background: 저장중 || (!값.이름.trim() && !값.회사명.trim()) ? '#e9eaf0' : 'var(--accent, #5046e5)', color: 저장중 || (!값.이름.trim() && !값.회사명.trim()) ? '#98a2b3' : '#fff', font: '600 14px inherit', cursor: 저장중 ? 'wait' : 'pointer' }}>{저장중 ? '등록 중…' : 제출문구}</button>
    </footer>
  </section>;
}
