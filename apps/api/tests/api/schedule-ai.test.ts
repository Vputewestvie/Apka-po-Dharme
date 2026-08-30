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

/** Репозиторий-заглушка: отдаёт только практики, созданные указанным пользователем. */
function stubRepository(library: Practice[]): PracticeRepository {
  return {
    listByUserId: async (userId: string) => library.filter((p) => p.userId === userId),
    getById: async (id: string) => library.find((p) => p.id === id) ?? null,
    upsert: async () => {},
    delete: async () => {},
  };
}

async function buildService(parsed: ParsedScheduleCommand, titles: string[]) {
  const app = await createApp(":memory:");
  const library: Practice[] = [];
  for (const title of titles) {
    library.push(
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
      }),
    );
  }
  const service = new ScheduleAiService(stubAi(parsed), app.container.scheduleService, stubRepository(library));
  return { app, service };
}

describe("ScheduleAiService: план дня из текста", () => {
  it("создаёт план только из найденных практик и по умолчанию на сегодня", async () => {
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
      ["Медитация", "Пранаяма"],
    );

    const result = await service.createFromText("user-1", "тест", {});
    expect(result.date).toBe(new Date().toISOString().slice(0, 10));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].plannedDurationMinutes).toBe(45);

    const stored = await app.container.scheduleService.getByDate("user-1", result.date);
    expect(stored?.items).toHaveLength(1);
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

  it("не добавляет практику, навязанную через чужой practiceId в nameToId", async () => {
    const { app, service } = await buildService(
      {
        intent: "create_schedule",
        date: null,
        items: [{ practiceName: "что-то", durationMinutes: 10, timeOfDay: "any" }],
        rawText: "",
      },
      ["Медитация"],
    );
    const foreign = await app.container.practiceLibraryService.list("user-1");
    const foreignId = foreign[0].id;

    await expect(
      service.createFromText("user-2", "тест", { "что-то": foreignId }),
    ).rejects.toThrow(/В библиотеке нет практик/);
  });

  it("дает понятную ошибку, если ни одна практика не найдена", async () => {
    const { service } = await buildService(
      {
        intent: "create_schedule",
        date: null,
        items: [{ practiceName: "шавасана", durationMinutes: 10, timeOfDay: "any" }],
        rawText: "",
      },
      ["Медитация"],
    );

    await expect(service.createFromText("user-1", "тест", {})).rejects.toThrow(/Не нашёл в библиотеке/);
  });

  it("дает понятную ошибку при пустой библиотеке", async () => {
    const { service } = await buildService(
      {
        intent: "create_schedule",
        date: null,
        items: [{ practiceName: "медитация", durationMinutes: 10, timeOfDay: "any" }],
        rawText: "",
      },
      [],
    );

    await expect(service.createFromText("user-1", "тест", {})).rejects.toThrow(/В библиотеке нет практик/);
  });
});
