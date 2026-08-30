import { describe, expect, it } from "vitest";
import { createApp } from "../../src/main";

type Failure = { ok: false; error: string; status?: number };

function asFailure(response: unknown): Failure {
  return response as Failure;
}

/**
 * /bot/* — service-to-service эндпоинты для интерактива бота в чате
 * (коаны, толкования, колесо дхармы). Доступны только по служебному токену.
 */
describe("Bot inspiration: service-эндпоинты", () => {
  it("POST /bot/inspire отвечает запасным коаном (AI не настроен)", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/bot/inspire",
      body: { kind: "koan" },
      context: { requestId: "req-1", service: true },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      const data = response.data as { text: string; generated: boolean };
      expect(data.text.length).toBeGreaterThan(0);
      expect(data.generated).toBe(false);
    }
  });

  it("POST /bot/inspire принимает толкование с текстом коана", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/bot/inspire",
      body: {
        kind: "koan-commentary",
        subject: { text: "Му.", source: "«Застава без ворот»" },
      },
      context: { requestId: "req-2", service: true },
    });

    expect(response.ok).toBe(true);
  });

  it("POST /bot/inspire отклоняет неверный kind (400)", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/bot/inspire",
      body: { kind: "haiku" },
      context: { requestId: "req-3", service: true },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(400);
  });

  it("POST /bot/inspire без служебного токена — 403", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "POST",
      pathname: "/bot/inspire",
      body: { kind: "koan" },
      context: { requestId: "req-4", userId: "user-1" },
    });

    expect(response.ok).toBe(false);
    expect(asFailure(response).status).toBe(403);
  });

  it("GET /bot/practices возвращает практики пользователя по telegramId", async () => {
    const app = await createApp(":memory:");
    await app.container.userService.ensureUser({ id: 77, first_name: "Демо" });

    await app.container.practiceLibraryService.create({
      userId: "77",
      title: "Медитация",
      description: "",
      category: "Разум",
      defaultDurationMinutes: 25,
      color: "#688b76",
      icon: "leaf",
      image: { kind: "builtin", ref: "/images/categories/meditation.webp" },
      notes: "",
    });

    const response = await app.handleRequest({
      method: "GET",
      pathname: "/bot/practices",
      query: { telegramId: "77" },
      context: { requestId: "req-5", service: true },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      const data = response.data as Array<{ id: string; title: string; minutes: number }>;
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Медитация");
      expect(data[0].minutes).toBe(25);
    }
  });

  it("GET /bot/practices для неизвестного telegramId — пустой список", async () => {
    const app = await createApp(":memory:");

    const response = await app.handleRequest({
      method: "GET",
      pathname: "/bot/practices",
      query: { telegramId: "404" },
      context: { requestId: "req-6", service: true },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data).toEqual([]);
    }
  });
});
