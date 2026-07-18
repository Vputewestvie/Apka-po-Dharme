import { createApiContainer } from "./container";

export function bootstrapApi(databasePath = "./data/app.sqlite") {
  return createApiContainer(databasePath);
}
