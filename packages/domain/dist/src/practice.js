export class Practice {
    id;
    userId;
    title;
    description;
    category;
    defaultDurationMinutes;
    color;
    icon;
    image;
    source;
    notes;
    archived;
    createdAt;
    updatedAt;
    constructor(id, userId, title, description, category, defaultDurationMinutes, color, icon, image, source = "manual", notes = "", archived = false, createdAt = new Date().toISOString(), updatedAt = new Date().toISOString()) {
        this.id = id;
        this.userId = userId;
        this.title = title;
        this.description = description;
        this.category = category;
        this.defaultDurationMinutes = defaultDurationMinutes;
        this.color = color;
        this.icon = icon;
        this.image = image;
        this.source = source;
        this.notes = notes;
        this.archived = archived;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        if (!title.trim())
            throw new Error("Practice title is required");
        if (defaultDurationMinutes <= 0)
            throw new Error("Practice duration must be positive");
    }
    rename(title) {
        if (!title.trim())
            throw new Error("Practice title is required");
        this.title = title;
        this.touch();
    }
    updateDetails(input) {
        if (input.description !== undefined)
            this.description = input.description;
        if (input.category !== undefined)
            this.category = input.category;
        if (input.defaultDurationMinutes !== undefined) {
            if (input.defaultDurationMinutes <= 0)
                throw new Error("Practice duration must be positive");
            this.defaultDurationMinutes = input.defaultDurationMinutes;
        }
        if (input.color !== undefined)
            this.color = input.color;
        if (input.icon !== undefined)
            this.icon = input.icon;
        if (input.image !== undefined)
            this.image = input.image;
        if (input.notes !== undefined)
            this.notes = input.notes;
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
