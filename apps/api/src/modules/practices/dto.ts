import type { PracticeImage } from "../../../../../packages/domain/src";

export type PracticeInput = {
  userId: string;
  title: string;
  description: string;
  category: string;
  defaultDurationMinutes: number;
  color: string;
  icon: string;
  image: PracticeImage;
  notes?: string;
};

export type PracticeUpdateInput = Partial<Omit<PracticeInput, "userId">> & {
  practiceId: string;
};

export type MaterialInput = {
  practiceId: string;
  title: string;
  url: string;
  type: "article" | "video" | "book" | "lecture";
  sourceDomain: string;
};
