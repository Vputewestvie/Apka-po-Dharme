import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { createApp } from "./main";
import type { ApiRequest, JsonValue } from "./types";
import { authenticateRequest } from "./modules/auth";

function loadDotEnvFile(filePath: string) {
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split("=");
    const value = rest.join("=").trim();
    if (!key) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadDotEnv() {
  let currentDir = process.cwd();
  while (true) {
    const candidate = resolve(currentDir, ".env");
    if (existsSync(candidate)) {
      loadDotEnvFile(candidate);
      break;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
}

loadDotEnv();

const port = Number(process.env.PORT ?? "3001");
const databasePath = resolve(process.cwd(), process.env.APP_DATABASE_PATH ?? "data/app.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

const app = createApp(databasePath);

function writeJson(response: ServerResponse, statusCode: number, body: JsonValue) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-user-id,x-telegram-init-data",
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

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    writeJson(response, 400, { ok: false, error: "Invalid request" });
    return;
  }

  if (request.method === "OPTIONS") {
    writeJson(response, 204, null);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `localhost:${port}`}`);
  const body = await readBody(request).catch(() => undefined);

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const auth = authenticateRequest(
    request.headers as Record<string, string | string[] | undefined>,
    botToken,
  );

  if (!auth.ok) {
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
      userId: auth.userId,
    },
  };

  const result = await app.handleRequest(apiRequest);
  writeJson(response, result.ok ? 200 : result.status ?? 500, result);
});

server.listen(port, () => {
  console.log(`API server started on http://localhost:${port}`);
  console.log(`Database: ${databasePath}`);
});
