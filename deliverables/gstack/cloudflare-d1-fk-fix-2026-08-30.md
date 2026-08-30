# Миграция на Cloudflare Workers: исправлен баг с внешними ключами D1

**Дата:** 2026-08-30
**Статус:** код готов к деплою, публикация НЕ выполнялась (ждёт одобрения)

## Что было не так

Проект мигрировался на Cloudflare Workers + D1 (SQLite в облаке). При локальном
запуске (sql.js) всё работало, но на D1 любой запрос на создание практики/
расписания/дневника падал с **FK-нарушением (500)**.

**Причина:** таблица `users` никогда не заполнялась в коде. Локальный sql.js по
умолчанию НЕ включает `PRAGMA foreign_keys`, поэтому отсутствие строки
пользователя игнорировалось. D1 же проверяет внешние ключи всегда → INSERT
в дочерние таблицы с несуществующим `user_id` отклонялся.

## Что исправлено

| Файл | Изменение |
|------|-----------|
| `packages/database/src/sqlite/repositories.ts` | Реализованы `SqliteUserRepository` и `SqliteSettingsRepository` (интерфейсы уже были, реализации не было). Работают и на sql.js, и на D1. |
| `apps/api/src/modules/auth/index.ts` | `authenticateRequest` извлекает профиль Telegram (`extractTelegramUser`) и возвращает `telegramUser` для пути init data. |
| `apps/api/src/types.ts` | Добавлен тип `TelegramUser` и поле `telegramUser` в `RequestContext`. |
| `apps/api/src/modules/users/service.ts` | NEW: `UserService.ensureUser()` — при первом входе делает upsert пользователя + дефолтных `user_settings`, при повторном — обновляет профиль. |
| `apps/api/src/container.ts` | Подключены `userRepository`, `settingsRepository`, `userService`. |
| `apps/api/src/server.ts` | `handleRequest` вызывает `ensureUser` ДО обработчика, если есть `telegramUser` (общий путь для Node и Workers). |
| `apps/api/src/http.ts`, `apps/api/src/worker.ts` | Пробрасывают `auth.telegramUser` в контекст запроса. |
| `packages/database/src/sqlite/repositories.ts` (`practiceFromRow`) | Нормализация `is_archived` (0/1 → boolean) для типобезопасных чтений на D1. |

## Проверка

- `npm run typecheck` — без ошибок.
- Тесты API (vitest) — **27/27**. Существующие тесты не задеты: в них
  `userId:"alice"` передаётся без `telegramUser`, поэтому `ensureUser` не
  срабатывает (поведение идентично).
- **End-to-end на D1 подтверждён:** `wrangler dev` (порт 8787) + локальная D1.
  `POST /practices` с подписанными init data → **200**, практика сохраняется и
  читается `GET /practices`. Раньше этот запрос упал бы с FK-ошибкой.
- `wrangler deploy --dry-run` — воркер собирается чисто (735 KiB / gzip 120 KiB),
  биндинги D1 + MINI_APP_URL присутствуют.

## Что осталось до публикации (требует одобрения)

1. `npx wrangler d1 create dharma-diary` → вписать `database_id` в `wrangler.jsonc`
   (сейчас заглушка `REPLACE_WITH_D1_DATABASE_ID`).
2. `npm run d1:migrate` — накатить схему на удалённую D1.
3. `wrangler secret put TELEGRAM_BOT_TOKEN / INTERNAL_API_TOKEN /
   TELEGRAM_WEBHOOK_SECRET / OPENROUTER_API_KEY / OPENROUTER_MODEL`.
4. `npm run worker:deploy` (`vite build` + `wrangler deploy`).
5. Выставить webhook бота на `<worker-url>/telegram/webhook` с секретом.

## Локальная проверка D1-пути без публикации

```bash
cd "C:/Proekti/Mini apka dlya po dharme"
unset NODE_OPTIONS && export CODEBUDDY_SAFE_DELETE_ENABLED=0
npm run d1:migrate:local
npm run worker:dev -- --port 8787
# подписать init data токеном из .dev.vars и POST /practices
```
