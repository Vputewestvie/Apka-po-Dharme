import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Moon,
  NotebookPen,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addTimerTime,
  analyzeDiary,
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
  { id: "diary", label: "Дневник", icon: NotebookPen },
  { id: "statistics", label: "Статистика", icon: BarChart3 },
] as const satisfies { id: MiniAppScreen; label: string; icon: typeof Clock3 }[];

/** Русское склонение по числу: 1 практика, 2 практики, 5 практик. */
function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

type ScreenActions = {
  busy: string | null;
  onCompletePractice: (item: ScheduledPracticeDto) => Promise<void>;
  onAnalyzeDiary: (question: string) => Promise<string>;
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
};

export function App() {
  const [screen, setScreen] = useState<MiniAppScreen>(() => {
    // Кнопки бота открывают конкретный экран: ?screen=schedule и т.п.
    // Неизвестное значение тихо игнорируется — остаётся «today».
    const requested = new URLSearchParams(window.location.search).get("screen");
    const valid = ["today", "library", "diary", "statistics"];
    // Раздел «План» объединён с «Практиками», а «Настройки» удалены — тема
    // переехала в шапку. Старые ссылки бота не должны ломаться.
    const mapped =
      requested === "schedule"
        ? "library"
        : requested === "settings"
          ? "today"
          : (requested as MiniAppScreen);
    return valid.includes(mapped) ? mapped : "today";
  });
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

  async function handleAnalyzeDiary(question: string) {
    if (!dashboard) return "";

    let analysis = "";
    await runBusy("diary-ai", async () => {
      const result = await analyzeDiary({
        userId: dashboard.userId,
        question,
      });
      analysis = result.analysis;
    });
    return analysis;
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
  const planTotal = scheduledItems.length || dashboard?.practices.length || 0;
  const activeTimerBusy = activeTimer ? timerBusy?.includes(activeTimer.item.id) ?? false : false;

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-top">
          <div className="hero-copy">
            <span className="eyebrow">Telegram Mini App</span>
            <h1>Дневник духовной практики</h1>
            <p>Ежедневный ритм, практика и тихая ясность в одном месте.</p>
          </div>
          {/* Тема — глобальная настройка, поэтому живёт в шапке и доступна
              с любого экрана: отдельный раздел «Настройки» ради одной
              кнопки не имел смысла. */}
          <button
            type="button"
            className="ghost-button hero-theme"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="hero-meta">
          <div className="metric">
            <span>Сегодня</span>
            <strong>
              {planTotal} {pluralRu(planTotal, "практика", "практики", "практик")}
            </strong>
          </div>
          <div className="metric">
            <span>Готово</span>
            <strong>
              {completedCount} из {planTotal}
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
            onAnalyzeDiary: handleAnalyzeDiary,
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
        <PracticesScreen
          busy={actions.busy}
          dashboard={dashboard}
          practiceMap={practiceMap}
          onCreatePractice={actions.onCreatePractice}
          onDeletePractice={actions.onDeletePractice}
          onRepeatYesterday={actions.onRepeatYesterday}
          onSaveSchedule={actions.onSaveSchedule}
        />
      );
    case "diary":
      return (
        <DiaryScreen
          busy={actions.busy === "diary"}
          diary={dashboard.diary}
          aiBusy={actions.busy === "diary-ai"}
          onAnalyzeDiary={actions.onAnalyzeDiary}
          onCreateDiary={actions.onCreateDiary}
          practiceMap={practiceMap}
          scheduledItems={dashboard.schedule?.items ?? []}
        />
      );
    case "statistics":
      return <StatisticsScreen statistics={dashboard.statistics} practiceMap={practiceMap} />;
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
                <img
                  src={practice.image.ref}
                  alt={practice.title}
                  className="practice-image"
                  onError={(event) => {
                    // Битые/устаревшие ссылки на картинки не должны ломать карточку.
                    event.currentTarget.src = "/images/categories/meditation.webp";
                  }}
                />
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

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  completed: "Выполнено",
  skipped: "Пропущено",
};

function statusTagClass(status: string): string {
  if (status === "completed") return "tag tag-done";
  if (status === "skipped") return "tag tag-skipped";
  return "tag";
}

/**
 * Единый раздел «Практики»: план на сегодня + библиотека практик.
 *
 * Раньше это были две отдельные вкладки («Практики» и «План»), причём
 * планировщик дублировал библиотеку собственным списком чипов. Теперь
 * библиотека сама является пультом плана: переключатель на строке практики
 * сразу добавляет её в расписание дня или убирает оттуда, а верхняя панель
 * показывает итоговый порядок и статусы.
 */
function PracticesScreen(props: {
  dashboard: DashboardData;
  practiceMap: Map<string, PracticeDto>;
  busy: string | null;
  onCreatePractice: (input: {
    title: string;
    category: string;
    defaultDurationMinutes: number;
  }) => Promise<void>;
  onDeletePractice: (practiceId: string) => Promise<void>;
  onRepeatYesterday: () => Promise<void>;
  onSaveSchedule: (practiceIds: string[], title: string) => Promise<void>;
}) {
  const items = useMemo(
    () => [...(props.dashboard.schedule?.items ?? [])].sort((a, b) => a.order - b.order),
    [props.dashboard.schedule?.items],
  );
  const plannedIds = useMemo(() => items.map((item) => item.practiceId), [items]);
  const completedCount = items.filter((item) => item.status === "completed").length;

  const [title, setTitle] = useState(props.dashboard.schedule?.title || "Мой день");
  const [titleDirty, setTitleDirty] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [category, setCategory] = useState("Тело");
  const [duration, setDuration] = useState("20");

  // Название дня подтягивается из расписания, пока пользователь его не правил.
  useEffect(() => {
    if (!titleDirty) {
      setTitle(props.dashboard.schedule?.title || "Мой день");
    }
  }, [props.dashboard.schedule?.id, props.dashboard.schedule?.title, titleDirty]);

  function toggleInPlan(practiceId: string) {
    const next = plannedIds.includes(practiceId)
      ? plannedIds.filter((id) => id !== practiceId)
      : [...plannedIds, practiceId];

    setTogglingId(practiceId);
    void props.onSaveSchedule(next, title).finally(() => setTogglingId(null));
  }

  function saveTitle() {
    const trimmed = title.trim() || "Мой день";
    setTitle(trimmed);
    setTitleDirty(false);

    // Без расписания переименовывать нечего: название применится,
    // когда в план добавят первую практику.
    if (!props.dashboard.schedule) return;
    if (trimmed === props.dashboard.schedule.title) return;

    void props.onSaveSchedule(plannedIds, trimmed);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;

    await props.onCreatePractice({
      title: newTitle.trim(),
      category,
      defaultDurationMinutes: Number(duration) || 20,
    });

    setNewTitle("");
    setCategory("Тело");
    setDuration("20");
  }

  const createBusy = props.busy === "practice";
  const repeatBusy = props.busy === "repeat";
  const scheduleBusy = props.busy === "schedule";

  return (
    <section className="stack">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">План на сегодня</span>
            <h2>
              {items.length} {pluralRu(items.length, "практика", "практики", "практик")} в плане
            </h2>
          </div>
          <span className="tag">
            {completedCount} из {items.length} выполнено
          </span>
        </div>

        <div className="form-grid">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleDirty(true);
            }}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder="Название дня"
            aria-label="Название дня"
            className="text-input"
          />
          <button
            type="button"
            className="secondary-button"
            disabled={repeatBusy}
            onClick={() => void props.onRepeatYesterday()}
          >
            {repeatBusy ? "Повторяю..." : "Повторить вчера"}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="plan-empty">
            План пока пуст. Отметь практики в библиотеке ниже — они сразу попадут в расписание дня.
          </p>
        ) : (
          <div className="row-list">
            {items.map((item, index) => (
              <div key={item.id} className="row-item">
                <div className="plan-item-main">
                  <span className="plan-order">{index + 1}</span>
                  <div>
                    <strong>{props.practiceMap.get(item.practiceId)?.title ?? "Практика"}</strong>
                    <p>
                      {item.plannedStartTime ?? "Без времени"} · {item.plannedDurationMinutes} мин
                    </p>
                  </div>
                </div>
                <span className={statusTagClass(item.status)}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Библиотека</span>
            <h2>
              {props.dashboard.practices.length}{" "}
              {pluralRu(props.dashboard.practices.length, "практика", "практики", "практик")}
            </h2>
          </div>
        </div>

        <div className="form-grid">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
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
            disabled={createBusy || !newTitle.trim()}
            onClick={() => void handleCreate()}
          >
            {createBusy ? "Сохраняю..." : "Добавить"}
          </button>
        </div>

        <div className="row-list">
          {props.dashboard.practices.map((practice) => {
            const inPlan = plannedIds.includes(practice.id);
            const toggling = togglingId === practice.id;

            return (
              <div key={practice.id} className="row-item">
                <div>
                  <strong>{practice.title}</strong>
                  <p>
                    {practice.category} · {practice.defaultDurationMinutes} мин
                  </p>
                </div>
                <div className="row-item-actions">
                  {practice.archived ? <span className="tag">Архив</span> : null}
                  <button
                    type="button"
                    className={inPlan ? "chip chip-active" : "chip"}
                    disabled={toggling || scheduleBusy}
                    aria-pressed={inPlan}
                    title={inPlan ? "Убрать из плана на сегодня" : "Добавить в план на сегодня"}
                    onClick={() => toggleInPlan(practice.id)}
                  >
                    {toggling ? "Сохраняю..." : inPlan ? "В плане" : "В план"}
                  </button>
                  <button
                    type="button"
                    className="icon-danger-button"
                    disabled={props.busy === `delete:${practice.id}`}
                    aria-label={`Удалить практику ${practice.title}`}
                    title="Удалить практику"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить практику «${practice.title}»? Действие необратимо.`,
                        )
                      ) {
                        void props.onDeletePractice(practice.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function DiaryScreen(props: {
  busy: boolean;
  diary: DiaryEntryDto[];
  aiBusy: boolean;
  onAnalyzeDiary: (question: string) => Promise<string>;
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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

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

  async function handleAnalyze() {
    const answer = await props.onAnalyzeDiary(aiQuestion);
    if (answer) setAiAnswer(answer);
  }

  function entryTitle(entry: DiaryEntryDto): string {
    return (
      (entry.practiceId ? props.practiceMap.get(entry.practiceId)?.title : undefined) ??
      entry.practiceTitle ??
      "Практика"
    );
  }

  return (
    <section className="stack">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Дневник</span>
            <h2>{props.diary.length} записей</h2>
          </div>
          <button
            type="button"
            className={aiOpen ? "ghost-button active" : "ghost-button"}
            aria-expanded={aiOpen}
            aria-label="Анализ дневника с помощью AI"
            title="AI-анализ дневника"
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles size={16} />
          </button>
        </div>
        {aiOpen ? (
          <div className="ai-composer">
            <textarea
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
              placeholder="Необязательный вопрос, например: «Почему мне сложно медитировать по утрам?»"
              rows={2}
            />
            <button
              type="button"
              className="primary-button"
              disabled={props.aiBusy || props.diary.length === 0}
              onClick={() => void handleAnalyze()}
            >
              {props.aiBusy ? "Анализирую..." : "Проанализировать дневник"}
            </button>
            {props.diary.length === 0 ? (
              <p className="ai-hint">Сначала добавь записи в дневник — анализировать пока нечего.</p>
            ) : null}
            {aiAnswer ? <div className="ai-answer">{aiAnswer}</div> : null}
          </div>
        ) : null}
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
                <strong>{entryTitle(entry)}</strong>
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
