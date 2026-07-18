import type { ApiContainer } from "./container";
import { routes } from "./routes";
import { ValidationError } from "./validation";
import type { ApiRequest, ApiResponse, JsonValue } from "./types";

export async function handleRequest(
  request: ApiRequest,
  container: ApiContainer,
): Promise<ApiResponse<JsonValue>> {
  const handler = routes.get(`${request.method} ${request.pathname}`);
  if (!handler) {
    return { ok: false, error: "Not found" };
  }

  try {
    return await handler(request, container);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof ValidationError ? 400 : 500;
    return {
      ok: false,
      error: message,
      status,
    };
  }
}
