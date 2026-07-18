import { routes } from "./routes";
export function handleRequest(pathname) {
    const handler = routes[pathname];
    if (!handler) {
        return { ok: false, error: "Not found" };
    }
    return handler();
}
