import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Минимальный загрузчик .env без внешних зависимостей.
 *
 * Зачем свой: проекту не нужен полный dotenv с подстановками и экранированием,
 * а общий код убирает расхождение между приложениями — раньше загрузчик жил
 * только в API, и бот в продакшене падал на старте с «TELEGRAM_BOT_TOKEN is
 * required», потому что процессам, запущенным без предварительно
 * подготовленного окружения, .env просто неоткуда взяться.
 *
 * Правила:
 *  - Переменные, уже заданные в окружении, НЕ перезаписываются: настоящие
 *    переменные среды всегда главнее файла. Это позволяет в проде задать всё
 *    через окружение, а .env использовать только для локального запуска.
 *  - Файл ищется от заданного каталога вверх по дереву, поэтому в монорепо
 *    достаточно одного .env в корне.
 *
 * Возвращает путь к найденному файлу или null, если .env не нашёлся.
 */
export function loadProjectDotEnv(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const candidate = resolve(currentDir, ".env");
    if (existsSync(candidate)) {
      applyDotEnvFile(candidate);
      return candidate;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
}

function applyDotEnvFile(filePath: string): void {
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // Снимаем парные кавычки, если значение в них завернуто целиком.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }

    if (!key) continue;
    // Окружение главнее файла.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
