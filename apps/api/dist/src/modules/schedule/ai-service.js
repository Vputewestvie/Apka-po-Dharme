export class ScheduleAiService {
    aiService;
    scheduleService;
    constructor(aiService, scheduleService) {
        this.aiService = aiService;
        this.scheduleService = scheduleService;
    }
    async createFromText(userId, text, practiceNameToId) {
        const parsed = await this.aiService.parseScheduleText(text, { userId });
        if (!parsed.date)
            throw new Error("AI did not return schedule date");
        return this.scheduleService.create({
            userId,
            date: parsed.date,
            title: "AI schedule",
            source: "text_ai",
            practices: parsed.items.map((item, index) => ({
                practiceId: practiceNameToId[item.practiceName] ?? item.practiceName,
                plannedStartTime: null,
                plannedDurationMinutes: item.durationMinutes,
                order: index,
            })),
        });
    }
    async createFromVoice(userId, fileId, practiceNameToId) {
        const parsed = await this.aiService.parseScheduleVoice(fileId, { userId });
        if (!parsed.date)
            throw new Error("AI did not return schedule date");
        return this.scheduleService.create({
            userId,
            date: parsed.date,
            title: "Voice schedule",
            source: "voice_ai",
            practices: parsed.items.map((item, index) => ({
                practiceId: practiceNameToId[item.practiceName] ?? item.practiceName,
                plannedStartTime: null,
                plannedDurationMinutes: item.durationMinutes,
                order: index,
            })),
        });
    }
}
