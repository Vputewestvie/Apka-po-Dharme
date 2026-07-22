import { createApiContainer } from "./container";

export async function bootstrapApi(databasePath = "./data/app.sqlite") {
  return createApiContainer(databasePath);
}
