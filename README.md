# Дневник духовной практики — локальная разработка и деплой

Короткая инструкция для разработки и запуска проекта локально.

## Требования

- Node.js 18+ и npm
- Docker и Docker Compose (для production)

## Установка зависимостей

```bash
npm install
```

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Обязательные переменные:
- `TELEGRAM_BOT_TOKEN` — токен Telegram бота
- `GOOGLE_API_KEY` и `GOOGLE_MODEL` — для Google AI Studio (опционально)
- `OPENROUTER_API_KEY` и `OPENROUTER_MODEL` — для OpenRouter (опционально)

Для локальной разработки Mini App:
- `VITE_DEV_USER_ID=demo-user` — ID пользователя для тестирования

## Запуск в режиме разработки

### API сервер

```bash
npm run dev:api
```

Сервер запустится на http://localhost:3001

### Mini App (Vite)

```bash
npm run dev:mini-app
```

Mini App запустится на http://localhost:5173

## Production деплой

### Сборка и запуск через Docker Compose

```bash
# Сборка образа
docker-compose build

# Запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

### Переменные окружения для production

Создайте файл `.env` в корне проекта с переменными:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
PORT=3001
APP_DATABASE_PATH=/app/data/app.sqlite
VITE_API_URL=https://your-domain.com
```

### Развёртывание на VPS

1. Склонируйте репозиторий на сервер
2. Установите Docker и Docker Compose
3. Создайте `.env` файл с production переменными
4. Запустите `docker-compose up -d`
5. Настройте Nginx/Traefik как reverse proxy (опционально)
6. Установите Telegram Web App URL в BotFather

## Структура проекта

```
apps/
  api/          — Backend API (Node.js + TypeScript)
  mini-app/     — Telegram Mini App (React + Vite)
  bot/          — Telegram Bot

packages/
  domain/       — Domain Layer (сущности, бизнес-правила)
  database/     — Infrastructure Layer (SQLite, репозитории)
  ai-adapter/   — AI Provider abstraction
  shared/       — Общие типы и утилиты
```

## Доступные команды

```bash
# TypeScript проверка
npm run typecheck

# Запуск API
npm run dev:api

# Запуск Mini App
npm run dev:mini-app

# Сборка Mini App
npm run build -w @app/mini-app

# Очистка
npm run clean
```

## Безопасность

- API требует авторизацию через Telegram init data (HMAC-SHA256)
- Для локальной разработки можно использовать `x-user-id` заголовок
- В production используйте только Telegram init data

## Лицензия

Private