// Длинные треки тибетских поющих чаш (3–4 минуты).
//
// Источник: «Tibetan Sounds Bowls Sonidos Relajantes», LEONARDO GONZALEZ,
// лицензия Public Domain Mark 1.0 (archive.org) — можно встраивать в приложение
// без ограничений и без отчислений.
//
// Файлы лежат в public/audio/ и попадают в сборку как /audio/<file>.
//
// Важно про нарезку: треки вырезаны из одной 110-минутной записи и склеены
// «в кольцо» — последние секунды наплывают на начало, поэтому при зацикливании
// стыка не слышно и трек звучит как непрерывный гул.

export type SoundTrack = {
  id: string;
  /** Название для интерфейса (RU). */
  title: string;
  /** Короткая подпись — здесь длительность, чтобы было проще выбрать. */
  note: string;
  /** Имя файла внутри public/audio/. */
  file: string;
};

export const SOUND_TRACKS: SoundTrack[] = [
  { id: "bowls-deep", title: "Глубокое погружение", note: "3:30 · низкий гул", file: "bowls-deep.mp3" },
  { id: "bowls-flow", title: "Поток звучания", note: "4:00 · полный спектр", file: "bowls-flow.mp3" },
  { id: "bowls-still", title: "Тишина ума", note: "3:20 · ровное звучание", file: "bowls-still.mp3" },
];

export const SOUND_ATTRIBUTION =
  "Тибетские поющие чаши — LEONARDO GONZALEZ, общественное достояние (archive.org).";
