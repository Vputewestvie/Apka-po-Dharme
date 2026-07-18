import { describe, expect, it } from "vitest";
import { Practice } from "../../../../packages/domain/src/practice";

describe("Practice", () => {
  it("creates with required fields", () => {
    const practice = new Practice(
      "practice-1",
      "user-1",
      "Цигун",
      "Мягкая практика",
      "Тело",
      45,
      "#688b76",
      "leaf",
      { kind: "builtin", ref: "/images/qigong.jpg" },
      "manual",
      "",
    );

    expect(practice.id).toBe("practice-1");
    expect(practice.userId).toBe("user-1");
    expect(practice.title).toBe("Цигун");
    expect(practice.defaultDurationMinutes).toBe(45);
    expect(practice.archived).toBe(false);
  });

  it("renames practice", () => {
    const practice = new Practice(
      "practice-1",
      "user-1",
      "Цигун",
      "Мягкая практика",
      "Тело",
      45,
      "#688b76",
      "leaf",
      { kind: "builtin", ref: "/images/qigong.jpg" },
      "manual",
      "",
    );

    practice.rename("Пранаяма");
    expect(practice.title).toBe("Пранаяма");
  });

  it("archives and restores practice", () => {
    const practice = new Practice(
      "practice-1",
      "user-1",
      "Цигун",
      "Мягкая практика",
      "Тело",
      45,
      "#688b76",
      "leaf",
      { kind: "builtin", ref: "/images/qigong.jpg" },
      "manual",
      "",
    );

    expect(practice.archived).toBe(false);
    practice.archive();
    expect(practice.archived).toBe(true);
    practice.restore();
    expect(practice.archived).toBe(false);
  });

  it("updates details", () => {
    const practice = new Practice(
      "practice-1",
      "user-1",
      "Цигун",
      "Мягкая практика",
      "Тело",
      45,
      "#688b76",
      "leaf",
      { kind: "builtin", ref: "/images/qigong.jpg" },
      "manual",
      "",
    );

    practice.updateDetails({
      description: "Новое описание",
      category: "Дыхание",
      defaultDurationMinutes: 60,
      color: "#7f8467",
      icon: "wind",
      notes: "Заметка",
    });

    expect(practice.description).toBe("Новое описание");
    expect(practice.category).toBe("Дыхание");
    expect(practice.defaultDurationMinutes).toBe(60);
    expect(practice.color).toBe("#7f8467");
    expect(practice.icon).toBe("wind");
    expect(practice.notes).toBe("Заметка");
  });
});