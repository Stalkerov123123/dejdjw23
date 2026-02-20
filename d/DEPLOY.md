# Деплой Студенческого рейтинга ВГУИТ

## Вариант 1: Docker (рекомендуется)

### Требования
- Docker и Docker Compose
- 512MB+ RAM
- 1GB+ дискового пространства

### Установка

1. **Клонируйте проект на сервер:**
```bash
git clone <ваш-репозиторий> vsuet-rating
cd vsuet-rating
```

2. **Запустите:**
```bash
docker compose up -d --build
```

3. **Генерация демо-данных (первый запуск):**
```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"demo": true}'
```

Приложение будет доступно на порту 3000.

---

## Вариант 2: Ручная установка (без Docker)

### Требования
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+ или Bun
- 512MB+ RAM

### Установка Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### Установка приложения

```bash
# 1. Клонируйте проект
git clone <ваш-репозиторий> vsuet-rating
cd vsuet-rating

# 2. Установите зависимости
bun install

# 3. Инициализируйте базу данных
bun run db:push

# 4. Соберите приложение
bun run build

# 5. Запустите
bun run start
```

### Systemd сервис (автозапуск)

Создайте файл `/etc/systemd/system/vsuet-rating.service`:

```ini
[Unit]
Description=VSUET Student Rating
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/vsuet-rating
ExecStart=/root/.bun/bin/bun run start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:/var/www/vsuet-rating/db/production.db

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable vsuet-rating
sudo systemctl start vsuet-rating
```

---

## Nginx (Reverse Proxy)

Создайте `/etc/nginx/sites-available/vsuet-rating`:

```nginx
server {
    listen 80;
    server_name rating.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vsuet-rating /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d rating.example.com
```

---

## Переменные окружения

Создайте `.env` файл:

```env
DATABASE_URL=file:./db/production.db
NODE_ENV=production
```

---

## Обновление

### Docker:
```bash
git pull
docker compose up -d --build
```

### Ручное:
```bash
git pull
bun install
bun run db:push
bun run build
sudo systemctl restart vsuet-rating
```

---

## Мониторинг

### Логи (Docker):
```bash
docker compose logs -f app
```

### Логи (Systemd):
```bash
sudo journalctl -u vsuet-rating -f
```

### Проверка здоровья:
```bash
curl http://localhost:3000/api/faculties
```

---

## Планировщик парсинга

Парсинг запускается автоматически:
- **10:30 МСК** (07:30 UTC)
- **17:30 МСК** (14:30 UTC)

Для ручного запуска:
```bash
# Демо-данные
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"demo": true}'

# Реальный парсинг
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"demo": false}'
```

---

## Резервное копирование

```bash
# Бэкап базы данных
cp db/production.db backups/db_$(date +%Y%m%d).db

# Автоматический бэкап (crontab)
0 3 * * * cp /var/www/vsuet-rating/db/production.db /var/backups/vsuet/db_$(date +\%Y\%m\%d).db
```
