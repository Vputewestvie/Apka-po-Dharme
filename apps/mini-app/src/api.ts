import { fallbackDashboardData } from "./data";
import type {
  DashboardData,
  DiaryEntryDto,
  PracticeDto,
  ScheduleDto,
  StatisticsDto,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: string;
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/**
 * Получение заголовка авторизации.
 *
 * В режиме разработки (VITE_DEV_USER_ID) использует x-user-id.
 * В production пытается получить Telegram init data из Telegram WebApp.
 */
function getAuthHeaders(): Record<string, string> {
  const devUserId = import.meta.env.VITE_DEV_USER_ID;
  if (devUserId) {
    return { "x-user-id": devUserId };
  }

  // Telegram Mini App init data
  try {
    const tg = (window as unknown as Record<string, unknown>).TelegramWebviewProxy
      ?? (window as unknown as Record<string, unknown>).Telegram;
    const initData = (tg as Record<string, unknown>)?.initData as string | undefined;
    if (initData) {
      return { "x-telegram-init-data": initData };
    }
  } catch {
    // ignore
  }

  return {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiResult<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

async function write<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: Record<string, unknown>,
) {
  return request<T>(path, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function loadDashboardData(
  userId = fallbackDashboardData.userId,
  date = fallbackDashboardData.date,
): Promise<DashboardData> {
  try {
    const [practices, schedule, diary, statistics] = await Promise.all([
      request<PracticeDto[]>(`/practices?userId=${encodeURIComponent(userId)}`),
      request<ScheduleDto>(
        `/schedule?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
      ),
      request<DiaryEntryDto[]>(`/diary?userId=${encodeURIComponent(userId)}`),
      request<StatisticsDto>(
        `/statistics?userId=${encodeURIComponent(userId)}&period=week`,
      ),
    ]);

    return {
      userId,
      date,
      source: "api",
      practices,
      schedule,
      diary,
      statistics,
    };
  } catch {
    return fallbackDashboardData;
  }
}

const DEFAULT_IMAGES = [
  "/images/categories/qigong.jpg",
  "/images/categories/pranayama.jpg",
  "/images/categories/reading.jpg",
];

function pickImageByCategory(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("дых") || lower.includes("prana")) return DEFAULT_IMAGES[1];
  if (lower.includes("текст") || lower.includes("read") || lower.includes("книг")) return DEFAULT_IMAGES[2];
  return DEFAULT_IMAGES[0];
}

export function createPractice(input: {
  userId: string;
  title: string;
  category: string;
  defaultDurationMinutes: number;
}) {
  return write<PracticeDto>("/practices", "POST", {
    userId: input.userId,
    title: input.title,
    description: `${input.title} - практика ${input.category.toLowerCase()}.`,
    category: input.category,
    defaultDurationMinutes: input.defaultDurationMinutes,
    color: "#688b76",
    icon: "leaf",
    image: {
      kind: "builtin",
      ref: pickImageByCategory(input.category),
    },
    notes: "",
  });
}

export function saveSchedule(input: {
  userId: string;
  date: string;
  title: string;
  practiceIds: string[];
  practices: PracticeDto[];
  hasExistingSchedule: boolean;
}) {
  const schedulePractices = input.practiceIds
    .map((practiceId, order) => {
      const practice = input.practices.find((item) => item.id === practiceId);
      if (!practice) return null;

      return {
        practiceId,
        plannedStartTime: null,
        plannedDurationMinutes: practice.defaultDurationMinutes,
        order,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (input.hasExistingSchedule) {
    return write<ScheduleDto>("/schedule/practices", "PUT", {
      userId: input.userId,
      date: input.date,
      title: input.title,
      practices: schedulePractices,
    });
  }

  return write<ScheduleDto>("/schedule", "POST", {
    userId: input.userId,
    date: input.date,
    title: input.title,
    practices: schedulePractices,
  });
}

export function repeatYesterday(input: {
  userId: string;
  date: string;
  title: string;
  previousDate: string;
}) {
  return write<ScheduleDto>("/schedule/repeat-yesterday", "POST", input);
}

async function ensureStarted(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
  plannedDurationMinutes: number;
}) {
  try {
    await write("/timer/start", "POST", input);
  } catch {
    // Session may already exist.
  }
}

export async function completeScheduledPractice(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
  plannedDurationMinutes: number;
}) {
  await ensureStarted(input);

  return write("/timer/complete", "POST", {
    scheduledPracticeId: input.scheduledPracticeId,
    timestamp: new Date().toISOString(),
  });
}

export async function skipScheduledPractice(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
  plannedDurationMinutes: number;
  reason?: string;
}) {
  await ensureStarted(input);

  return write("/timer/skip", "POST", {
    scheduledPracticeId: input.scheduledPracticeId,
    timestamp: new Date().toISOString(),
    reason: input.reason ?? "Skipped in Mini App",
  });
}

export async function startTimer(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
  plannedDurationMinutes: number;
}) {
  return write("/timer/start", "POST", input);
}

export async function pauseTimer(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
}) {
  return write("/timer/pause", "POST", input);
}

export async function resumeTimer(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
}) {
  return write("/timer/resume", "POST", input);
}

export async function addTimerTime(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
  minutes: number;
}) {
  return write("/timer/add-time", "POST", {
    ...input,
    timestamp: new Date().toISOString(),
  });
}

export async function completeTimer(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
}) {
  return write("/timer/complete", "POST", {
    ...input,
    timestamp: new Date().toISOString(),
  });
}

export async function autoCompleteTimer(input: {
  userId: string;
  scheduledPracticeId: string;
  practiceId: string;
}) {
  return write("/timer/auto-complete", "POST", input);
}

export function createDiaryEntry(input: {
  userId: string;
  practiceId: string;
  scheduledPracticeId: string;
  text: string;
}) {
  return write("/diary", "POST", {
    userId: input.userId,
    practiceId: input.practiceId,
    scheduledPracticeId: input.scheduledPracticeId,
    kind: "text",
    text: input.text,
  });
}
