#!/bin/bash
# 대시보드에 Resend 키를 넣고 재배포 → 설문 응답 메일(info@qnbang.com) 발송을 켠다.
# 일찜오파스타의 키는 'Sensitive'로 저장돼 CLI로 값을 못 꺼낸다 → 값을 한 번만 붙여넣는다.
# (값은 화면에 안 보이게 입력됨. 키를 저장해둔 게 없으면 resend.com → API Keys 에서
#  새로 하나 만들면 됨 — 도메인 qnbang.com은 이미 verified 라 바로 발송 가능.)
set -e
DASH=~/Documents/QNB_work/큐앤뱅-사내시스템/큐앤뱅-사내웹대시보드

echo "큐앤뱅 Resend 키를 붙여넣고 엔터 (화면에 안 보입니다):"
read -rs KEY; echo
if [ -z "$KEY" ]; then echo "✗ 빈 값 — 중단."; exit 1; fi
case "$KEY" in
  re_*) ;;                       # Resend 키는 re_ 로 시작
  *) echo "✗ Resend 키는 보통 're_' 로 시작합니다. 잘못 붙여넣은 것 같아 중단."; exit 1;;
esac

cd "$DASH"
echo "① 대시보드에 RESEND_API_KEY 등록…"
vercel env rm RESEND_API_KEY production -y >/dev/null 2>&1 || true   # 있으면 지우고 새로(멱등)
printf '%s' "$KEY" | vercel env add RESEND_API_KEY production >/dev/null 2>&1
unset KEY
echo "   ✓ 등록 완료"

echo "② 재배포(환경변수 적용)…"
vercel --prod >/dev/null 2>&1
echo ""
echo "완료! https://dashboard.qnbang.com/survey/good-movement-survey 에서"
echo "작성·제출하면 info@qnbang.com 으로 응답 메일이 옵니다."
