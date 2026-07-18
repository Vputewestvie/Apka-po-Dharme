import type { ID, PracticeCategory, PracticeSource } from "./types";
export type PracticeImage = {
    kind: "builtin" | "user";
    ref: string;
};
export declare class Practice {
    readonly id: ID;
    readonly userId: ID;
    title: string;
    description: string;
    category: PracticeCategory;
    defaultDurationMinutes: number;
    color: string;
    icon: string;
    image: PracticeImage;
    readonly source: PracticeSource;
    notes: string;
    archived: boolean;
    readonly createdAt: string;
    updatedAt: string;
    constructor(id: ID, userId: ID, title: string, description: string, category: PracticeCategory, defaultDurationMinutes: number, color: string, icon: string, image: PracticeImage, source?: PracticeSource, notes?: string, archived?: boolean, createdAt?: string, updatedAt?: string);
    rename(title: string): void;
    updateDetails(input: {
        description?: string;
        category?: PracticeCategory;
        defaultDurationMinutes?: number;
        color?: string;
        icon?: string;
        image?: PracticeImage;
        notes?: string;
    }): void;
    archive(): void;
    restore(): void;
    touch(): void;
}
//# sourceMappingURL=practice.d.ts.map