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
    // Официальный telegram-web-app.js кладёт данные в Telegram.WebApp.initData.
    // TelegramWebviewProxy — это внутренний мост вебвью без initData: раньше
    // цепочка начиналась с него, и в настоящем Telegram приложение уходило
    // без заголовка авторизации (сервер отвечал 401).
    const tg = (window as unknown as Record<string, unknown>).Telegram as
      | (Record<string, unknown> & { WebApp?: Record<string, unknown> })
      | undefined;
    const initData =
      (tg?.WebApp?.initData as string | undefined) ?? (tg?.initData as string | undefined);
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
    // Сервер присылает понятный текст ошибки (например, подсказку про план
    // дня) — показываем его, а не безликое «Request failed: 400».
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as ApiFailure;
      if (payload && !payload.ok && payload.error) detail = payload.error;
    } catch {
      // тело не JSON — остаётся общий текст со статусом
    }
    throw new Error(detail);
  }

  const payload = (await response.json()) as ApiResult<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

async function write<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
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

/**
 * Сегодняшняя дата в формате YYYY-MM-DD в локальном часовом поясе устройства.
 *
 * Раньше дашборд по умолчанию брал дату из fallbackDashboardData
 * («2026-07-11»), и расписание запрашивалось на прошлогодний день — счётчик
 * «5 практик» показывал библиотеку, а карточки дня были пустыми.
 */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export async function loadDashboardData(
  userId = fallbackDashboardData.userId,
  date = todayIso(),
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

// Библиотека картинок по категориям: выбор по ключевым словам в названии
// категории практики, при отсутствии совпадений — медитация.
const DEFAULT_IMAGES = {
  meditation: "/images/categories/meditation.webp",
  pranayama: "/images/categories/pranayama.webp",
  qigong: "/images/categories/qigong.webp",
  reading: "/images/categories/reading.webp",
  mantra: "/images/categories/mantra.webp",
  walk: "/images/categories/walk.webp",
  sleep: "/images/categories/sleep.webp",
  gratitude: "/images/categories/gratitude.webp",
};

function pickImageByCategory(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("дых") || lower.includes("prana")) return DEFAULT_IMAGES.pranayama;
  if (lower.includes("текст") || lower.includes("read") || lower.includes("книг")) return DEFAULT_IMAGES.reading;
  if (lower.includes("йог") || lower.includes("цигун") || lower.includes("тело") || lower.includes("qigong")) return DEFAULT_IMAGES.qigong;
  if (lower.includes("мантр") || lower.includes("japa")) return DEFAULT_IMAGES.mantra;
  if (lower.includes("прогул") || lower.includes("walk") || lower.includes("природ")) return DEFAULT_IMAGES.walk;
  if (lower.includes("сон") || lower.includes("sleep") || lower.includes("evening") || lower.includes("отдых")) return DEFAULT_IMAGES.sleep;
  if (lower.includes("дневник") || lower.includes("благодар") || lower.includes("gratitude")) return DEFAULT_IMAGES.gratitude;
  return DEFAULT_IMAGES.meditation;
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

/** Полное удаление практики (вместе со связанными записями — каскад на сервере). */
export function deletePractice(input: { userId: string; practiceId: string }) {
  return write<{ deleted: boolean }>("/practices", "DELETE", {
    userId: input.userId,
    practiceId: input.practiceId,
  });
}

/**
 * Генерация расписания дня через AI: пользователь описывает желаемый день
 * текстом, сервер разбирает описание и создаёт план из практик библиотеки.
 */
export function generateAiSchedule(input: {
  userId: string;
  text: string;
  practiceNameToId: Record<string, string>;
}) {
  return write<ScheduleDto>("/schedule/ai/text", "POST", {
    userId: input.userId,
    text: input.text,
    practiceNameToId: input.practiceNameToId,
  });
}

/**
 * AI-анализ дневника: сервер собирает записи практики и возвращает
 * наблюдения и рекомендации в контексте дхармы. Вопрос необязателен.
 */
export function analyzeDiary(input: { userId: string; question?: string }) {
  return write<{ analysis: string }>("/diary/ai/analyze", "POST", {
    userId: input.userId,
    question: input.question ?? "",
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
  return write("/timer/auto-complete", "POST", {
    ...input,
    timestamp: new Date().toISOString(),
  });
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
