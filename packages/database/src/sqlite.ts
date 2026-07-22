import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import initSqlJs, { type Database } from "sql.js";
import type { SqlParams, SqlResult, SQLiteClient } from "./client";

const require = createRequire(import.meta.url);

function normalizeParams(params: SqlParams) {
  return params.map((param) => (typeof param === "boolean" ? Number(param) : param));
}

export interface SqliteDatabaseHandle {
  database: Database;
  filePath: string;
  persist(): void;
}

export async function openSqliteDatabase(filePath: string): Promise<SqliteDatabaseHandle> {
  const SQL = await initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
  });
  const database = filePath === ":memory:" || !existsSync(filePath)
    ? new SQL.Database()
    : new SQL.Database(readFileSync(filePath));

  return {
    database,
    filePath,
    persist() {
      if (filePath === ":memory:") return;
      writeFileSync(filePath, database.export());
    },
  };
}

export function applyMigrations(handle: SqliteDatabaseHandle, migrationSql: string) {
  handle.database.exec(migrationSql);
  handle.persist();
}

export function loadInitMigration() {
  return readFileSync(new URL("./migrations/001_init.sql", import.meta.url), "utf8");
}

export class SqliteClientAdapter implements SQLiteClient {
  constructor(private readonly handle: SqliteDatabaseHandle) {}

  query<T = Record<string, unknown>>(sql: string, params: SqlParams = []): Promise<SqlResult<T>> {
    const statement = this.handle.database.prepare(sql);
    try {
      statement.bind(normalizeParams(params));
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
      return Promise.resolve({ rows });
    } finally {
      statement.free();
    }
  }

  execute(sql: string, params: SqlParams = []): Promise<void> {
    const statement = this.handle.database.prepare(sql);
    try {
      statement.run(normalizeParams(params));
      this.handle.persist();
      return Promise.resolve();
    } finally {
      statement.free();
    }
  }
}
