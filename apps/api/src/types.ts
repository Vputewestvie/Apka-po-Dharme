export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type RequestContext = {
  requestId: string;
  userId?: string;
};

export type ApiRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathname: string;
  query?: Record<string, string | undefined>;
  body?: JsonValue;
  context?: RequestContext;
};

export type ApiResponse<T extends JsonValue> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
  status?: number;
};
