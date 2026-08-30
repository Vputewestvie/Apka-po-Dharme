/**
 * Живая проверка валидации Telegram init data на задеплоенном воркере.
 *
 * Регрессия: раньше Buffer.from(hash, "hex") отбрасывал нешестнадцатеричный
 * мусор в конце hash, поэтому валидная подпись с дописанными символами
 * принималась (200 вместо 401). Теперь hash обязан быть ровно 64 hex.
 *
 * Запуск:
 *   BOT_TOKEN=... node scripts/verify-init-data-auth.mjs
 *   BASE_URL=https://... node scripts/verify-init-data-auth.mjs
 */
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL ?? "https://dharma-diary.vputewestvie.workers.dev";
const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  console.error("Укажи BOT_TOKEN (токен бота, которым подписаны init data).");
  process.exit(1);
}

/** Собирает init data ровно так, как это делает Telegram. */
function buildInitData(token) {
  const authDate = Math.floor(Date.now() / 1000);
  const user = encodeURIComponent(JSON.stringify({ id: 777000777, first_name: "Verify" }));
  const pairs = [`auth_date=${authDate}`, `user=${user}`];
  const dataCheckString = [...pairs].sort().join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return `${pairs.join("&")}&hash=${hash}`;
}

async function probe(initData) {
  try {
    const response = await fetch(`${BASE}/practices`, {
      headers: { "x-telegram-init-data": initData },
    });
    return response.status;
  } catch (error) {
    return `ERR ${error.message}`;
  }
}

const valid = buildInitData(TOKEN);
const hashMatch = valid.match(/hash=([0-9a-f]+)/);
const goodHash = hashMatch[1];

function withHash(nextHash) {
  return valid.replace(/hash=[0-9a-f]+/, `hash=${nextHash}`);
}

const flippedLast = goodHash.slice(0, 63) + (goodHash.slice(63) === "0" ? "1" : "0");

const cases = [
  { name: "валидная подпись", data: valid, expect: 200 },
  { name: 'подпись + "0" в конце', data: withHash(goodHash + "0"), expect: 401 },
  { name: 'подпись + "xx" в конце', data: withHash(goodHash + "xx"), expect: 401 },
  { name: "перевёрнутый последний символ", data: withHash(flippedLast), expect: 401 },
  { name: "подменённый hash (64 a)", data: withHash("a".repeat(64)), expect: 401 },
  { name: "короткий hash (32 символа)", data: withHash("a".repeat(32)), expect: 401 },
  { name: "пустой hash", data: withHash(""), expect: 401 },
];

console.log(`Цель: ${BASE}\n`);

let failed = 0;
for (const item of cases) {
  const status = await probe(item.data);
  const ok = status === item.expect;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${item.name}: ${status} (ожидалось ${item.expect})`);
}

console.log(
  failed === 0
    ? "\nВсе проверки пройдены: подделать подпись нельзя."
    : `\nПровалено проверок: ${failed}`,
);
process.exit(failed === 0 ? 0 : 1);
