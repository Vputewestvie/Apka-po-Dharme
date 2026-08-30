type TelegramResponse<T> = {
  ok: boolean;
  result: T;
};

export type TelegramFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: {
    id: number;
  };
  from?: TelegramFrom;
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramFrom;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export class TelegramBotApi {
  private readonly baseUrl: string;

  constructor(token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async getUpdates(offset?: number, timeoutSeconds = 25) {
    return this.request<TelegramUpdate[]>("/getUpdates", {
      method: "POST",
      body: {
        offset,
        timeout: timeoutSeconds,
        allowed_updates: ["message", "callback_query"],
      },
    });
  }

  async sendMessage(chatId: string, text: string, extra?: Record<string, unknown>) {
    return this.request("/sendMessage", {
      method: "POST",
      body: {
        chat_id: chatId,
        text,
        ...extra,
      },
    });
  }

  async editMessageText(
    chatId: string,
    messageId: number,
    text: string,
    extra?: Record<string, unknown>,
  ) {
    return this.request("/editMessageText", {
      method: "POST",
      body: {
        chat_id: chatId,
        message_id: messageId,
        text,
        ...extra,
      },
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.request("/answerCallbackQuery", {
      method: "POST",
      body: {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      },
    });
  }

  async setMyCommands(commands: Array<{ command: string; description: string }>) {
    return this.request("/setMyCommands", {
      method: "POST",
      body: { commands },
    });
  }

  private async request<T>(path: string, init: { method: string; body: Record<string, unknown> }) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(init.body),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const payload = (await response.json()) as TelegramResponse<T>;
    if (!payload.ok) {
      throw new Error("Telegram API returned error");
    }

    return payload.result;
  }
}
