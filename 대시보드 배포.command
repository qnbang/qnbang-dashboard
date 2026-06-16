#!/bin/bash
# 큐앤뱅 대시보드를 Vercel에 올리는 자동 배포 버튼.
# 이 파일을 더블클릭하면: 커밋 작성자 자동 교정 → 빌드 → 배포까지 한 번에 진행됩니다.
# (배포가 막혔던 원인인 "커밋 작성자 이메일 불일치"를 자동으로 막아줍니다.)

set -e
cd "$(dirname "$0")"

echo "════════════════════════════════════════"
echo "  큐앤뱅 대시보드 배포를 시작합니다"
echo "════════════════════════════════════════"

# 1) 배포 차단 방지 — 이 폴더의 커밋 작성자를 Vercel 계정 이메일로 고정
git config user.email "ceo@qnbang.com"
git config user.name "신종호"
echo "✓ 커밋 작성자를 ceo@qnbang.com 으로 맞췄습니다."

# 2) 바뀐 내용이 있으면 커밋 (없으면 그냥 넘어감)
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "대시보드 업데이트 ($(date '+%Y-%m-%d %H:%M'))"
  echo "✓ 바뀐 내용을 저장(커밋)했습니다."
else
  echo "· 바뀐 내용이 없어 저장은 건너뜁니다."
fi

# 3) 로컬에서 빌드 (Vercel 빌드 큐를 거치지 않아 더 안정적)
echo "· 빌드 중… (잠시 걸립니다)"
npx vercel build --prod

# 4) 빌드 결과물을 프로덕션으로 업로드
echo "· 업로드 중…"
npx vercel deploy --prebuilt --prod --yes

echo "════════════════════════════════════════"
echo "  ✅ 배포 완료!"
echo "  주소: https://dashboard.qnbang.com"
echo "════════════════════════════════════════"
echo ""
echo "이 창은 닫으셔도 됩니다."
