import { bootstrapApi } from "./bootstrap";
import { handleRequest } from "./server";
import type { ApiRequest } from "./types";

export function createApp(databasePath = "./data/app.sqlite") {
  const container = bootstrapApi(databasePath);

  return {
    handleRequest(request: ApiRequest) {
      return handleRequest(request, container);
    },
    container,
  };
}

export type TestApp = ReturnType<typeof createApp>;
