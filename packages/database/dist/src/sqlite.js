import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
export function openSqliteDatabase(filePath) {
    return new DatabaseSync(filePath);
}
export function applyMigrations(database, migrationSql) {
    database.exec(migrationSql);
}
export function loadInitMigration() {
    return readFileSync(new URL("../../migrations/001_init.sql", import.meta.url), "utf8");
}
export class SqliteClientAdapter {
    database;
    constructor(database) {
        this.database = database;
    }
    query(sql, params = []) {
        const statement = this.database.prepare(sql);
        const rows = statement.all(...params);
        return Promise.resolve({ rows });
    }
    execute(sql, params = []) {
        const statement = this.database.prepare(sql);
        statement.run(...params);
        return Promise.resolve();
    }
}
