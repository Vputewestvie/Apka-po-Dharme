import type { ApiResponse, JsonValue } from "./types";
export type RouteHandler = () => ApiResponse<JsonValue>;
export declare const routes: Record<string, RouteHandler>;
//# sourceMappingURL=routes.d.ts.map