export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export type RequestContext = {
    requestId: string;
    userId?: string;
};
export type ApiResponse<T extends JsonValue> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
};
//# sourceMappingURL=types.d.ts.map