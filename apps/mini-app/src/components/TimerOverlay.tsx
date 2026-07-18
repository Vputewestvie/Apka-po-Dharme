import { Clock3, Pause, Play, Plus, SkipForward, Square, X } from "lucide-react";
import type { PracticeDto } from "../types";

type TimerOverlayProps = {
  practice: PracticeDto;
  scheduledPracticeId: string;
  remainingSeconds: number;
  status: "running" | "paused";
  busy?: boolean;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onAddTime: (minutes: number) => void;
  onComplete: () => void;
  onSkip: () => void;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function TimerOverlay(props: TimerOverlayProps) {
  const totalSeconds = props.practice.defaultDurationMinutes * 60;
  const progress = Math.max(0, Math.min(1, props.remainingSeconds / totalSeconds));

  return (
    <div className="timer-overlay" role="dialog" aria-modal="true">
      <div className="timer-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="eyebrow" style={{ margin: 0 }}>
            <Clock3 size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            Таймер практики
          </span>
          <button
            type="button"
            className="timer-close"
            onClick={props.onClose}
            aria-label="Закрыть таймер"
            disabled={props.busy}
          >
            <X size={18} />
          </button>
        </div>

        <h2>{props.practice.title}</h2>
        <p>{props.practice.category}</p>

        <div className="timer-meter">
          <div className="timer-progress" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="timer-value">
          <span>{formatTime(props.remainingSeconds)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {props.status === "running" ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                В работе
              </>
            ) : (
              <>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)", display: "inline-block" }} />
                Пауза
              </>
            )}
          </span>
        </div>

        <div className="timer-actions">
          {props.status === "running" ? (
            <button type="button" className="secondary-button" onClick={props.onPause} disabled={props.busy}>
              <Pause size={16} />
              Пауза
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={props.onResume} disabled={props.busy}>
              <Play size={16} />
              Продолжить
            </button>
          )}
          <button type="button" className="secondary-button" onClick={() => props.onAddTime(5)} disabled={props.busy}>
            <Plus size={16} />
            +5 мин
          </button>
        </div>

        <div className="timer-actions timer-actions-full">
          <button type="button" className="primary-button" onClick={props.onComplete} disabled={props.busy}>
            <Square size={16} />
            Завершить
          </button>
          <button type="button" className="secondary-button" onClick={props.onSkip} disabled={props.busy}>
            <SkipForward size={16} />
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}