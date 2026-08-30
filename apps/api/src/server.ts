import type { ApiContainer } from "./container";
import { routes } from "./routes";
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "./validation";
import type { ApiRequest, ApiResponse, JsonValue } from "./types";

function statusOf(error: unknown): number {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ValidationError) return 400;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  return 500;
}

export async function handleRequest(
  request: ApiRequest,
  container: ApiContainer,
): Promise<ApiResponse<JsonValue>> {
  const handler = routes.get(`${request.method} ${request.pathname}`);
  if (!handler) {
    return { ok: false, error: "Not found", status: 404 };
  }

  // Гарантируем, что пользователь существует в БД. На D1 внешние ключи
  // включены, поэтому перед любой записью (practices/schedules/...) строка
  // users должна быть. telegramUser присутствует только при авторизации по
  // init data — для служебного токена и анонимных запросов пропускаем.
  const telegramUser = request.context?.telegramUser;
  if (telegramUser) {
    await container.userService.ensureUser(telegramUser);
  }

  try {
    return await handler(request, container);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: message,
      status: statusOf(error),
    };
  }
}
