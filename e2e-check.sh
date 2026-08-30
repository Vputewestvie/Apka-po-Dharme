#!/usr/bin/env bash
# Полный сквозной прогон живого API + проверки авторизации.
# Запуск: bash e2e-check.sh
set -u

cd "$(dirname "$0")"

unset NODE_OPTIONS
export CODEBUDDY_SAFE_DELETE_ENABLED=0

PORT="${PORT:-3001}"
B="http://localhost:$PORT"
mkdir -p logs

# --- поднимаем API ---
nohup npm run dev:api > logs/api.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null; }
trap cleanup EXIT

# ждём готовности
for i in $(seq 1 40); do
  if curl -s -m 2 -o /dev/null "$B/health"; then break; fi
  sleep 1
done

ALICE="alice-$(date +%s)"
BOB="bob-$(date +%s)"
DATE="$(date +%F)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
TOKEN="$(grep '^INTERNAL_API_TOKEN=' .env | cut -d= -f2)"

PASS=0; FAIL=0
check() { # check <ожидаемый код> <реальный код> <название>
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "  [OK]   $3  (HTTP $2)";
  else FAIL=$((FAIL+1)); echo "  [FAIL] $3  (ожидали $1, получили $2)"; fi
}

req() { # req <метод> <путь> <user|-> <тело|->  -> печатает "КОД\tТЕЛО"
  local m="$1" p="$2" u="$3" body="$4" hdr=()
  [ "$u" != "-" ] && hdr+=(-H "x-user-id: $u")
  [ "$body" != "-" ] && hdr+=(-H 'content-type: application/json' -d "$body")
  curl -s -m 15 -w '\n%{http_code}' -X "$m" "$B$p" "${hdr[@]}"
}

split() { # split "<код>\n<тело>" -> печатает тело, код в $CODE
  local out="$1"
  CODE="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

echo "=============================================="
echo " E2E ПРОГОН: $B"
echo " alice=$ALICE  bob=$BOB  date=$DATE"
echo "=============================================="

echo
echo "--- 1. health ---"
out=$(req GET /health - -); split "$out"
echo "  $BODY"; check 200 "$CODE" "GET /health"

echo
echo "--- 2. создать практику (alice) ---"
out=$(req POST /practices "$ALICE" "{\"title\":\"Медитация\",\"category\":\"mindfulness\",\"defaultDurationMinutes\":15,\"image\":{\"kind\":\"builtin\",\"ref\":\"lotus\"}}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /practices"
PID=$(printf '%s' "$BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const d=JSON.parse(s);console.log(d.data?.id ?? '')}catch(e){console.log('')}})")
echo "  practiceId=$PID"

echo
echo "--- 3. список практик alice ---"
out=$(req GET /practices "$ALICE" -); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "GET /practices"

echo
echo "--- 4. создать расписание на $DATE ---"
out=$(req POST /schedule "$ALICE" "{\"date\":\"$DATE\",\"title\":\"Утренний ритм\",\"source\":\"manual\",\"practices\":[{\"practiceId\":\"$PID\",\"plannedStartTime\":\"07:00\",\"plannedDurationMinutes\":15,\"order\":0}]}"); split "$out"
echo "  $BODY" | head -c 400; echo
check 200 "$CODE" "POST /schedule"
SPID=$(printf '%s' "$BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const d=JSON.parse(s);const it=d.data?.items??d.data?.practices??[];console.log(it[0]?.id ?? '')}catch(e){console.log('')}})")
echo "  scheduledPracticeId=$SPID"

echo
echo "--- 5. получить расписание ---"
out=$(req GET "/schedule?date=$DATE" "$ALICE" -); split "$out"
echo "  $BODY" | head -c 400; echo
if [ -z "$SPID" ]; then
  SPID=$(printf '%s' "$BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const d=JSON.parse(s);const it=d.data?.items??d.data?.practices??[];console.log(it[0]?.id ?? '')}catch(e){console.log('')}})")
  echo "  scheduledPracticeId (из GET)=$SPID"
fi
check 200 "$CODE" "GET /schedule"

echo
echo "--- 6. таймер: старт ---"
out=$(req POST /timer/start "$ALICE" "{\"scheduledPracticeId\":\"$SPID\",\"practiceId\":\"$PID\",\"plannedDurationMinutes\":15}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /timer/start"

echo
echo "--- 7. таймер: пауза ---"
out=$(req POST /timer/pause "$ALICE" "{\"scheduledPracticeId\":\"$SPID\",\"timestamp\":\"$NOW\"}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /timer/pause"

echo
echo "--- 8. таймер: возобновить ---"
out=$(req POST /timer/resume "$ALICE" "{\"scheduledPracticeId\":\"$SPID\",\"timestamp\":\"$NOW\"}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /timer/resume"

echo
echo "--- 9. таймер: +время (+5 минут, как кнопка в UI) ---"
out=$(req POST /timer/add-time "$ALICE" "{\"scheduledPracticeId\":\"$SPID\",\"timestamp\":\"$NOW\",\"minutes\":5}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /timer/add-time"

echo
echo "--- 9b. таймер: +время без параметров -> 400 (не 500) ---"
out=$(req POST /timer/add-time "$ALICE" "{\"scheduledPracticeId\":\"$SPID\",\"timestamp\":\"$NOW\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 400 "$CODE" "POST /timer/add-time без minutes/seconds -> 400"

echo
echo "--- 10. таймер: завершить ---"
out=$(req POST /timer/complete "$ALICE" "{\"scheduledPracticeId\":\"$SPID\",\"timestamp\":\"$NOW\"}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /timer/complete"

echo
echo "--- 11. дневник: запись ---"
out=$(req POST /diary "$ALICE" "{\"practiceId\":\"$PID\",\"scheduledPracticeId\":\"$SPID\",\"kind\":\"text\",\"text\":\"Тихая практика, получилось удержать внимание.\"}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /diary"

echo
echo "--- 12. дневник: список ---"
out=$(req GET /diary "$ALICE" -); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "GET /diary"

echo
echo "--- 13. статистика ---"
out=$(req GET "/statistics?period=week" "$ALICE" -); split "$out"
echo "  $BODY" | head -c 400; echo
check 200 "$CODE" "GET /statistics"

echo
echo "--- 14. материалы (домен из белого списка: advayta.org) ---"
out=$(req POST /materials "$ALICE" "{\"practiceId\":\"$PID\",\"title\":\"Статья о дыхании\",\"url\":\"https://advayta.org/breath\",\"type\":\"article\",\"sourceDomain\":\"advayta.org\"}"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "POST /materials"
out=$(req GET "/materials?practiceId=$PID" "$ALICE" -); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "GET /materials"

echo
echo "=============================================="
echo " ПРОВЕРКИ БЕЗОПАСНОСТИ"
echo "=============================================="

echo
echo "--- S1. bob правит практику alice ---"
out=$(req PATCH /practices "$BOB" "{\"practiceId\":\"$PID\",\"title\":\"ВЗЛОМАНО\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "PATCH /practices (чужой) -> 403"

echo
echo "--- S2. alice правит свою практику ---"
out=$(req PATCH /practices "$ALICE" "{\"practiceId\":\"$PID\",\"title\":\"Медитация (вечер)\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 200 "$CODE" "PATCH /practices (свой) -> 200"

echo
echo "--- S3. подмена userId в теле запроса ---"
out=$(req POST /practices "$BOB" "{\"userId\":\"$ALICE\",\"title\":\"Чужая\",\"category\":\"x\",\"defaultDurationMinutes\":5,\"image\":{\"kind\":\"builtin\",\"ref\":\"a\"}}"); split "$out"
check 200 "$CODE" "POST /practices с чужим userId в теле"
if printf '%s' "$BODY" | grep -q "\"userId\":\"$ALICE\""; then
  FAIL=$((FAIL+1)); echo "  [FAIL] чужой userId ПРОШЁЛ — уязвимость!"
else
  PASS=$((PASS+1)); echo "  [OK]   чужой userId из тела отброшен"
fi

echo
echo "--- S4. bob жмёт pause на таймере alice ---"
out=$(req POST /timer/pause "$BOB" "{\"scheduledPracticeId\":\"$SPID\",\"timestamp\":\"$NOW\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "POST /timer/pause (чужой) -> 403"

echo
echo "--- S5. bob стартует таймер по практике alice ---"
out=$(req POST /timer/start "$BOB" "{\"scheduledPracticeId\":\"$SPID\",\"practiceId\":\"$PID\",\"plannedDurationMinutes\":15}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "POST /timer/start (чужая практика) -> 403"

echo
echo "--- S6. bob архивирует практику alice ---"
out=$(req POST /practices/archive "$BOB" "{\"practiceId\":\"$PID\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "POST /practices/archive (чужой) -> 403"

echo
echo "--- S7. bob добавляет материал к практике alice ---"
out=$(req POST /materials "$BOB" "{\"practiceId\":\"$PID\",\"title\":\"взлом\",\"url\":\"https://advayta.org/x\",\"type\":\"article\",\"sourceDomain\":\"advayta.org\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "POST /materials (чужая практика, домен разрешён) -> 403"

echo
echo "--- S7b. материал с запрещённым доменом -> 400 ---"
out=$(req POST /materials "$ALICE" "{\"practiceId\":\"$PID\",\"title\":\"левый источник\",\"url\":\"https://example.com/x\",\"type\":\"article\",\"sourceDomain\":\"example.com\"}"); split "$out"
echo "  $BODY" | head -c 200; echo
check 400 "$CODE" "POST /materials (домен не в белом списке) -> 400"

echo
echo "--- S8. уведомления без служебного токена ---"
out=$(req GET /notifications/pending "$ALICE" -); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "GET /notifications/pending без токена -> 403"

echo
echo "--- S9. уведомления со служебным токеном ---"
out=$(curl -s -m 15 -w '\n%{http_code}' "$B/notifications/pending" -H "x-internal-token: $TOKEN"); split "$out"
echo "  $BODY" | head -c 300; echo
check 200 "$CODE" "GET /notifications/pending с токеном -> 200"

echo
echo "--- S10. уведомления с НЕВЕРНЫМ токеном ---"
out=$(curl -s -m 15 -w '\n%{http_code}' "$B/notifications/pending" -H "x-internal-token: wrong-token-value"); split "$out"
echo "  $BODY" | head -c 200; echo
check 403 "$CODE" "GET /notifications/pending с неверным токеном -> 403"

echo
echo "--- S11. совсем без авторизации ---"
out=$(req GET /practices - -); split "$out"
echo "  $BODY" | head -c 200; echo
check 401 "$CODE" "GET /practices без авторизации -> 401"

echo
echo "--- S12. неизвестный роут ---"
out=$(req GET /no/such/route "$ALICE" -); split "$out"
check 404 "$CODE" "GET /no/such/route -> 404"

echo
echo "--- S13. отсутствующая практика -> 404 (не 500) ---"
out=$(req PATCH /practices "$ALICE" '{"practiceId":"00000000-0000-0000-0000-000000000000","title":"x"}'); split "$out"
echo "  $BODY" | head -c 200; echo
check 404 "$CODE" "PATCH несуществующей практики -> 404"

echo
echo "=============================================="
echo " ИТОГ:  OK=$PASS   FAIL=$FAIL"
echo "=============================================="
[ "$FAIL" -eq 0 ] && echo "ВСЁ ЗЕЛЁНОЕ" || echo "ЕСТЬ ПРОБЛЕМЫ"
exit $FAIL
