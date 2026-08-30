import type { NotificationJobRow } from "../../../packages/database/src";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: string;
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class BackendApiClient {
  /**
   * @param baseUrl Базовый адрес API.
   * @param internalToken Служебный токен (тот же, что в INTERNAL_API_TOKEN на стороне API).
   *        Бот работает как доверенный сервис и не действует от имени пользователя.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken = process.env.INTERNAL_API_TOKEN ?? "",
  ) {}

  async listPendingNotifications(now = new Date().toISOString()) {
    return this.request<NotificationJobRow[]>(`/notifications/pending?now=${encodeURIComponent(now)}`);
  }

  async markNotificationSent(jobId: string, sentAt = new Date().toISOString()) {
    return this.request("/notifications/mark-sent", {
      method: "POST",
      body: {
        jobId,
        sentAt,
      },
    });
  }

  private async request<T>(path: string, init?: { method?: string; body?: Record<string, unknown> }) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(this.internalToken ? { "x-internal-token": this.internalToken } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
        // тело недоступно — останется голый статус
      }
      throw new Error(`Backend API error: ${response.status} ${detail}`);
    }

    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }

    return payload.data;
  }
}
