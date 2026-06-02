# Android SMS gateway

Этот вариант нужен, когда SMS отправляет наш Android-телефон с SIM-картой, без внешнего SMS-провайдера.

Схема:

```text
Taxi Partner backend -> Android phone over HTTP -> termux-sms-send -> SIM SMS
```

## Телефон

1. Установить Termux и Termux:API.
   Лучше брать сборки с F-Droid, потому что версии из Google Play часто устаревшие.

2. В Termux поставить пакеты:

```sh
pkg update
pkg install nodejs termux-api
```

3. Дать Termux:API разрешение на SMS в настройках Android.

4. Скопировать проект или хотя бы файл `scripts/android-sms-gateway.mjs` на телефон.

5. Запустить шлюз:

```sh
export SMS_GATEWAY_TOKEN='change-me-long-random-token'
export SMS_GATEWAY_PORT=8787
node scripts/android-sms-gateway.mjs
```

Проверка с компьютера в той же Wi-Fi сети:

```sh
curl http://PHONE_IP:8787/health
```

Тест без отправки реальной SMS:

```sh
export SMS_GATEWAY_DRY_RUN=1
node scripts/android-sms-gateway.mjs
```

## Backend

В `.env` backend:

```env
MVP_DELIVERY_MODE=live
MVP_PHONE_VERIFICATION_CHANNEL=sms
MVP_SMS_PROVIDER=http
MVP_SMS_HTTP_URL=http://PHONE_IP:8787/send-sms
MVP_SMS_HTTP_TOKEN=change-me-long-random-token
```

Для входа по SMS приложение вызывает:

```text
POST /auth/sms-login/request
POST /auth/sms-login/confirm
```

Первый запрос генерирует код и отправляет его через этот Android-шлюз, второй проверяет код и выдает обычную backend-сессию.

После этого backend будет отправлять SMS-коды через Android-телефон. Payload уже совместим с текущей live-доставкой:

```json
{
  "kind": "sms",
  "to": "79000000000",
  "text": "Код подтверждения Такси Партнер: 123456.",
  "code": "123456",
  "purpose": "verification"
}
```

## Важно

- Телефон и backend должны видеть друг друга по сети. Для пилота проще всего одна Wi-Fi сеть.
- Android может ограничивать фоновые процессы. Отключите оптимизацию батареи для Termux и Termux:API.
- SIM-оператор может ограничивать массовую отправку SMS. Для кодов авторизации держите лимиты и повторы умеренными.
- Не открывайте порт телефона в интернет без VPN или reverse proxy с HTTPS и авторизацией.
