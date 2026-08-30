export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Профиль пользователя Telegram, извлечённый из init data. */
export type TelegramUser = {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  language_code?: string | null;
};

export type RequestContext = {
  requestId: string;
  userId?: string;
  /** true — вызов от доверенного внутреннего сервиса (бот → API) по служебному токену. */
  service?: boolean;
  /** Профиль Telegram, когда запрос аутентифицирован по init data. */
  telegramUser?: TelegramUser;
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
