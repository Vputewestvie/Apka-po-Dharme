export class OpenAiCompatibleProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async parseScheduleText(request) {
        const content = await this.complete(`Parse this Russian schedule command as JSON: ${request.text}`);
        return parseJsonCommand(content, request.text);
    }
    async parseScheduleVoice(request) {
        return {
            intent: "unknown",
            date: null,
            items: [],
            rawText: request.fileId,
        };
    }
    async answerUserQuestion(request) {
        return this.complete(request.text);
    }
    async complete(prompt) {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [{ role: "user", content: prompt }],
            }),
        });
        if (!response.ok)
            throw new Error("AI provider request failed");
        const data = await response.json();
        return data.choices?.[0]?.message?.content ?? "";
    }
}
function parseJsonCommand(content, rawText) {
    try {
        const parsed = JSON.parse(content);
        return {
            intent: parsed.intent ?? "unknown",
            date: parsed.date ?? null,
            items: Array.isArray(parsed.items) ? parsed.items : [],
            rawText,
        };
    }
    catch {
        return {
            intent: "unknown",
            date: null,
            items: [],
            rawText,
        };
    }
}
