export class MockAiProvider {
    async parseScheduleText(request) {
        return {
            intent: "unknown",
            date: null,
            items: [],
            rawText: request.text,
        };
    }
    async parseScheduleVoice(request) {
        return {
            intent: "unknown",
            date: null,
            items: [],
            rawText: request.fileId,
        };
    }
    async answerUserQuestion() {
        return "AI is disabled.";
    }
}
