export const routes = {
    "/health": () => ({
        ok: true,
        data: {
            status: "ok",
            service: "api",
        },
    }),
};
