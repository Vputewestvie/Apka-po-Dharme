import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Moon,
  NotebookPen,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addTimerTime,
  completeTimer,
  completeScheduledPractice,
  createDiaryEntry,
  createPractice,
  deletePractice,
  generateAiSchedule,
  loadDashboardData,
  pauseTimer,
  repeatYesterday,
  resumeTimer,
  saveSchedule,
  skipScheduledPractice,
  startTimer,
} from "./api";
import { SoundBathPlayer } from "./components/SoundBathPlayer";
import { TimerOverlay } from "./components/TimerOverlay";
import type {
  DashboardData,
  DiaryEntryDto,
  MiniAppScreen,
  PracticeDto,
  ScheduledPracticeDto,
  StatisticsDto,
} from "./types";

function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return { theme, toggleTheme };
}

const navigation = [
  { id: "today", label: "Сегодня", icon: Clock3 },
  { id: "library", label: "Практики", icon: BookOpen },
  { id: "schedule", label: "План", icon: CalendarDays },
  { id: "diary", label: "Дневник", icon: NotebookPen },
  { id: "statistics", label: "Статистика", icon: BarChart3 },
  { id: "settings", label: "Настройки", icon: Settings2 },
] as const satisfies { id: MiniAppScreen; label: string; icon: typeof Clock3 }[];

type ScreenActions = {
  busy: string | null;
  onCompletePractice: (item: ScheduledPracticeDto) => Promise<void>;
  onCreateDiary: (input: {
    scheduledPracticeId: string;
    practiceId: string;
    text: string;
  }) => Promise<void>;
  onCreatePractice: (input: {
    title: string;
    category: string;
    defaultDurationMinutes: number;
  }) => Promise<void>;
  onDeletePractice: (practiceId: string) => Promise<void>;
  onGenerateAiSchedule: (text: string) => Promise<void>;
  onOpenDiary: () => void;
  onRepeatYesterday: () => Promise<void>;
  onSaveSchedule: (practiceIds: string[], title: string) => Promise<void>;
  onSkipPractice: (item: ScheduledPracticeDto) => Promise<void>;
  onStartPractice: (item: ScheduledPracticeDto) => Promise<void>;
  timerBusy: string | null;
  activeTimerId: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function App() {
  const [screen, setScreen] = useState<MiniAppScreen>("today");
  const { theme, toggleTheme } = useTheme();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [timerBusy, setTimerBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timerOverlayOpen, setTimerOverlayOpen] = useState(false);
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, string>>({});
  const [activeTimer, setActiveTimer] = useState<{
    item: ScheduledPracticeDto;
    practice: PracticeDto;
    remainingSeconds: number;
    status: "running" | "paused";
  } | null>(null);
  const intervalRef = useRef<number | null>(null);

  function describeError(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  /**
   * Единая обёртка пользовательских действий: показывает busy, сбрасывает его
   * даже при ошибке и выводит баннер — раньше ошибка запроса проглатывалась
   * молча, и кнопка просто «не работала» без каких-либо объяснений.
   */
  async function runBusy(key: string, action: () => Promise<void>) {
    setBusy(key);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setBusy(null);
    }
  }

  async function refreshDashboard(nextOverrides = sessionOverrides) {
    const data = await loadDashboardData();

    if (data.schedule) {
      data.schedule.items = data.schedule.items.map((item) => ({
        ...item,
        status: nextOverrides[item.id] ?? item.status,
      }));
    }

    setDashboard(data);
    setLoading(false);
  }

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current !== null) return;

    intervalRef.current = window.setInterval(() => {
      setActiveTimer((current) => {
        if (!current || current.status !== "running") return current;
        const nextSeconds = current.remainingSeconds - 1;

        if (nextSeconds <= 0) {
          window.clearInterval(intervalRef.current!);
          intervalRef.current = null;
          void handleTimerComplete();
          return { ...current, remainingSeconds: 0 };
        }

        return { ...current, remainingSeconds: nextSeconds };
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTimer?.status]);

  async function handleCreatePractice(input: {
    title: string;
    category: string;
    defaultDurationMinutes: number;
  }) {
    if (!dashboard) return;

    await runBusy("practice", async () => {
      await createPractice({
        userId: dashboard.userId,
        ...input,
      });
      await refreshDashboard();
      setScreen("library");
    });
  }

  async function handleDeletePractice(practiceId: string) {
    if (!dashboard) return;

    await runBusy(`delete:${practiceId}`, async () => {
      await deletePractice({
        userId: dashboard.userId,
        practiceId,
      });
      await refreshDashboard();
    });
  }

  async function handleGenerateAiSchedule(text: string) {
    if (!dashboard) return;

    await runBusy("ai", async () => {
      await generateAiSchedule({
        userId: dashboard.userId,
        text,
        practiceNameToId: Object.fromEntries(
          dashboard.practices.map((practice) => [practice.title, practice.id]),
        ),
      });
      await refreshDashboard();
    });
  }

  async function handleSaveSchedule(practiceIds: string[], title: string) {
    if (!dashboard) return;

    await runBusy("schedule", async () => {
      await saveSchedule({
        userId: dashboard.userId,
        date: dashboard.date,
        title,
        practiceIds,
        practices: dashboard.practices,
        hasExistingSchedule: Boolean(dashboard.schedule),
      });
      await refreshDashboard();
    });
  }

  async function handleRepeatYesterday() {
    if (!dashboard) return;

    const currentDate = new Date(`${dashboard.date}T00:00:00`);
    currentDate.setDate(currentDate.getDate() - 1);

    await runBusy("repeat", async () => {
      await repeatYesterday({
        userId: dashboard.userId,
        date: dashboard.date,
        title: "Повтор вчерашнего дня",
        previousDate: currentDate.toISOString().slice(0, 10),
      });
      await refreshDashboard();
    });
  }

  async function handleCompletePractice(item: ScheduledPracticeDto) {
    if (!dashboard) return;

    const nextOverrides = { ...sessionOverrides, [item.id]: "completed" };
    setSessionOverrides(nextOverrides);

    await runBusy(item.id, async () => {
      await completeScheduledPractice({
        userId: dashboard.userId,
        scheduledPracticeId: item.id,
        practiceId: item.practiceId,
        plannedDurationMinutes: item.plannedDurationMinutes,
      });
      await refreshDashboard(nextOverrides);
    });
  }

  async function handleSkipPractice(item: ScheduledPracticeDto) {
    if (!dashboard) return;

    const nextOverrides = { ...sessionOverrides, [item.id]: "skipped" };
    setSessionOverrides(nextOverrides);

    await runBusy(`skip:${item.id}`, async () => {
      await skipScheduledPractice({
        userId: dashboard.userId,
        scheduledPracticeId: item.id,
        practiceId: item.practiceId,
        plannedDurationMinutes: item.plannedDurationMinutes,
      });
      await refreshDashboard(nextOverrides);
    });
  }

  async function handleCreateDiary(input: {
    scheduledPracticeId: string;
    practiceId: string;
    text: string;
  }) {
    if (!dashboard) return;

    await runBusy("diary", async () => {
      await createDiaryEntry({
        userId: dashboard.userId,
        ...input,
      });
      await refreshDashboard();
    });
  }

  async function handleStartPractice(item: ScheduledPracticeDto) {
    if (!dashboard) return;
    const practice = practiceMap.get(item.practiceId);
    if (!practice) return;

    setTimerBusy(`start:${item.id}`);
    try {
      await startTimer({
        userId: dashboard.userId,
        scheduledPracticeId: item.id,
        practiceId: item.practiceId,
        plannedDurationMinutes: item.plannedDurationMinutes,
      });

      setActiveTimer({
        item,
        practice,
        remainingSeconds: item.plannedDurationMinutes * 60,
        status: "running",
      });
      setTimerOverlayOpen(true);
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setTimerBusy(null);
    }
  }

  async function handleTimerPause() {
    if (!dashboard || !activeTimer) return;

    setTimerBusy(`pause:${activeTimer.item.id}`);
    try {
      await pauseTimer({
        userId: dashboard.userId,
        scheduledPracticeId: activeTimer.item.id,
        practiceId: activeTimer.item.practiceId,
      });
      setActiveTimer({ ...activeTimer, status: "paused" });
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setTimerBusy(null);
    }
  }

  async function handleTimerResume() {
    if (!dashboard || !activeTimer) return;

    setTimerBusy(`resume:${activeTimer.item.id}`);
    try {
      await resumeTimer({
        userId: dashboard.userId,
        scheduledPracticeId: activeTimer.item.id,
        practiceId: activeTimer.item.practiceId,
      });
      setActiveTimer({ ...activeTimer, status: "running" });
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setTimerBusy(null);
    }
  }

  async function handleTimerAddTime(minutes: number) {
    if (!dashboard || !activeTimer) return;

    setTimerBusy(`add:${activeTimer.item.id}`);
    try {
      await addTimerTime({
        userId: dashboard.userId,
        scheduledPracticeId: activeTimer.item.id,
        practiceId: activeTimer.item.practiceId,
        minutes,
      });
      setActiveTimer({ ...activeTimer, remainingSeconds: activeTimer.remainingSeconds + minutes * 60 });
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setTimerBusy(null);
    }
  }

  async function handleTimerComplete() {
    if (!dashboard || !activeTimer) return;

    setTimerBusy(`complete:${activeTimer.item.id}`);
    try {
      await completeTimer({
        userId: dashboard.userId,
        scheduledPracticeId: activeTimer.item.id,
        practiceId: activeTimer.item.practiceId,
      });
      const nextOverrides = { ...sessionOverrides, [activeTimer.item.id]: "completed" };
      setActiveTimer(null);
      await refreshDashboard(nextOverrides);
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setTimerBusy(null);
    }
  }

  async function handleTimerSkip() {
    if (!dashboard || !activeTimer) return;

    setTimerBusy(`skip:${activeTimer.item.id}`);
    try {
      const nextOverrides = { ...sessionOverrides, [activeTimer.item.id]: "skipped" };
      await skipScheduledPractice({
        userId: dashboard.userId,
        scheduledPracticeId: activeTimer.item.id,
        practiceId: activeTimer.item.practiceId,
        plannedDurationMinutes: activeTimer.item.plannedDurationMinutes,
      });
      setActiveTimer(null);
      await refreshDashboard(nextOverrides);
    } catch (error) {
      setActionError(describeError(error));
    } finally {
      setTimerBusy(null);
    }
  }

  function closeTimer() {
    setTimerOverlayOpen(false);
  }

  const practiceMap = useMemo(() => {
    return new Map((dashboard?.practices ?? []).map((practice) => [practice.id, practice]));
  }, [dashboard]);

  const scheduledItems = dashboard?.schedule?.items ?? [];
  const completedCount = scheduledItems.filter((item) => item.status === "completed").length;
  const activeTimerBusy = activeTimer ? timerBusy?.includes(activeTimer.item.id) ?? false : false;

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Telegram Mini App</span>
          <h1>Дневник духовной практики</h1>
          <p>Ежедневный ритм, практика и тихая ясность в одном месте.</p>
        </div>
        <div className="hero-meta">
          <div className="metric">
            <span>Сегодня</span>
            <strong>{scheduledItems.length || dashboard?.practices.length || 0} практики</strong>
          </div>
          <div className="metric">
            <span>Готово</span>
            <strong>
              {completedCount} из {scheduledItems.length || dashboard?.practices.length || 0}
            </strong>
          </div>
        </div>
      </header>

      {actionError ? (
        <div className="action-error" role="alert">
          <span>Не получилось: {actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Закрыть ошибку">
            ×
          </button>
        </div>
      ) : null}

      <main className="content">
        {loading || !dashboard ? (
          <section className="stack">
            <article className="panel">
              <span className="eyebrow">Загрузка</span>
              <h2>Подтягиваем практики</h2>
              <p>Собираем библиотеку, расписание и дневник.</p>
            </article>
          </section>
        ) : (
          renderScreen(screen, dashboard, practiceMap, {
            busy,
            onCompletePractice: handleCompletePractice,
            onCreateDiary: handleCreateDiary,
            onCreatePractice: handleCreatePractice,
            onDeletePractice: handleDeletePractice,
            onGenerateAiSchedule: handleGenerateAiSchedule,
            onOpenDiary() {
              setScreen("diary");
            },
            onRepeatYesterday: handleRepeatYesterday,
            onSaveSchedule: handleSaveSchedule,
            onSkipPractice: handleSkipPractice,
            onStartPractice: handleStartPractice,
            timerBusy,
            activeTimerId: activeTimer?.item.id ?? null,
            theme,
            onToggleTheme: toggleTheme,
          })
        )}
      </main>

      {activeTimer && !timerOverlayOpen ? (
        <div className="timer-banner">
          <div>
            <strong>Таймер запущен:</strong> {activeTimer.practice.title} · {Math.floor(activeTimer.remainingSeconds / 60)}:{String(activeTimer.remainingSeconds % 60).padStart(2, "0")} · {activeTimer.status === "running" ? "В работе" : "Пауза"}
          </div>
          <button type="button" className="secondary-button" onClick={() => setTimerOverlayOpen(true)}>
            Открыть таймер
          </button>
        </div>
      ) : null}

      {activeTimer && timerOverlayOpen ? (
        <TimerOverlay
          practice={activeTimer.practice}
          scheduledPracticeId={activeTimer.item.id}
          remainingSeconds={activeTimer.remainingSeconds}
          status={activeTimer.status}
          busy={activeTimerBusy}
          onClose={() => setTimerOverlayOpen(false)}
          onPause={handleTimerPause}
          onResume={handleTimerResume}
          onAddTime={handleTimerAddTime}
          onComplete={handleTimerComplete}
          onSkip={handleTimerSkip}
        />
      ) : null}

      <nav className="bottom-nav" aria-label="Навигация">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.id === screen;

          return (
            <button
              key={item.id}
              type="button"
              className={active ? "nav-item active" : "nav-item"}
              onClick={() => setScreen(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Музыкальный плеер живёт на уровне App: одна копия на все вкладки
          и не глохнет при переключении экранов или открытии таймера. */}
      <SoundBathPlayer />
    </div>
  );
}

function renderScreen(
  screen: MiniAppScreen,
  dashboard: DashboardData,
  practiceMap: Map<string, PracticeDto>,
  actions: ScreenActions,
) {
  switch (screen) {
    case "today":
      return (
        <TodayScreen
          busy={actions.busy}
          dashboard={dashboard}
          onCompletePractice={actions.onCompletePractice}
          onGenerateAiSchedule={actions.onGenerateAiSchedule}
          onOpenDiary={actions.onOpenDiary}
          onSkipPractice={actions.onSkipPractice}
          onStartPractice={actions.onStartPractice}
          timerBusy={actions.timerBusy}
          activeTimerId={actions.activeTimerId}
          practiceMap={practiceMap}
        />
      );
    case "library":
      return (
        <LibraryScreen
          busy={actions.busy === "practice"}
          practices={dashboard.practices}
          onCreatePractice={actions.onCreatePractice}
          onDeletePractice={actions.onDeletePractice}
          deleteBusy={actions.busy?.startsWith("delete:") ? actions.busy : null}
        />
      );
    case "schedule":
      return (
        <ScheduleScreen
          busy={actions.busy === "schedule" || actions.busy === "repeat"}
          dashboard={dashboard}
          practiceMap={practiceMap}
          onRepeatYesterday={actions.onRepeatYesterday}
          onSaveSchedule={actions.onSaveSchedule}
        />
      );
    case "diary":
      return (
        <DiaryScreen
          busy={actions.busy === "diary"}
          diary={dashboard.diary}
          onCreateDiary={actions.onCreateDiary}
          practiceMap={practiceMap}
          scheduledItems={dashboard.schedule?.items ?? []}
        />
      );
    case "statistics":
      return <StatisticsScreen statistics={dashboard.statistics} practiceMap={practiceMap} />;
    case "settings":
      return (
        <SettingsScreen theme={actions.theme} onToggleTheme={actions.onToggleTheme} />
      );
  }
}

function TodayScreen(props: {
  busy: string | null;
  dashboard: DashboardData;
  onCompletePractice: (item: ScheduledPracticeDto) => Promise<void>;
  onGenerateAiSchedule: (text: string) => Promise<void>;
  onOpenDiary: () => void;
  onSkipPractice: (item: ScheduledPracticeDto) => Promise<void>;
  onStartPractice: (item: ScheduledPracticeDto) => Promise<void>;
  timerBusy: string | null;
  activeTimerId: string | null;
  practiceMap: Map<string, PracticeDto>;
}) {
  const scheduledItems = props.dashboard.schedule?.items ?? [];
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");

  async function handleGenerate() {
    const text = aiText.trim();
    if (!text) return;
    await props.onGenerateAiSchedule(text);
  }

  return (
    <section className="stack">
      <div className="panel panel-quiet">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Сегодняшний поток</span>
            <h2>Практики дня</h2>
          </div>
          <button
            type="button"
            className={aiOpen ? "ghost-button active" : "ghost-button"}
            aria-expanded={aiOpen}
            aria-label="Собрать план с помощью AI"
            title="Собрать план дня с помощью AI"
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles size={16} />
          </button>
        </div>
        {aiOpen ? (
          <div className="ai-composer">
            <textarea
              value={aiText}
              onChange={(event) => setAiText(event.target.value)}
              placeholder="Опишите желаемый день, например: «утром 15 минут медитации, днём дыхание, вечером чтение»"
              rows={3}
            />
            <button
              type="button"
              className="primary-button"
              disabled={!aiText.trim() || props.busy === "ai"}
              onClick={() => void handleGenerate()}
            >
              {props.busy === "ai" ? "Собираю план..." : "Собрать план дня"}
            </button>
          </div>
        ) : null}
        <div className="practice-list">
          {scheduledItems.map((item) => {
            const practice = props.practiceMap.get(item.practiceId);
            if (!practice) return null;

            return (
              <article key={item.id} className="practice-card">
                <img src={practice.image.ref} alt={practice.title} className="practice-image" />
                <div className="practice-body">
                  <div className="practice-top">
                    <div>
                      <h3>{practice.title}</h3>
                      <p>{practice.category}</p>
                    </div>
                    {item.status === "completed" ? (
                      <span className="status done">
                        <CheckCircle2 size={16} />
                        <span>Готово</span>
                      </span>
                    ) : (
                      <span className="status pending">
                        <Clock3 size={16} />
                        <span>{item.plannedDurationMinutes} мин</span>
                      </span>
                    )}
                  </div>
                  <div className={item.status === "completed" ? "practice-actions practice-actions-2" : "practice-actions practice-actions-4"}>
                    {item.status !== "completed" ? (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          (!!props.activeTimerId && props.activeTimerId !== item.id) ||
                          props.timerBusy === `start:${item.id}`
                        }
                        onClick={() => void props.onStartPractice(item)}
                      >
                        {props.activeTimerId === item.id
                          ? props.timerBusy === `start:${item.id}`
                            ? "Обновляю..."
                            : "Таймер"
                          : props.timerBusy === `start:${item.id}`
                          ? "Запуск..."
                          : "Начать"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="primary-button"
                      disabled={props.busy === item.id}
                      onClick={() => void props.onCompletePractice(item)}
                    >
                      {props.busy === item.id ? "Сохраняю..." : "Выполнено"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={props.onOpenDiary}
                    >
                      Дневник
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={props.busy === `skip:${item.id}`}
                      onClick={() => void props.onSkipPractice(item)}
                    >
                      Пропустить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LibraryScreen(props: {
  practices: PracticeDto[];
  busy: boolean;
  deleteBusy: string | null;
  onCreatePractice: (input: {
    title: string;
    category: string;
    defaultDurationMinutes: number;
  }) => Promise<void>;
  onDeletePractice: (practiceId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Тело");
  const [duration, setDuration] = useState("20");

  async function handleSubmit() {
    if (!title.trim()) return;

    await props.onCreatePractice({
      title: title.trim(),
      category,
      defaultDurationMinutes: Number(duration),
    });

    setTitle("");
    setCategory("Тело");
    setDuration("20");
  }

  return (
    <section className="stack">
      <article className="panel">
        <span className="eyebrow">Библиотека</span>
        <h2>{props.practices.length} практики</h2>
        <div className="form-grid">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Новая практика"
            className="text-input"
          />
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Категория"
            className="text-input"
          />
          <input
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="Минуты"
            className="text-input"
            inputMode="numeric"
          />
          <button
            type="button"
            className="primary-button"
            disabled={props.busy}
            onClick={() => void handleSubmit()}
          >
            {props.busy ? "Сохраняю..." : "Добавить"}
          </button>
        </div>
        <div className="row-list">
          {props.practices.map((practice) => (
            <div key={practice.id} className="row-item">
              <div>
                <strong>{practice.title}</strong>
                <p>
                  {practice.category} · {practice.defaultDurationMinutes} мин
                </p>
              </div>
              <div className="row-item-actions">
                <span className="tag">{practice.archived ? "Архив" : "Активна"}</span>
                <button
                  type="button"
                  className="icon-danger-button"
                  disabled={props.deleteBusy === practice.id}
                  aria-label={`Удалить практику ${practice.title}`}
                  title="Удалить практику"
                  onClick={() => {
                    if (window.confirm(`Удалить практику «${practice.title}»? Действие необратимо.`)) {
                      void props.onDeletePractice(practice.id);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function ScheduleScreen(props: {
  dashboard: DashboardData;
  practiceMap: Map<string, PracticeDto>;
  busy: boolean;
  onSaveSchedule: (practiceIds: string[], title: string) => Promise<void>;
  onRepeatYesterday: () => Promise<void>;
}) {
  const items = props.dashboard.schedule?.items ?? [];
  const [selectedIds, setSelectedIds] = useState(items.map((item) => item.practiceId));
  const [title, setTitle] = useState(props.dashboard.schedule?.title || "Мой день");

  useEffect(() => {
    setSelectedIds(items.map((item) => item.practiceId));
    setTitle(props.dashboard.schedule?.title || "Мой день");
  }, [props.dashboard.schedule?.id]);

  function togglePractice(practiceId: string) {
    setSelectedIds((current) =>
      current.includes(practiceId)
        ? current.filter((item) => item !== practiceId)
        : [...current, practiceId],
    );
  }

  return (
    <section className="stack">
      <article className="panel">
        <span className="eyebrow">Планировщик</span>
        <h2>{props.dashboard.schedule?.title || "Расписание дня"}</h2>
        <div className="form-grid">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Название дня"
            className="text-input"
          />
          <button
            type="button"
            className="primary-button"
            disabled={props.busy || selectedIds.length === 0}
            onClick={() => void props.onSaveSchedule(selectedIds, title)}
          >
            {props.busy ? "Сохраняю..." : "Сохранить план"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={props.busy}
            onClick={() => void props.onRepeatYesterday()}
          >
            Повторить вчера
          </button>
        </div>
        <div className="chip-list">
          {props.dashboard.practices.map((practice) => (
            <button
              key={practice.id}
              type="button"
              className={selectedIds.includes(practice.id) ? "chip chip-active" : "chip"}
              onClick={() => togglePractice(practice.id)}
            >
              {practice.title}
            </button>
          ))}
        </div>
        <div className="row-list">
          {items.map((item) => (
            <ScheduleRow
              key={item.id}
              item={item}
              practice={props.practiceMap.get(item.practiceId)}
            />
          ))}
        </div>
      </article>
    </section>
  );
}

function ScheduleRow(props: { item: ScheduledPracticeDto; practice?: PracticeDto }) {
  return (
    <div className="row-item">
      <div>
        <strong>{props.practice?.title ?? "Практика"}</strong>
        <p>
          {props.item.plannedStartTime ?? "Без времени"} · {props.item.plannedDurationMinutes} мин
        </p>
      </div>
      <span className="tag">{props.item.status}</span>
    </div>
  );
}

function DiaryScreen(props: {
  busy: boolean;
  diary: DiaryEntryDto[];
  onCreateDiary: (input: {
    scheduledPracticeId: string;
    practiceId: string;
    text: string;
  }) => Promise<void>;
  practiceMap: Map<string, PracticeDto>;
  scheduledItems: ScheduledPracticeDto[];
}) {
  const [scheduledPracticeId, setScheduledPracticeId] = useState(
    props.scheduledItems[0]?.id ?? "",
  );
  const [text, setText] = useState("");

  useEffect(() => {
    setScheduledPracticeId(props.scheduledItems[0]?.id ?? "");
  }, [props.scheduledItems[0]?.id]);

  const selectedItem = props.scheduledItems.find((item) => item.id === scheduledPracticeId);

  async function handleSubmit() {
    if (!selectedItem || !text.trim()) return;

    await props.onCreateDiary({
      scheduledPracticeId: selectedItem.id,
      practiceId: selectedItem.practiceId,
      text: text.trim(),
    });

    setText("");
  }

  return (
    <section className="stack">
      <article className="panel">
        <span className="eyebrow">Дневник</span>
        <h2>{props.diary.length} записей</h2>
        <div className="chip-list">
          {props.scheduledItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={scheduledPracticeId === item.id ? "chip chip-active" : "chip"}
              onClick={() => setScheduledPracticeId(item.id)}
            >
              {props.practiceMap.get(item.practiceId)?.title ?? "Практика"}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Что ты заметил после практики?"
            className="text-area"
          />
          <button
            type="button"
            className="primary-button"
            disabled={props.busy || !scheduledPracticeId}
            onClick={() => void handleSubmit()}
          >
            {props.busy ? "Сохраняю..." : "Добавить запись"}
          </button>
        </div>
        <div className="row-list">
          {props.diary.map((entry) => (
            <div key={entry.id} className="row-item row-item-text">
              <div>
                <strong>{props.practiceMap.get(entry.practiceId)?.title ?? "Практика"}</strong>
                <p>{entry.text}</p>
              </div>
              <span className="tag">{entry.kind}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function StatisticsScreen(props: {
  statistics: StatisticsDto;
  practiceMap: Map<string, PracticeDto>;
}) {
  const favoriteTitle = props.statistics?.favoritePracticeIds[0]
    ? props.practiceMap.get(props.statistics.favoritePracticeIds[0])?.title ?? "Практика"
    : "Пока нет";

  return (
    <section className="stack stats-grid">
      <article className="panel">
        <span className="eyebrow">Неделя</span>
        <h2>{props.statistics?.totalHours ?? 0} ч</h2>
        <p>Завершено {props.statistics?.completedCount ?? 0} практик.</p>
      </article>
      <article className="panel">
        <span className="eyebrow">Серия</span>
        <h2>{props.statistics?.streakDays ?? 0} дней</h2>
        <p>Процент выполнения: {props.statistics?.completionPercent ?? 0}%.</p>
      </article>
      <article className="panel">
        <span className="eyebrow">Любимая</span>
        <h2>{favoriteTitle}</h2>
        <p>Чаще всего возвращаешься именно к этой практике.</p>
      </article>
    </section>
  );
}

function SettingsScreen(props: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  return (
    <section className="stack">
      <article className="panel">
        <span className="eyebrow">Настройки</span>
        <h2>Оформление</h2>
        <p>Настрой внешний вид приложения под себя.</p>
        <div className="settings-section" style={{ marginTop: 16 }}>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Тёмная тема</strong>
              <span>Переключиться между светлой и тёмной темой</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={props.theme === "dark"}
                onChange={props.onToggleTheme}
              />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 20 }}>
          <span className="eyebrow">Информация</span>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Версия</strong>
              <span>v0.1.0 · MVP Core</span>
            </div>
            <span className="tag">Mini App</span>
          </div>
        </div>
      </article>
    </section>
  );
}
