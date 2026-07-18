# Как разместить приложение в Telegram

## 1. Подготовка GitHub репозитория

```bash
git add .
git commit -m "feat: MVP ready for production"
git push origin main
```

## 2. Деплой на VPS (HTTPS обязателен)

### Требования
- Docker 20+
- Docker Compose 2+
- Домен с SSL сертификатом (например, через Let's Encrypt)

### Настройка
1. Склонируйте репозиторий на сервер
2. Создайте `.env` файл:
```env
TELEGRAM_BOT_TOKEN=123456:ABC-ваш-токен-от-botfather
VITE_API_URL=https://app.yourdomain.com
PORT=3001
```

3. Запустите:
```bash
docker-compose up -d
```

## 3. Настройка Telegram Bot

### Создание бота
1. Напишите @BotFather в Telegram
2. Отправьте `/newbot`
3. Сохраните полученный токен

### Настройка Mini App
1. В @BotFather отправьте `/mybots`
2. Выберите вашего бота
3. **Edit Bot** → **Edit Mini App**
4. Укажите URL: `https://app.yourdomain.com`

### Команды бота
В @BotFather: `/setcommands`
```
start - Запустить приложение
help - Помощь
```

## 4. Автоматические обновления

### Вариант A: GitHub Actions + SSH Deploy
Добавьте в `.github/workflows/ci.yml` шаг деплоя:
```yaml
- name: Deploy to VPS
  run: |
    ssh user@your-server "cd /app && git pull && docker-compose up -d --build"
```

### Вариант B: Webhook для уведомлений
После деплоя настройте webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://app.yourdomain.com/webhook"
```

## 5. Проверка

1. Откройте бота в Telegram
2. Нажмите **Start** или отправьте `/start`
3. Нажмите на кнопку **Открыть приложение**
4. Mini App должно загрузиться

## 6. Обновление приложения

При изменении кода:
```bash
git push origin main
# На сервере:
docker-compose down
docker-compose up -d --build
```

Или настройте автодеплой через GitHub Actions.