import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ListMusic, Music, Power, Volume2, VolumeX } from "lucide-react";
import { SOUND_ATTRIBUTION, SOUND_TRACKS } from "../audio-tracks";

const STORAGE_KEY = "soundbath-prefs";

/** Плавный вход/выход, чтобы включение и выключение не давали щелчок. */
const FADE_IN = 1.2;
const FADE_OUT = 0.5;

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

/**
 * Плавающий музыкальный плеер («звук поющих чаш»).
 *
 * Монтируется один раз на уровне App — доступен с любой вкладки и не глохнет
 * при переключении экранов. Изначально плеер жил только внутри оверлея таймера,
 * и найти музыку в приложении было невозможно.
 *
 * Воспроизведение идёт через Web Audio, а не через <audio loop>. Причина:
 * mp3-кодер вносит служебную задержку (~26 мс), и обычный <audio loop> на стыке
 * «конец -> начало» даёт щелчок или короткую паузу. AudioBufferSourceNode
 * крутит цикл по сэмплам — стык получается абсолютно незаметным, и длинный
 * трек звучит как непрерывный гул.
 */
export function SoundBathPlayer() {
  const initial = loadPrefs();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [volume, setVolume] = useState(initial.volume);
  const [trackIndex, setTrackIndex] = useState(initial.trackIndex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const track = SOUND_TRACKS[trackIndex] ?? SOUND_TRACKS[0];
  const url = `${import.meta.env.BASE_URL}audio/${track.file}`;

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  /** Декодированный трек: держим один, чтобы не занимать лишнюю память. */
  const bufferRef = useRef<{ id: string; buffer: AudioBuffer } | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = volumeRef.current;
    gain.connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  }, []);

  // Сохраняем настройки между сессиями.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, volume, trackIndex }));
  }, [enabled, volume, trackIndex]);

  // Громкость: меняем плавно, иначе слышны ступеньки ползунка.
  useEffect(() => {
    const gain = gainRef.current;
    if (!gain) return;
    const now = ctxRef.current?.currentTime ?? 0;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(volume, now, 0.05);
  }, [volume]);

  // Автовоспроизведение блокируется до первого жеста пользователя. Если
  // музыка была включена в прошлой сессии, дожимаем контекст по первому касанию.
  useEffect(() => {
    if (!enabled) return;
    const resume = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    document.addEventListener("pointerdown", resume, { passive: true });
    return () => document.removeEventListener("pointerdown", resume);
  }, [enabled]);

  // Основной цикл: загрузить -> декодировать -> играть по кругу.
  useEffect(() => {
    if (!enabled) return;
    const ctx = ensureContext();
    if (!ctx) return;

    let source: AudioBufferSourceNode | null = null;
    let cancelled = false;

    void (async () => {
      try {
        if (ctx.state === "suspended") await ctx.resume();

        let buffer = bufferRef.current?.id === track.id ? bufferRef.current.buffer : null;
        if (!buffer) {
          setLoading(true);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`audio ${res.status}`);
          buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          if (cancelled) return;
          bufferRef.current = { id: track.id, buffer };
        }
        if (cancelled) return;

        source = ctx.createBufferSource();
        source.buffer = buffer;
        // Цикл по сэмплам: конец буфера -> его начало, без зазора.
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
          // Источник мог ещё не стартовать — тогда и останавливать нечего.
        }
      }
      if (src) {
        src.onended = () => src.disconnect();
        source = null;
      }
    };
  }, [enabled, track.id, url, ensureContext]);

  // Полностью освобождаем аудиоконтекст при размонтировании.
  useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
      gainRef.current = null;
      bufferRef.current = null;
    },
    [],
  );

  const selectTrack = (i: number) => {
    setTrackIndex(i);
    setPickerOpen(false);
    if (!enabled) setEnabled(true);
  };

  return (
    <div className="soundbath-fab">
      {open ? (
        <div className="soundbath-panel">
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
              <span className="soundbath-track-name">
                {track.title}
                {loading && enabled ? " · загрузка" : ""}
              </span>
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
        </div>
      ) : null}

      <button
        type="button"
        className={`soundbath-fab-btn${enabled ? " is-on" : ""}`}
        aria-expanded={open}
        aria-label="Музыка: поющие чаши"
        title="Музыка: поющие чаши"
        onClick={() => setOpen((v) => !v)}
      >
        <Music size={20} />
      </button>
    </div>
  );
}
