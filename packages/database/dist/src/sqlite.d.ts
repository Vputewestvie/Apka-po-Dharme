import { DatabaseSync } from "node:sqlite";
import type { SqlParams, SqlResult, SQLiteClient } from "./client";
export declare function openSqliteDatabase(filePath: string): DatabaseSync;
export declare function applyMigrations(database: DatabaseSync, migrationSql: string): void;
export declare function loadInitMigration(): string;
export declare class SqliteClientAdapter implements SQLiteClient {
    private readonly database;
    constructor(database: DatabaseSync);
    query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<SqlResult<T>>;
    execute(sql: string, params?: SqlParams): Promise<void>;
}
//# sourceMappingURL=sqlite.d.ts.map