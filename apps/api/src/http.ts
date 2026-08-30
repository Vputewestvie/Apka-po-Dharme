import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectDotEnv } from "../../../packages/shared/src/load-dot-env";
import { createApp } from "./main";
import type { ApiRequest, JsonValue } from "./types";
import { authenticateRequest } from "./modules/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// http.ts находится в /app/apps/api/src/
// Корень проекта: подняться на 2 уровня вверх → /app
const PROJECT_ROOT = resolve(__dirname, "../..");
// Каталог со статикой Mini App
const DIST_DIR = resolve(PROJECT_ROOT, "mini-app/dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
};

/**
 * Разрешает путь внутри каталога статики и гарантирует, что он не выходит
 * за его пределы (защита от обхода каталога через `..` и кодированные пути).
 * Возвращает null, если путь недопустим или файла нет.
 */
function resolveStaticPath(filePath: string): string | null {
  // filePath may start with / on Linux, remove it to avoid resolve() treating it as absolute
  const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  const fullPath = resolve(DIST_DIR, relativePath);
  const root = DIST_DIR.endsWith(sep) ? DIST_DIR : DIST_DIR + sep;
  if (fullPath !== DIST_DIR && !fullPath.startsWith(root)) return null;
  if (!existsSync(fullPath)) return null;
  return fullPath;
}

function serveStatic(response: ServerResponse, filePath: string) {
  const fullPath = resolveStaticPath(filePath);
  if (!fullPath) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const content = readFileSync(fullPath);
  const mimeType = MIME_TYPES[extname(fullPath)] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": mimeType });
  response.end(content);
}

// Общий загрузчик .env (тот же, что использует бот): поднимается вверх по
// каталогам, переменные окружения всегда главнее файла.
loadProjectDotEnv(PROJECT_ROOT);

const port = Number(process.env.PORT ?? "3001");
const databasePath = resolve(PROJECT_ROOT, process.env.APP_DATABASE_PATH ?? "data/app.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

function writeJson(response: ServerResponse, statusCode: number, body: JsonValue) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-user-id,x-telegram-init-data,x-internal-token",
  });
  response.end(JSON.stringify(body));
}

function readBody(request: IncomingMessage): Promise<JsonValue | undefined> {
  return new Promise((resolveBody, reject) => {
    const chunks: Uint8Array[] = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (chunks.length === 0) {
        resolveBody(undefined);
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw) as JsonValue;
        resolveBody(parsed);
      } catch (error) {
        const raw = Buffer.concat(chunks).toString("utf8");
        console.error("[http] body parse failed", request.method, request.url, raw, error instanceof Error ? error.message : error);
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function main() {
  const app = await createApp(databasePath);
  const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    writeJson(response, 400, { ok: false, error: "Invalid request" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `localhost:${port}`}`);

  // Health check endpoint (no auth required)
  if (request.method === "GET" && url.pathname === "/health") {
    writeJson(response, 200, { ok: true, data: { status: "ok", service: "api" } });
    return;
  }

  // Serve static files for mini-app (no auth required)
  // Check if it's a static file (has extension) or root path
  const isStaticPath = url.pathname === "/" || extname(url.pathname) !== "";
  
  if (request.method === "GET" && isStaticPath) {
    const staticPath = url.pathname === "/" ? "/index.html" : url.pathname;
    if (resolveStaticPath(staticPath)) {
      serveStatic(response, staticPath);
      return;
    }
    // If static file not found, return 404
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  if (request.method === "OPTIONS") {
    writeJson(response, 204, null);
    return;
  }

  const body = await readBody(request).catch(() => undefined);

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const auth = authenticateRequest(
    request.headers as Record<string, string | string[] | undefined>,
    botToken,
  );

  // Анонимные запросы пропускаем к обработчику — отдельные служебные маршруты
  // сами решают, допустим ли анонимный доступ (например, уведомления требуют
  // служебный токен и вернут 403). Всё остальное получит 401 внутри обработчика.
  if (!auth.ok && !auth.anonymous) {
    writeJson(response, 401, { ok: false, error: auth.reason });
    return;
  }

  const apiRequest: ApiRequest = {
    method: request.method as ApiRequest["method"],
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
    context: {
      requestId: crypto.randomUUID(),
      userId: auth.ok ? auth.userId : undefined,
      service: auth.ok ? (auth.service ?? false) : false,
      telegramUser: auth.ok ? auth.telegramUser : undefined,
    },
  };

  const result = await app.handleRequest(apiRequest);
  writeJson(response, result.ok ? 200 : result.status ?? 500, result);
  });

  server.listen(port, () => {
    console.log(`API server started on http://localhost:${port}`);
    console.log(`Database: ${databasePath}`);
  });
}

main().catch((error) => {
  console.error("[http] failed to start", error);
  process.exit(1);
});