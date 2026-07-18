# PROJECT_ANALYSIS

Дата: 2026-07-11

## Краткое назначение проекта

Telegram Mini App «Дневник духовной практики» — мобильный помощник для ежедневных духовных практик (медитация, пранаяма, джапа, цигун и т.п.). Основные функции: планирование практик, запуск таймера, фиксирование результата, дневник, статистика и библиотека практик. Telegram используется для авторизации, запуска Mini App и отправки уведомлений ботом.

## Технологии и зависимости

- Frontend: React, TypeScript, Vite, lucide-react (иконки).
- Backend: Node.js, TypeScript, простая HTTP-серверная обёртка (`node:http` + `tsx` для dev/start).
- DB: SQLite (пакет `packages/database` содержит адаптеры и миграции).
- AI: модуль `packages/ai-adapter` с `MockAiProvider` и OpenAI-compatible provider (заглушка).
- Монорепозиторий: npm workspaces (root `package.json` содержит `workspaces: ["apps/*","packages/*"]`).

## Архитектура

Модульный монолит с выделенным Domain Layer (`packages/domain`), инфраструктурой БД (`packages/database`), AI Adapter (`packages/ai-adapter`) и тремя основными приложениями:
- `apps/api` — HTTP API и бизнес-слой (модули: practices, schedule, timer, diary, statistics, notifications, ai и т.д.).
- `apps/bot` — Telegram-бот, отправка уведомлений и возможность запуска Mini App.
- `apps/mini-app` — React Mini App клиент для Telegram.

Контейнер API создаётся в `apps/api/src/container.ts` и использует sqlite-репозитории из `packages/database` и `MockAiProvider` по умолчанию.

## Структура каталогов (ключевые каталоги)

- `apps/api/src` — сервер, маршруты, модули бизнес-логики.
- `apps/bot/src` — код бота, интеграция с Telegram API, отправка уведомлений.
- `apps/mini-app/src` — клиентское приложение (Vite + React).
- `packages/domain` — доменные сущности (Practice, Schedule, PracticeSession, DiaryEntry, Statistics и т.д.).
- `packages/database` — sqlite адаптеры, репозитории и миграции (packages/database/src/sqlite/repositories.ts и т.д.).
- `packages/ai-adapter` — интерфейсы AI и реализации (mock и OpenAI-compatible).

## Основные точки входа

- API сервер: `apps/api/src/http.ts` создает HTTP сервер и использует `createApp()` (`apps/api/src/main.ts`).
- Bot: `apps/bot/src/main.ts` — фабрика `createBotApp(config)`; CLI запускает polling/pollForever.
- Mini App: `apps/mini-app/src/main.tsx` — React root.

## Что реализовано (исходя из кода и TASKS.md)

- Скелет и большинство use-case'ов backend: маршруты CRUD для практик, расписания, таймеров, дневника, статистики и уведомлений в `apps/api/src/routes.ts`.
- Инфраструктура БД: sqlite-репозитории и преобразование доменных сущностей в строки/таблицы (`packages/database/src/sqlite/repositories.ts`).
- AI Adapter: есть `MockAiProvider` и заготовка для OpenAI-compatible provider (`packages/ai-adapter`).
- Mini App клиент: основной UI (Today, Library, Schedule, Diary, Statistics) — взаимодействует с API через `apps/mini-app/src/api.ts` и поддерживает fallback-режим.
- Telegram Bot: каркас для отправки уведомлений, создания сообщений с кнопкой запуска Mini App.

## Что не закончено / заглушки

- AI: По умолчанию используется `MockAiProvider`, который не парсит команды (возвращает unknown). `OpenAiCompatibleProvider` реализует вызов `/chat/completions`, но не настроен в контейнере — поэтому функции `scheduleAiService.createFromText/createFromVoice` при использовании mock-а приводят к выбросу ошибки (`AI did not return schedule date`).
- Авторизация: отсутствует полноценная проверка Telegram init data / JWT — заголовок `x-user-id` используется в API http.ts, но механизма создания/валидации сессии не видно.
- UI/UX: некоторые экраны — placeholders (например Settings), дизайн не завершён (TASKS.md указывает статус «Дизайн: не начат»).
- Тестирование/CI: нет явных тестов и CI-конфигурации в репозитории.
- Конфигурация окружения и секреты: нет .env example; `apps/bot` ожидает `TELEGRAM_BOT_TOKEN` (см. `apps/bot/src/config.ts`) — возможный runtime gap.
- Валидация входных данных: роуты доверяют JSON-телу и выбрасывают ошибки, но отсутствуют схемы/валидация (например, использование `readBody` в `routes.ts` без JSON schema).

## Найденные потенциальные ошибки и риски

- Если AI остаётся mock'ом — маршруты `/schedule/ai/*` будут бросать ошибки (см. `apps/api/src/modules/schedule/ai-service.ts`).
- Нет проверки прав пользователя на операции (например, изменение расписания другого userId). Риск инъекции/неправильного доступа.
- Миграции и база: `createApiContainer` вызывает `applyMigrations(loadInitMigration())`, но при параллельных запусках/повторных запусках возможны race conditions — стоит проверить транзакционность и idempotency миграций.
- Error handling: в `http.ts` ответ с кодом 400 возвращается для любых ошибок — полезно разграничить 4xx/5xx и логировать серверные ошибки.

## Технический долг

- AI-интеграция оставлена на уровне заглушек.
- Отсутствуют юнит/интеграционные тесты и CI.
- Отсутствуют сборочные/деплойные сценарии (Docker, PM2/PM, process manager).
- Нехватка документации по окружению (env vars), запуску локально и безопасному хранению секретов.
- Отсутствует контроль авторизации/аутентификации и ограничений доступа.

## Рекомендации по дальнейшей разработке

1. Безопасность и auth
   - Добавить проверку Telegram init data / подписи при авторизации Mini App и связать с userId в API.
   - Разграничить права: ensure userId проверяется в сервисах/репозиториях.

2. AI
   - Подключить реальный провайдер (OpenAI-compatible) опционально через ENV, но сохранить `MockAiProvider` как fallback.
   - Обработать случай отсутствия даты/ошибок парсинга в `ScheduleAiService` — вернуть понятный ответ пользователю вместо throw.

3. Validation & Errors
   - Ввести схемы валидации (zod/io-ts) для входных рутов.
   - Улучшить HTTP-коды и логирование ошибок, добавить Sentry/telemetry для prod.

4. Tests & CI
   - Добавить unit-тесты (Vitest) для домена и интеграционные тесты для API.
   - Настроить CI (GitHub Actions) на сборку, typecheck и тесты.

5. Dev DX & Ops
   - Добавить `.env.example`, документацию по запуску локально и Dockerfile для прод.
   - Добавить миграции idempotent и скрипты seed/refresh.

6. UX/Design
   - Уточнить визуальную концепцию, затем внедрить стили/иконки и доработать Settings.

7. Observability
   - Добавить метрики/логи и health-checks для мониторинга.

8. Backward-compatible improvements
   - Не ломать существующие API; расширять через новые эндпоинты и feature flags.

---

Файл с результатами анализа создан автоматически; следующий шаг — детальный roadmap (этап 2). Сформирован план задач и предложен список приоритетных улучшений.
