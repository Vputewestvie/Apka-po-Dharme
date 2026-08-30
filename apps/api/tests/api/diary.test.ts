import { describe, expect, it } from "vitest";
import type { AiService } from "../../src/modules/ai";
import { DiaryAiService } from "../../src/modules/diary/ai-service";
import { createApp } from "../../src/main";

describe("Дневник: переживает удаление практики", () => {
  async function setup() {
    const app = await createApp(":memory:");
    const headers = { userId: "user-1" };
    const ctx = { requestId: "req-1", userId: "user-1" };

    const created = await app.handleRequest({
      method: "POST",
      pathname: "/practices",
      body: {
        userId: "user-1",
        title: "Медитация",
        category: "Ум",
        defaultDurationMinutes: 20,
        color: "#688b76",
        icon: "leaf",
        image: { kind: "builtin", ref: "/images/qigong.jpg" },
        notes: "",
      },
      context: ctx,
    });
    expect(created.ok).toBe(true);
    const practiceId = (created as { ok: true; data: { id: string } }).data.id;

    const scheduled = await app.handleRequest({
      method: "POST",
      pathname: "/schedule",
      body: {
        userId: "user-1",
        date: "2026-08-30",
        title: "Мой день",
        practices: [{ practiceId, plannedStartTime: null, plannedDurationMinutes: 20, order: 0 }],
      },
      context: ctx,
    });
    expect(scheduled.ok).toBe(true);
    const scheduleData = (scheduled as { ok: true; data: { items: Array<{ id: string }> } }).data;

    const entry = await app.handleRequest({
      method: "POST",
      pathname: "/diary",
      body: {
        userId: "user-1",
        practiceId,
        scheduledPracticeId: scheduleData.items[0].id,
        kind: "text",
        text: "После практики стало спокойно",
      },
      context: ctx,
    });
    expect(entry.ok).toBe(true);

    return { app, practiceId, ctx };
  }

  it("запись остаётся после удаления практики, с снимком названия", async () => {
    const { app, practiceId, ctx } = await setup();

    const deleted = await app.handleRequest({
      method: "DELETE",
      pathname: "/practices",
      body: { userId: "user-1", practiceId },
      context: ctx,
    });
    expect(deleted.ok).toBe(true);

    const list = await app.handleRequest({
      method: "GET",
      pathname: "/diary",
      query: { userId: "user-1" },
      context: ctx,
    });
    expect(list.ok).toBe(true);
    const entries = (list as { ok: true; data: Array<{ practiceId: string | null; practiceTitle: string; text: string }> }).data;
    expect(entries).toHaveLength(1);
    // Локальный sql.js не применяет внешние ключи (ON DELETE SET NULL сработает
    // на D1), поэтому practiceId может остаться висячим — запись в любом
    // случае выживает, а название берётся из снимка.
    expect(entries[0].practiceTitle).toBe("Медитация");
    expect(entries[0].text).toBe("После практики стало спокойно");
  });
});

describe("DiaryAiService: анализ дневника", () => {
  function stubAi(answer: string): AiService {
    return { answerUserQuestion: async () => answer } as unknown as AiService;
  }

  it("подсказывает, когда записей ещё нет", async () => {
    const app = await createApp(":memory:");
    const emptyDiaryRepo = {
      listByUserId: async () => [],
      upsert: async () => {},
    };
    const service = new DiaryAiService(
      stubAi("не должен вызываться"),
      emptyDiaryRepo as never,
      app.container.practiceRepository,
    );
    const result = await service.analyze("user-empty");
    expect(result).toContain("нет записей");
  });

  it("передаёт записи и вопрос в модель", async () => {
    const app = await createApp(":memory:");
    let received = "";
    const service = new DiaryAiService(
      {
        answerUserQuestion: async (text: string) => {
          received = text;
          return "Анализ готов";
        },
      } as unknown as AiService,
      app.container.diaryRepository as never,
      app.container.practiceRepository,
    );

    const practice = await app.container.practiceLibraryService.create({
      userId: "user-1",
      title: "Дыхание",
      description: "",
      category: "Дыхание",
      defaultDurationMinutes: 10,
      color: "#688b76",
      icon: "leaf",
      image: { kind: "builtin", ref: "/images/pranayama.jpg" },
      notes: "",
    });
    await app.container.diaryService.create({
      userId: "user-1",
      practiceId: practice.id,
      scheduledPracticeId: "sched-1",
      kind: "text",
      text: "Дышал ровно, мысли успокоились",
    });

    const result = await service.analyze("user-1", "Что мне делать дальше?");
    expect(result).toBe("Анализ готов");
    expect(received).toContain("Дышал ровно, мысли успокоились");
    expect(received).toContain("Что мне делать дальше?");
    expect(received).toContain("Дыхание");
  });
});
