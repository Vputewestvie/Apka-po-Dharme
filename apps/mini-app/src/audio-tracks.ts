// Бесплатные треки тибетских поющих чаш.
// Источник: Amy Sikarskie, лицензия CC BY 3.0 (archive.org).
// Файлы лежат в public/audio/ и попадают в сборку как /audio/<file>.

export type SoundTrack = {
  id: string;
  /** Название для интерфейса (RU). */
  title: string;
  /** Короткая подпись (нота/чакра). */
  note: string;
  /** Имя файла внутри public/audio/. */
  file: string;
};

export const SOUND_TRACKS: SoundTrack[] = [
  { id: "root-c", title: "Корневая чакра", note: "Нота C", file: "bowl-root-c.mp3" },
  { id: "heart-f", title: "Сердечная чакра", note: "Нота F", file: "bowl-heart-f.mp3" },
  { id: "crown-b", title: "Коронная чакра", note: "Нота B", file: "bowl-crown-b.mp3" },
];

export const SOUND_ATTRIBUTION =
  "Звуки поющих чаш — Amy Sikarskie, лицензия CC BY 3.0 (archive.org).";
