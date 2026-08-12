export const REVIEW_CHECKS = [
  { key: 'firstHook', label: '첫 문장 훅' },
  { key: 'target', label: '뾰족한 타깃' },
  { key: 'evidence', label: '실제 실행·증거' },
  { key: 'beginnerValue', label: '초보자 효용' },
  { key: 'concise', label: '간결함' },
  { key: 'voice', label: '자동화청년 말투' },
  { key: 'fact', label: '사실 확인' },
  { key: 'sensitiveCopyright', label: '민감정보·저작권' },
  { key: 'duplicate', label: '기존 글 중복' },
] as const;

export type ReviewCheckKey = (typeof REVIEW_CHECKS)[number]['key'];
export type ReviewAiStatus = 'not-run' | 'pass' | 'warning' | 'fail';
export type ReviewHumanStatus = 'unchecked' | 'pass' | 'fail';
export type ReviewVerdict = 'pending' | 'revision' | 'hold' | 'approved';

export type ReviewCheckState = { aiStatus: ReviewAiStatus; humanStatus: ReviewHumanStatus; note: string };
export type ThreadsReviewMetadata = {
  reviewId: string;
  contentId: string;
  version: number;
  checks: Array<{ key: ReviewCheckKey; aiStatus: ReviewAiStatus; humanStatus: ReviewHumanStatus; note: string }>;
  score: number | null;
  verdict: ReviewVerdict;
  reviewer: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};
