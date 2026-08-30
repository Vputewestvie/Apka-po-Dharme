import type { SQLiteClient } from "../../../packages/database/src/client";
import { createApiContainer } from "./container";

export async function bootstrapApi(database: string | SQLiteClient = "./data/app.sqlite") {
  return createApiContainer(database);
}
