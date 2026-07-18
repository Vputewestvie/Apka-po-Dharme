# Деплой проекта

## Локальный запуск

```bash
npm install
cp .env.example .env
npm run dev:api
npm run dev:mini-app
```

## Production деплой на VPS

### Требования

- Docker 20+
- Docker Compose 2+
- Домен/subdomain, указывающий на сервер

### Переменные окружения

Создайте `.env` в корне проекта:

```env
TELEGRAM_BOT_TOKEN=...
PORT=3001
APP_DATABASE_PATH=/app/data/app.sqlite
VITE_API_URL=https://your-domain.com
GOOGLE_API_KEY=...
GOOGLE_MODEL=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_FALLBACK_MODELS=deepseek/deepseek-v4-flash,gpt-4o-mini
```

### Запуск

```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```

### Остановка

```bash
docker-compose down
```

## Backup SQLite

### Автоматический backup

Добавьте в crontab:

```bash
0 3 * * * cp /app/data/app.sqlite /app/data/backups/app-$(date +\%Y\%m\%d).sqlite
```

### Восстановление

```bash
docker-compose down
cp /app/data/backups/app-20260718.sqlite /app/data/app.sqlite
docker-compose up -d
```

## Мониторинг

- Health check: `curl https://your-domain.com/health`
- Логи: `docker-compose logs -f`
- База: `docker exec -it <container> sqlite3 /app/data/app.sqlite`