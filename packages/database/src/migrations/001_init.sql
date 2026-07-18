CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  ai_enabled INTEGER NOT NULL,
  ai_provider TEXT,
  notification_enabled INTEGER NOT NULL,
  morning_notification_time TEXT,
  day_notification_time TEXT,
  evening_notification_time TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_kind TEXT NOT NULL,
  image_ref TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  default_duration_minutes INTEGER NOT NULL,
  personal_notes TEXT NOT NULL,
  is_archived INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_materials (
  id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS scheduled_practices (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  planned_start_time TEXT,
  planned_duration_minutes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  moved_from_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  scheduled_practice_id TEXT NOT NULL REFERENCES scheduled_practices(id) ON DELETE CASCADE,
  started_at TEXT,
  paused_at TEXT,
  finished_at TEXT,
  planned_duration_minutes INTEGER NOT NULL,
  actual_duration_seconds INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_events (
  id TEXT PRIMARY KEY,
  timer_session_id TEXT NOT NULL REFERENCES timer_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_completions (
  id TEXT PRIMARY KEY,
  scheduled_practice_id TEXT NOT NULL UNIQUE REFERENCES scheduled_practices(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  actual_duration_seconds INTEGER NOT NULL,
  skip_reason TEXT,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  scheduled_practice_id TEXT NOT NULL REFERENCES scheduled_practices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  voice_file_id TEXT,
  transcription TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_changes (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  command_text TEXT,
  command_voice_file_id TEXT,
  ai_result_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statistics_snapshots (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_minutes INTEGER NOT NULL,
  completed_count INTEGER NOT NULL,
  skipped_count INTEGER NOT NULL,
  moved_count INTEGER NOT NULL,
  streak_days INTEGER NOT NULL,
  favorite_practice_ids_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Seed a demo user for local development (idempotent)
INSERT OR IGNORE INTO users (id, telegram_id, timezone, created_at, updated_at)
VALUES ('demo-user', 0, 'UTC', datetime('now'), datetime('now'));
