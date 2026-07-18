export type SqlParams = readonly (string | number | boolean | null)[];
export interface SqlResult<T> {
    rows: T[];
}
export interface SQLiteClient {
    query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<SqlResult<T>>;
    execute(sql: string, params?: SqlParams): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map