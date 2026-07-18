type TelegramResponse<T> = {
  ok: boolean;
  result: T;
};

export type TelegramMessage = {
  message_id: number;
  chat: {
    id: number;
  };
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
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
        allowed_updates: ["message"],
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
