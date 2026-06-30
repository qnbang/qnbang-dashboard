// 공용 로딩·에러 표시 — 탭마다 제각각이던 문구·스피너를 하나로 통일.
export function Loading({ text = '불러오는 중', pad = 'py-16' }: { text?: string; pad?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-slate-400 text-sm ${pad}`}>
      <span className="inline-block w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" aria-hidden />
      {text}…
    </div>
  );
}

export function ErrorBox({ msg, pad = 'py-16' }: { msg?: string; pad?: string }) {
  return (
    <div className={`text-center ${pad}`}>
      <div className="text-rose-500 text-sm font-medium">⚠️ 불러오지 못했어요</div>
      <div className="text-xs text-slate-400 mt-1">{msg || '잠시 후 새로고침 해주세요'}</div>
    </div>
  );
}
