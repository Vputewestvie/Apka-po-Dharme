import { useEffect, useRef, useState } from "react";
import { Check, ListMusic, Music, Power, Volume2, VolumeX } from "lucide-react";
import { SOUND_ATTRIBUTION, SOUND_TRACKS } from "../audio-tracks";

const STORAGE_KEY = "soundbath-prefs";

type Prefs = {
  enabled: boolean;
  volume: number;
  trackIndex: number;
};

function loadPrefs(): Prefs {
  const fallback: Prefs = { enabled: false, volume: 0.6, trackIndex: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return fallback;
  }
}

export function SoundBathPlayer() {
  const initial = loadPrefs();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [volume, setVolume] = useState(initial.volume);
  const [trackIndex, setTrackIndex] = useState(initial.trackIndex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = SOUND_TRACKS[trackIndex] ?? SOUND_TRACKS[0];
  const src = `${import.meta.env.BASE_URL}audio/${track.file}`;

  // Сохраняем настройки между сессиями.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, volume, trackIndex }));
  }, [enabled, volume, trackIndex]);

  // Воспроизведение/пауза и громкость привязаны к состоянию.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    if (enabled) {
      // Автоплей может быть заблокирован браузером до жеста пользователя —
      // включение музыки само по себе является жестом, так что обычно срабатывает.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [enabled, volume, trackIndex, src]);

  const selectTrack = (i: number) => {
    setTrackIndex(i);
    setPickerOpen(false);
    if (!enabled) setEnabled(true);
  };

  return (
    <div className="soundbath">
      <div className="soundbath-row">
        <button
          type="button"
          className={`soundbath-toggle${enabled ? " is-on" : ""}`}
          onClick={() => setEnabled((v) => !v)}
          aria-pressed={enabled}
          aria-label={enabled ? "Выключить музыку" : "Включить музыку"}
        >
          <Power size={16} />
        </button>

        <button
          type="button"
          className="soundbath-track-btn"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
        >
          <Music size={16} />
          <span className="soundbath-track-name">{track.title}</span>
          <ListMusic size={14} style={{ opacity: 0.55 }} />
        </button>

        <div className="soundbath-vol" title="Громкость">
          {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Громкость музыки"
          />
        </div>
      </div>

      {pickerOpen && (
        <div className="soundbath-picker">
          {SOUND_TRACKS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`soundbath-option${i === trackIndex ? " is-active" : ""}`}
              onClick={() => selectTrack(i)}
            >
              <span className="soundbath-option-title">{t.title}</span>
              <span className="soundbath-note">{t.note}</span>
              {i === trackIndex && <Check size={14} />}
            </button>
          ))}
          <p className="soundbath-attrib">{SOUND_ATTRIBUTION}</p>
        </div>
      )}

      <audio ref={audioRef} src={src} loop preload="auto" />
    </div>
  );
}
