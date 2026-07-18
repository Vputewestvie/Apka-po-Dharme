import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { SqlParams, SqlResult, SQLiteClient } from "./client";

function normalizeParams(params: SqlParams) {
  return params.map((param) => (typeof param === "boolean" ? Number(param) : param));
}

export function openSqliteDatabase(filePath: string) {
  return new DatabaseSync(filePath);
}

export function applyMigrations(database: DatabaseSync, migrationSql: string) {
  database.exec(migrationSql);
}

export function loadInitMigration() {
  return readFileSync(new URL("./migrations/001_init.sql", import.meta.url), "utf8");
}

export class SqliteClientAdapter implements SQLiteClient {
  constructor(private readonly database: DatabaseSync) {}

  query<T = Record<string, unknown>>(sql: string, params: SqlParams = []): Promise<SqlResult<T>> {
    const statement = this.database.prepare(sql);
    const rows = statement.all(...normalizeParams(params)) as T[];
    return Promise.resolve({ rows });
  }

  execute(sql: string, params: SqlParams = []): Promise<void> {
    const statement = this.database.prepare(sql);
    statement.run(...normalizeParams(params));
    return Promise.resolve();
  }
}
