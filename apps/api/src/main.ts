import type { SQLiteClient } from "../../../packages/database/src/client";
import { bootstrapApi } from "./bootstrap";
import { handleRequest } from "./server";
import type { ApiRequest } from "./types";

/**
 * `database` — путь к файлу SQLite (обычный Node) либо готовый клиент БД
 * (Workers передаёт сюда адаптер D1).
 */
export async function createApp(database: string | SQLiteClient = "./data/app.sqlite") {
  const container = await bootstrapApi(database);

  return {
    handleRequest(request: ApiRequest) {
      return handleRequest(request, container);
    },
    container,
  };
}

export type TestApp = Awaited<ReturnType<typeof createApp>>;
