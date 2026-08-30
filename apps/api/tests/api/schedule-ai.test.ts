import { describe, expect, it } from "vitest";
import type { Practice } from "../../../../packages/domain/src";
import type { PracticeRepository } from "../../../../packages/database/src";
import type { AiService } from "../../src/modules/ai";
import type { ParsedScheduleCommand } from "../../../../packages/ai-adapter/src/types";
import { ScheduleAiService } from "../../src/modules/schedule/ai-service";
import { createApp } from "../../src/main";

function stubAi(parsed: ParsedScheduleCommand): AiService {
  return { parseScheduleText: async () => parsed } as unknown as AiService;
}

async function buildService(parsed: ParsedScheduleCommand, titles: string[]) {
  const app = await createApp(":memory:");
  for (const title of titles) {
    await app.container.practiceLibraryService.create({
      userId: "user-1",
      title,
      description: "",
      category: "Тело",
      defaultDurationMinutes: 20,
      color: "#688b76",
      icon: "leaf",
      image: { kind: "builtin", ref: "/images/qigong.jpg" },
      notes: "",
    });
  }
  // Реальный репозиторий приложения: и AI-сервис, и ScheduleService должны
  // видеть одни и те же практики (в проде это один и тот же репозиторий).
  const service = new ScheduleAiService(
    stubAi(parsed),
    app.container.scheduleService,
    app.container.practiceRepository,
  );
  return { app, service };
}

describe("ScheduleAiService: план дня из текста", () => {
  it("находит существующие практики и создаёт недостающие, все попадают в план", async () => {
    const { app, service } = await buildService(
      {
        intent: "create_schedule",
        date: null,
        items: [
          { practiceName: "медитация", durationMinutes: 45, timeOfDay: "morning" },
          { practiceName: "шавасана", durationMinutes: 10, timeOfDay: "evening" },
        ],
        rawText: "",
      },
      ["Медитация"],
    );

    const result = await service.createFromText("user-1", "тест", {});
    expect(result.date).toBe(new Date().toISOString().slice(0, 10));
    expect(result.items).toHaveLength(2);
    expect(result.items[0].plannedDurationMinutes).toBe(45);
    expect(result.items[1].plannedDurationMinutes).toBe(10);

    // созданная практика появилась в библиотеке с source=ai
    const library = await app.container.practiceLibraryService.list("user-1");
    expect(library.map((p) => p.title)).toContain("Шавасана");
    expect(library.find((p) => p.title === "Шавасана")?.source).toBe("ai");

    const stored = await app.container.scheduleService.getByDate("user-1", result.date);
    expect(stored?.items).toHaveLength(2);
  });

  it("работает с полностью пустой библиотекой — создаёт все практики", async () => {
    const { app, service } = await buildService(
      {
        intent: "create_schedule",
        date: null,
        items: [{ practiceName: "цигун", durationMinutes: 20, timeOfDay: "morning" }],
        rawText: "",
      },
      [],
    );

    const result = await service.createFromText("user-1", "тест", {});
    expect(result.items).toHaveLength(1);
    const library = await app.container.practiceLibraryService.list("user-1");
    expect(library).toHaveLength(1);
    expect(library[0].title).toBe("Цигун");
  });

  it("не использует чужую практику, навязанную через practiceId в nameToId", async () => {
    const { app, service } = await buildService(
      {
        intent: "create_schedule",
        date: null,
        items: [{ practiceName: "что-то", durationMinutes: 10, timeOfDay: "any" }],
        rawText: "",
      },
      ["Медитация"],
    );
    const ownLibrary = await app.container.practiceLibraryService.list("user-1");
    const foreignId = ownLibrary[0].id;

    const result = await service.createFromText("user-2", "тест", { "что-то": foreignId });
    // в план попала свежесозданная практика, а не чужая
    expect(result.items).toHaveLength(1);
    expect(result.items[0].practiceId).not.toBe(foreignId);
  });

  it("заменяет существующий план на дату вместо создания дубля", async () => {
    const parsed: ParsedScheduleCommand = {
      intent: "create_schedule",
      date: null,
      items: [{ practiceName: "Медитация", durationMinutes: 20, timeOfDay: "any" }],
      rawText: "",
    };
    const { app, service } = await buildService(parsed, ["Медитация", "Дыхание"]);

    const first = await service.createFromText("user-1", "тест", {});
    const second = await service.createFromText("user-1", "тест", {});

    expect(second.date).toBe(first.date);
    const stored = await app.container.scheduleService.getByDate("user-1", first.date);
    expect(stored?.items).toHaveLength(1);
    expect(stored?.title).toBe("AI schedule");
  });

  it("дает понятную ошибку, если модель не вернула ни одной практики", async () => {
    const { service } = await buildService(
      { intent: "unknown", date: null, items: [], rawText: "" },
      ["Медитация"],
    );

    await expect(service.createFromText("user-1", "тест", {})).rejects.toThrow(/Не понял/);
  });
});
