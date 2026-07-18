import { describe, expect, it } from "vitest";
import { createApp } from "../../src/main";

describe("API /practices", () => {
  it("returns 401 without auth", async () => {
    const app = createApp(":memory:");
    const response = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      query: { userId: "user-1" },
    });

    expect(response.ok).toBe(false);
    expect((response as { ok: false; error: string }).error).toBe("Not authenticated");
  });

  it("returns practices with valid x-user-id", async () => {
    const app = createApp(":memory:");
    const response = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      query: { userId: "user-1" },
      context: { requestId: "req-1", userId: "user-1" },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(Array.isArray(response.data)).toBe(true);
    }
  });

  it("creates practice with valid body", async () => {
    const app = createApp(":memory:");
    const response = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: {
        userId: "demo-user",
        title: "Цигун",
        category: "Тело",
        defaultDurationMinutes: 45,
        color: "#688b76",
        icon: "leaf",
        image: { kind: "builtin", ref: "/images/qigong.jpg" },
        notes: "",
      },
      context: { requestId: "req-1", userId: "demo-user" },
    });

    expect(response.ok).toBe(true);
    if (response.ok && response.data && typeof response.data === "object" && "title" in response.data) {
      expect((response.data as { title: string }).title).toBe("Цигун");
    }
  });

  it("returns 400 for invalid practice body", async () => {
    const app = createApp(":memory:");
    const response = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: {
        userId: "user-1",
        title: "",
        category: "Тело",
        defaultDurationMinutes: -10,
      },
      context: { requestId: "req-1", userId: "user-1" },
    });

    expect(response.ok).toBe(false);
    expect((response as { ok: false; status?: number }).status).toBe(400);
  });
});