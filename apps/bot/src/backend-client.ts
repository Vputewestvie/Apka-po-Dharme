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
  constructor(private readonly baseUrl: string) {}

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
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }

    return payload.data;
  }
}
