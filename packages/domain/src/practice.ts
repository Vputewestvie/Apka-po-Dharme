import type { ID, PracticeCategory, PracticeSource } from "./types";

export type PracticeImage = {
  kind: "builtin" | "user";
  ref: string;
};

export class Practice {
  constructor(
    public readonly id: ID,
    public readonly userId: ID,
    public title: string,
    public description: string,
    public category: PracticeCategory,
    public defaultDurationMinutes: number,
    public color: string,
    public icon: string,
    public image: PracticeImage,
    public readonly source: PracticeSource = "manual",
    public notes: string = "",
    public archived = false,
    public readonly createdAt: string = new Date().toISOString(),
    public updatedAt: string = new Date().toISOString(),
  ) {
    if (!title.trim()) throw new Error("Practice title is required");
    if (defaultDurationMinutes <= 0) throw new Error("Practice duration must be positive");
  }

  rename(title: string) {
    if (!title.trim()) throw new Error("Practice title is required");
    this.title = title;
    this.touch();
  }

  updateDetails(input: {
    description?: string;
    category?: PracticeCategory;
    defaultDurationMinutes?: number;
    color?: string;
    icon?: string;
    image?: PracticeImage;
    notes?: string;
  }) {
    if (input.description !== undefined) this.description = input.description;
    if (input.category !== undefined) this.category = input.category;
    if (input.defaultDurationMinutes !== undefined) {
      if (input.defaultDurationMinutes <= 0) throw new Error("Practice duration must be positive");
      this.defaultDurationMinutes = input.defaultDurationMinutes;
    }
    if (input.color !== undefined) this.color = input.color;
    if (input.icon !== undefined) this.icon = input.icon;
    if (input.image !== undefined) this.image = input.image;
    if (input.notes !== undefined) this.notes = input.notes;
    this.touch();
  }

  archive() {
    this.archived = true;
    this.touch();
  }

  restore() {
    this.archived = false;
    this.touch();
  }

  touch() {
    this.updatedAt = new Date().toISOString();
  }
}
