import { describe, expect, it } from "vitest";
import { createApp } from "../../src/main";

describe("API /practices", () => {
  it("returns 401 without auth", async () => {
    const app = await createApp(":memory:");
    const response = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      query: { userId: "user-1" },
    });

    expect(response.ok).toBe(false);
    expect((response as { ok: false; error: string }).error).toBe("Not authenticated");
  });

  it("returns practices with valid x-user-id", async () => {
    const app = await createApp(":memory:");
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
    const app = await createApp(":memory:");
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
    const app = await createApp(":memory:");
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

describe("API /practices DELETE", () => {
  async function createPracticeFor(app: Awaited<ReturnType<typeof createApp>>, userId: string) {
    const created = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: {
        userId,
        title: "Медитация",
        category: "Ум",
        defaultDurationMinutes: 20,
        color: "#688b76",
        icon: "leaf",
        image: { kind: "builtin", ref: "/images/qigong.jpg" },
        notes: "",
      },
      context: { requestId: "req-1", userId },
    });
    expect(created.ok).toBe(true);
    return (created as { ok: true; data: { id: string } }).data.id;
  }

  it("deletes own practice", async () => {
    const app = await createApp(":memory:");
    const practiceId = await createPracticeFor(app, "user-1");

    const deleted = await app.handleRequest({
      method: "DELETE",
      pathname: "/practices",
      body: { userId: "user-1", practiceId },
      context: { requestId: "req-2", userId: "user-1" },
    });
    expect(deleted.ok).toBe(true);

    const list = await app.handleRequest({
      method: "GET",
      pathname: "/practices",
      query: { userId: "user-1" },
      context: { requestId: "req-3", userId: "user-1" },
    });
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data as unknown[]).toHaveLength(0);
    }
  });

  it("rejects deleting another user's practice with 403", async () => {
    const app = await createApp(":memory:");
    const practiceId = await createPracticeFor(app, "user-1");

    const response = await app.handleRequest({
      method: "DELETE",
      pathname: "/practices",
      body: { userId: "user-2", practiceId },
      context: { requestId: "req-2", userId: "user-2" },
    });

    expect(response.ok).toBe(false);
    expect((response as { ok: false; status?: number }).status).toBe(403);
  });

  it("returns 404 for unknown practice id", async () => {
    const app = await createApp(":memory:");
    const response = await app.handleRequest({
      method: "DELETE",
      pathname: "/practices",
      body: { userId: "user-1", practiceId: "no-such-id" },
      context: { requestId: "req-2", userId: "user-1" },
    });

    expect(response.ok).toBe(false);
    expect((response as { ok: false; status?: number }).status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const app = await createApp(":memory:");
    const response = await app.handleRequest({
      method: "DELETE",
      pathname: "/practices",
      body: { userId: "user-1", practiceId: "any" },
    });

    expect(response.ok).toBe(false);
    expect((response as { ok: false; error: string }).error).toBe("Not authenticated");
  });
});
