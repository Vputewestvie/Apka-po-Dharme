import type { SqlParams, SqlResult, SQLiteClient } from "./client";

/**
 * Минимальное описание базы D1 — только то, что использует адаптер.
 *
 * Свой тип вместо импорта из @cloudflare/workers-types позволяет не тащить
 * типы Workers в пакет, который живёт и в обычном Node (локальный запуск).
 */
export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

/**
 * Адаптер D1 под тот же интерфейс `SQLiteClient`, что и sql.js.
 *
 * Благодаря этому вся бизнес-логика (репозитории, сервисы, маршруты) работает
 * и локально на файле, и в Cloudflare на D1 — без правок.
 */
export class D1Client implements SQLiteClient {
  constructor(private readonly database: D1DatabaseLike) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlParams = [],
  ): Promise<SqlResult<T>> {
    const statement = this.database.prepare(sql);
    const result = await statement.bind(...params).all<T>();
    return { rows: result.results ?? [] };
  }

  async execute(sql: string, params: SqlParams = []): Promise<void> {
    const statement = this.database.prepare(sql);
    await statement.bind(...params).run();
  }
}
