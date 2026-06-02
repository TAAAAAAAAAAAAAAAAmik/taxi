# Продакшен backend

Первый продакшен-срез backend теперь поддерживает два режима хранения:

- `MVP_STORAGE_DRIVER=json` - локальный MVP-файл `.data/mvp-db.json`, удобно для разработки и smoke-тестов.
- `MVP_STORAGE_DRIVER=postgres` - состояние backend хранится в PostgreSQL в таблице `taxi_partner_app_state`.

PostgreSQL-режим пока хранит документ состояния в `jsonb`. Это промежуточный шаг между локальным MVP-файлом и нормализованной схемой таблиц. Он уже дает durable storage, бэкапы, деплой в managed PostgreSQL и controlled production config без переписывания всех endpoint'ов сразу.

## Минимальный production env

```bash
MVP_BACKEND_ENV=production
MVP_STORAGE_DRIVER=postgres
MVP_DATABASE_URL=postgres://taxi:change-me@db:5432/taxi_partner
MVP_DATABASE_SSL=disable
MVP_POSTGRES_STATE_TABLE=taxi_partner_app_state
MVP_POSTGRES_STATE_KEY=default
MVP_DOCUMENT_STORAGE_PATH=/var/lib/taxi-partner/driver-documents

MVP_ADMIN_PASSWORD=<strong-password>
MVP_API_ORIGIN=https://api.brand.ru
MVP_LINKS_ORIGIN=https://links.brand.ru
MVP_INVITE_BASE_URL=https://links.brand.ru/invite

MVP_DELIVERY_MODE=live
MVP_PHONE_VERIFICATION_CHANNEL=sms

MVP_PAYMENT_PROVIDER=tbank
MVP_PAYMENT_PROVIDER_MODE=live
MVP_PAYMENT_RETURN_URL=https://links.brand.ru/payments/driver-return
MVP_TBANK_TERMINAL_KEY=<terminal>
MVP_TBANK_PASSWORD=<password>
MVP_TBANK_SUCCESS_URL=https://links.brand.ru/payments/driver-return
MVP_TBANK_FAIL_URL=https://links.brand.ru/payments/driver-return
MVP_TBANK_NOTIFICATION_URL=https://api.brand.ru/payments/tbank/webhook
MVP_TBANK_WEBHOOK_TOKEN=<webhook-token>
```

Для YooKassa вместо T-Bank:

```bash
MVP_PAYMENT_PROVIDER=yookassa
MVP_YOOKASSA_SHOP_ID=<shop-id>
MVP_YOOKASSA_SECRET_KEY=<secret>
MVP_YOOKASSA_WEBHOOK_TOKEN=<webhook-token>
```

## Проверка

```bash
npm run backend
curl http://localhost:3100/health
```

Для контейнерного запуска:

```powershell
$env:MVP_ADMIN_PASSWORD='<strong-password>'
$env:MVP_LINKS_ORIGIN='https://links.brand.ru'
$env:MVP_INVITE_BASE_URL='https://links.brand.ru/invite'
docker compose -f docker-compose.backend.yml up --build
```

В `/health` должно быть:

```json
{
  "backend": {
    "environment": "production",
    "storage": {
      "driver": "postgres",
      "postgresStateTable": "taxi_partner_app_state",
      "postgresStateKey": "default"
    }
  }
}
```

Если `MVP_BACKEND_ENV=production`, backend намеренно не стартует с demo-паролем, demo-доставкой кодов, `json` storage или без реального links-домена.

## Что это еще не закрывает

- Нормализованную SQL-схему для пользователей, заказов, документов, платежей и аудита.
- Объектное хранилище для фото документов.
- Миграции через отдельный migration runner.
- Горизонтальное масштабирование несколькими backend-процессами без риска last-write-wins.

Следующий backend-срез: вынести документы в private object storage, а затем постепенно разложить `jsonb` state на нормализованные таблицы.
