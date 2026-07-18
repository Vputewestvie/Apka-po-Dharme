export class AiService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    parseScheduleText(text, context) {
        return this.provider.parseScheduleText({ text, context });
    }
    parseScheduleVoice(fileId, context) {
        return this.provider.parseScheduleVoice({ fileId, context });
    }
    answerUserQuestion(text, context) {
        return this.provider.answerUserQuestion({ text, context });
    }
}
