-- Записи дневника — важные данные: удаление практики больше не удаляет
-- её записи в дневнике. SQLite не умеет менять внешние ключи на месте,
-- поэтому таблица пересоздаётся; названия практик снимком сохраняются.
CREATE TABLE journal_entries_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_id TEXT REFERENCES practices(id) ON DELETE SET NULL,
  scheduled_practice_id TEXT REFERENCES scheduled_practices(id) ON DELETE SET NULL,
  practice_title TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  voice_file_id TEXT,
  transcription TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO journal_entries_new (
  id, user_id, practice_id, scheduled_practice_id, practice_title,
  kind, text, voice_file_id, transcription, created_at, updated_at
)
SELECT
  j.id, j.user_id, j.practice_id, j.scheduled_practice_id,
  COALESCE(p.title, ''),
  j.kind, j.text, j.voice_file_id, j.transcription, j.created_at, j.updated_at
FROM journal_entries j
LEFT JOIN practices p ON p.id = j.practice_id;

DROP TABLE journal_entries;
ALTER TABLE journal_entries_new RENAME TO journal_entries;
