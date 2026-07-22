import { bootstrapApi } from "./bootstrap";
import { handleRequest } from "./server";
import type { ApiRequest } from "./types";

export async function createApp(databasePath = "./data/app.sqlite") {
  const container = await bootstrapApi(databasePath);

  return {
    handleRequest(request: ApiRequest) {
      return handleRequest(request, container);
    },
    container,
  };
}

export type TestApp = Awaited<ReturnType<typeof createApp>>;
