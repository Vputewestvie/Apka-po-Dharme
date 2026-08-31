import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioWaveform,
  Bird,
  Bug,
  CloudLightning,
  CloudRain,
  Droplets,
  Flame,
  Moon,
  Mountain,
  Sunrise,
  TreePine,
  Trees,
  Umbrella,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { BOWLS, NATURE, SOUND_ATTRIBUTION, SOUND_TRACKS } from "../audio-tracks";

/** Тематическая иконка для каждой кнопки. */
const ICONS: Record<string, LucideIcon> = {
  sunrise: Sunrise,
  mountain: Mountain,
  waves: Waves,
  droplets: Droplets,
  "audio-waveform": AudioWaveform,
  flame: Flame,
  "cloud-rain": CloudRain,
  umbrella: Umbrella,
  "cloud-lightning": CloudLightning,
  bird: Bird,
  bug: Bug,
  moon: Moon,
  wind: Wind,
  "tree-pine": TreePine,
  trees: Trees,
};

const STORAGE_KEY = "soundbath-prefs";

/** Плавный вход/выход, чтобы включение и выключение не давали щелчок. */
const FADE_IN = 1.2;
const FADE_OUT = 0.5;

type Prefs = {
  enabled: boolean;
  volume: number;
  trackId: string;
};

function loadPrefs(): Prefs {
  const fallback: Prefs = { enabled: false, volume: 0.6, trackId: SOUND_TRACKS[0].id };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return fallback;
  }
}

/**
 * Плавающий музыкальный плеер («поющие чаши + слои природы»).
 *
 * Монтируется один раз на уровне App — доступен с любой вкладки и не глохнет
 * при переключении экранов. Один трек играет через Web Audio (AudioBufferSourceNode
 * крутит цикл по сэмплам — без щелчков на стыке), остальные не грузим, чтобы не
 * тратить память и трафик: файл подтягивается только при выборе.
 */
export function SoundBathPlayer() {
  const initial = loadPrefs();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [volume, setVolume] = useState(initial.volume);
  const [trackId, setTrackId] = useState(initial.trackId);
  const [loading, setLoading] = useState(false);

  const current = SOUND_TRACKS.find((t) => t.id === trackId) ?? SOUND_TRACKS[0];
  const url = `${import.meta.env.BASE_URL}audio/${current.file}`;

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<{ id: string; buffer: AudioBuffer } | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = volumeRef.current;
    gain.connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, volume, trackId }));
  }, [enabled, volume, trackId]);

  useEffect(() => {
    const gain = gainRef.current;
    if (!gain) return;
    const now = ctxRef.current?.currentTime ?? 0;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(volume, now, 0.05);
  }, [volume]);

  // Автовоспроизведение заблокировано до первого жеста. Если музыка была
  // включена в прошлой сессии, дожимаем контекст по первому касанию.
  useEffect(() => {
    if (!enabled) return;
    const resume = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    document.addEventListener("pointerdown", resume, { passive: true });
    return () => document.removeEventListener("pointerdown", resume);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const ctx = ensureContext();
    if (!ctx) return;

    let source: AudioBufferSourceNode | null = null;
    let cancelled = false;

    void (async () => {
      try {
        if (ctx.state === "suspended") await ctx.resume();

        let buffer = bufferRef.current?.id === current.id ? bufferRef.current.buffer : null;
        if (!buffer) {
          setLoading(true);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`audio ${res.status}`);
          buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          if (cancelled) return;
          bufferRef.current = { id: current.id, buffer };
        }
        if (cancelled) return;

        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        source.connect(gainRef.current!);

        const gain = gainRef.current!;
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(volumeRef.current, now + FADE_IN);
        source.start(0);
      } catch {
        // Сеть или декодер — просто не играем, интерфейс остаётся рабочим.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      const src = source;
      const gain = gainRef.current;
      if (src && gain) {
        const now = ctx.currentTime;
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
          gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
          src.stop(now + FADE_OUT);
        } catch {
          // Источник мог ещё не стартовать — тогда останавливать нечего.
        }
      }
      if (src) {
        src.onended = () => src.disconnect();
        source = null;
      }
    };
  }, [enabled, current.id, url, ensureContext]);

  useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
      gainRef.current = null;
      bufferRef.current = null;
    },
    [],
  );

  const selectTrack = (id: string) => {
    setTrackId(id);
    if (!enabled) setEnabled(true);
  };

  const renderTile = (t: (typeof SOUND_TRACKS)[number]) => {
    const Icon = ICONS[t.icon] ?? Waves;
    const active = enabled && trackId === t.id;
    return (
      <button
        key={t.id}
        type="button"
        className={`soundbath-btn${active ? " is-on" : ""}`}
        onClick={() => selectTrack(t.id)}
        title={t.title}
        aria-label={t.title}
        aria-pressed={active}
      >
        <Icon size={22} strokeWidth={1.9} />
        {active && <span className="soundbath-dot" />}
      </button>
    );
  };

  return (
    <div className="soundbath-fab">
      {open ? (
        <div className="soundbath-panel">
          <div className="soundbath-head">
            <button
              type="button"
              className={`soundbath-toggle${enabled ? " is-on" : ""}`}
              onClick={() => setEnabled((v) => !v)}
              aria-pressed={enabled}
              aria-label={enabled ? "Выключить звук" : "Включить звук"}
              title={enabled ? "Выключить" : "Включить"}
            >
              <BowlGlyph active={enabled} />
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

          <div className="soundbath-section">
            <div className="soundbath-label">Чаши и медитация</div>
            <div className="soundbath-grid">{BOWLS.map(renderTile)}</div>
          </div>

          <div className="soundbath-section">
            <div className="soundbath-label">Звуки природы</div>
            <div className="soundbath-grid soundbath-grid--nature">{NATURE.map(renderTile)}</div>
          </div>

          {loading && enabled ? <p className="soundbath-loading">загрузка…</p> : null}

          <p className="soundbath-attrib">{SOUND_ATTRIBUTION}</p>
        </div>
      ) : null}

      <button
        type="button"
        className={`soundbath-fab-btn${enabled ? " is-on" : ""}`}
        aria-expanded={open}
        aria-label="Музыка: поющие чаши и природа"
        title="Музыка: поющие чаши и природа"
        onClick={() => setOpen((v) => !v)}
      >
        <BowlGlyph active={enabled} />
      </button>
    </div>
  );
}

/** Стилизованная поющая чаша — «красивое тематическое изображение» для кнопок. */
function BowlGlyph({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5c0-3 3.6-5.5 8-5.5s8 2.5 8 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M3.5 11.5c0 2.2 3.8 4 8.5 4s8.5-1.8 8.5-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <line x1="12" y1="6" x2="12" y2="3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="2.8" r="1.2" fill="currentColor" />
      {active ? (
        <g className="bowl-waves">
          <path d="M8 16.5c1 0 1 1 2 1s1-1 2-1 1 1 2 1 1-1 2-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        </g>
      ) : null}
    </svg>
  );
}
