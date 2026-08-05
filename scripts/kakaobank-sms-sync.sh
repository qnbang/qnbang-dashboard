#!/bin/zsh
# 메시지 앱에 전달된 카카오뱅크 SMS를 대시보드로 보낸다.
# 설정 파일: ~/Library/Application Support/Qnbang/kakaobank-sms.env

set -eu

CONF="$HOME/Library/Application Support/Qnbang/kakaobank-sms.env"
STATE="$HOME/Library/Application Support/Qnbang/kakaobank-sms.state"
DB="$HOME/Library/Messages/chat.db"

[[ -r "$CONF" && -r "$DB" ]] || exit 0
source "$CONF"
[[ -n "${BANK_SMS_URL:-}" && -n "${BANK_SMS_TOKEN:-}" ]] || exit 0

last=0
if [[ -r "$STATE" ]]; then
  last=$(cat "$STATE")
else
  # 최초 설치 때 과거 문자를 다시 장부에 반영하지 않는다. 지금부터 들어오는 알림만 처리한다.
  /usr/bin/sqlite3 "$DB" 'SELECT coalesce(max(ROWID), 0) FROM message;' > "$STATE" || exit 0
  exit 0
fi

sql="SELECT m.ROWID, m.guid, replace(replace(coalesce(m.text,''), char(13), ''), char(10), '\\n') FROM message m WHERE m.ROWID > ${last} AND m.is_from_me = 0 AND m.text LIKE '%[카카오뱅크]%' ORDER BY m.ROWID;"
rows=$(/usr/bin/sqlite3 -separator $'\037' "$DB" "$sql") || exit 0
[[ -z "$rows" ]] && exit 0

while IFS=$'\037' read -r rowid guid text; do
  [[ -z "$rowid" || -z "$guid" ]] && continue
  json=$(python3 -c 'import json,sys; print(json.dumps({"id":sys.argv[1],"text":sys.argv[2].replace("\\\\n", "\\n")}, ensure_ascii=False))' "$guid" "$text")
  result=$(curl --silent --show-error --max-time 20 --retry 2 -X POST "$BANK_SMS_URL" -H "Authorization: Bearer $BANK_SMS_TOKEN" -H 'Content-Type: application/json' --data "$json") || exit 0
  echo "$rowid" > "$STATE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') $result" >> "$HOME/Library/Application Support/Qnbang/kakaobank-sms.log"
done <<< "$rows"
