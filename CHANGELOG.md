# Changelog

## [0.1.0] - 2026-07-18

### Added
- Telegram Mini App на Vite + React с нижней навигацией
- Backend API на Node.js + TypeScript с SQLite
- Telegram Bot с командами и запуском Mini App
- Domain Layer: Practice, Schedule, PracticeSession, DiaryEntry, Statistics, MaterialLink
- Библиотека практик с категориями и материалами
- Планировщик расписания: ручной, текст, голос, повтор вчера
- Таймер практик с паузой/продолжением/автозавершением
- Дневник: текстовые и голосовые записи
- Статистика: день/неделя/месяц/год, серии, любимые практики
- AI интеграция через Google AI Studio и OpenRouter с fallback
- Уведомления: утро/день/вечер/следующая практика/таймер
- Дизайн: светлая/тёмная тема, анимации, Inter, адаптация под мобильные
- Безопасность: Telegram init data валидация, x-user-id для разработки
- Валидация API через Zod
- Dockerfile и docker-compose.yml для production
- Тесты: vitest, unit-тесты domain, интеграционные тесты API
- CI: GitHub Actions с typecheck, test, build

### Changed
- Все маршруты API защищены Zod-схемами
- Уведомления имеют retry/backoff и идемпотентность

### Fixed
- FOREIGN KEY constraint в тестах через seed demo-user