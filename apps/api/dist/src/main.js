import { bootstrapApi } from "./bootstrap";
import { handleRequest } from "./server";
export function createApp(databasePath = "./data/app.sqlite") {
    const container = bootstrapApi(databasePath);
    return {
        handleRequest,
        container,
    };
}
