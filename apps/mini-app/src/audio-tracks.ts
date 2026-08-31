// Длинные треки для фоновой медитации и слоёв природы.
//
// Источники:
//   • Тибетские поющие чаши — LEONARDO GONZALEZ, leo, Sean Fitzpatrick.
//     Общественное достояние (Public Domain Mark 1.0, archive.org).
//   • Звуки природы — Mixkit (Mixkit Free License, без отчислений и без
//     обязательного указания автора) и aporee (Public Domain Mark 1.0).
//
// Все файлы лежат в public/audio/ и попадают в сборку как /audio/<file>.
//
// Нарезка: каждый трек вырезан из длинной записи и склеен «в кольцо» —
// последние секунды наплывают на начало, поэтому при зацикливании стыка не
// слышно и трек звучит как непрерывный гул. Длительности — 1:40–4:30.

/** Тематическая иконка кнопки (имя из lucide-react). */
export type SoundIcon =
  | "sunrise"
  | "mountain"
  | "waves"
  | "droplets"
  | "audio-waveform"
  | "flame"
  | "cloud-rain"
  | "umbrella"
  | "cloud-lightning"
  | "bird"
  | "bug"
  | "moon"
  | "wind"
  | "tree-pine"
  | "trees";

export type TrackGroup = "bowls" | "nature";

export type SoundTrack = {
  id: string;
  /** Название для интерфейса (RU). */
  title: string;
  /** Короткая подпись — длительность, чтобы было проще выбрать. */
  note: string;
  /** Имя файла внутри public/audio/. */
  file: string;
  /** Тематическая иконка. */
  icon: SoundIcon;
  /** Какой блок в плеере. */
  group: TrackGroup;
};

export const SOUND_TRACKS: SoundTrack[] = [
  // --- Чаши и медитативная музыка ---
  { id: "bowls-morning", title: "Утренние чаши", note: "2:30", file: "bowls-morning.mp3", icon: "sunrise", group: "bowls" },
  { id: "bowls-nepal", title: "Гималайский гул", note: "3:00", file: "bowls-nepal.mp3", icon: "mountain", group: "bowls" },
  { id: "bowls-deep", title: "Глубокое погружение", note: "3:30", file: "bowls-deep.mp3", icon: "waves", group: "bowls" },
  { id: "bowls-bath", title: "Звуковая ванна", note: "4:00", file: "bowls-bath.mp3", icon: "droplets", group: "bowls" },
  { id: "bowls-flow", title: "Поток звучания", note: "4:30", file: "bowls-flow.mp3", icon: "audio-waveform", group: "bowls" },

  // --- Звуки природы ---
  { id: "nature-fire", title: "Костёр", note: "3:00", file: "nature-fire.mp3", icon: "flame", group: "nature" },
  { id: "nature-rain", title: "Дождь", note: "3:00", file: "nature-rain.mp3", icon: "cloud-rain", group: "nature" },
  { id: "nature-roof", title: "Дождь по крыше", note: "2:24", file: "nature-roof.mp3", icon: "umbrella", group: "nature" },
  { id: "nature-thunder", title: "Гроза", note: "2:45", file: "nature-thunder.mp3", icon: "cloud-lightning", group: "nature" },
  { id: "nature-sea", title: "Морской прибой", note: "2:20", file: "nature-sea.mp3", icon: "waves", group: "nature" },
  { id: "nature-stormsea", title: "Штормовое море", note: "2:05", file: "nature-stormsea.mp3", icon: "waves", group: "nature" },
  { id: "nature-waterfall", title: "Водопад", note: "2:09", file: "nature-waterfall.mp3", icon: "waves", group: "nature" },
  { id: "nature-stream", title: "Лесной ручей", note: "2:50", file: "nature-stream.mp3", icon: "droplets", group: "nature" },
  { id: "nature-river", title: "Река в лесу", note: "1:55", file: "nature-river.mp3", icon: "trees", group: "nature" },
  { id: "nature-birds", title: "Птицы в лесу", note: "2:20", file: "nature-birds.mp3", icon: "bird", group: "nature" },
  { id: "nature-crickets", title: "Кузнечики", note: "2:20", file: "nature-crickets.mp3", icon: "bug", group: "nature" },
  { id: "nature-night", title: "Ночной лес", note: "1:58", file: "nature-night.mp3", icon: "moon", group: "nature" },
  { id: "nature-pond", title: "Пруд с лягушками", note: "1:46", file: "nature-pond.mp3", icon: "droplets", group: "nature" },
  { id: "nature-wind", title: "Ветер", note: "1:40", file: "nature-wind.mp3", icon: "wind", group: "nature" },
  { id: "nature-forest", title: "Тихий лес", note: "2:20", file: "nature-forest.mp3", icon: "tree-pine", group: "nature" },
];

export const BOWLS = SOUND_TRACKS.filter((t) => t.group === "bowls");
export const NATURE = SOUND_TRACKS.filter((t) => t.group === "nature");

export const SOUND_ATTRIBUTION =
  "Тибетские чаши — LEONARDO GONZALEZ, leo, Sean Fitzpatrick (общественное достояние, archive.org). " +
  "Звуки природы — Mixkit (Mixkit Free License) и aporee (общественное достояние).";
