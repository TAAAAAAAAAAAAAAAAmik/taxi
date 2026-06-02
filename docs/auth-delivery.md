# Auth delivery

Пункт 2 закрывает рабочий контур входа и восстановления доступа:

- пароли хранятся как `scrypt`-хэши;
- session token возвращается клиенту один раз, а в `.data/mvp-db.json` хранится только `tokenHash`;
- коды подтверждения и восстановления хранятся только как `codeHash`;
- `POST /auth/logout` отзывает текущую сессию, `POST /auth/logout-all` отзывает все сессии пользователя;
- `POST /auth/password-reset/request` создает одноразовый код, а `POST /auth/password-reset/confirm` меняет пароль и отзывает старые сессии.

В demo-режиме `MVP_DELIVERY_MODE=demo` backend возвращает код в ответе, чтобы пилот можно было проверить руками. В live-режиме `MVP_DELIVERY_MODE=live` код не возвращается в API и уходит в выбранный канал.

## Каналы

SMS:

- `MVP_SMS_PROVIDER=smsru` + `MVP_SMSRU_API_ID` для SMS.RU;
- `MVP_SMS_PROVIDER=http` + `MVP_SMS_HTTP_URL` для собственного шлюза.

Email:

- `MVP_EMAIL_PROVIDER=resend` + `MVP_RESEND_API_KEY` + `MVP_EMAIL_FROM` для Resend;
- `MVP_EMAIL_PROVIDER=http` + `MVP_EMAIL_HTTP_URL` для собственного шлюза.

Telegram:

- `MVP_TELEGRAM_PROVIDER=botapi` + `MVP_TELEGRAM_BOT_TOKEN`;
- получателя задайте через `MVP_TELEGRAM_CHAT_ID` для пилота или `MVP_TELEGRAM_CHAT_MAP` для карты `phone/email/userId -> chat_id`;
- если нужен провайдер, который сам связывает телефон с Telegram, используйте `MVP_TELEGRAM_PROVIDER=http` + `MVP_TELEGRAM_HTTP_URL`.

MAX:

- `MVP_MAX_PROVIDER=platform` + `MVP_MAX_ACCESS_TOKEN`;
- получателя задайте через `MVP_MAX_USER_ID`, `MVP_MAX_CHAT_ID`, `MVP_MAX_USER_MAP` или `MVP_MAX_CHAT_MAP`;
- если нужен внешний шлюз по телефону, используйте `MVP_MAX_PROVIDER=http` + `MVP_MAX_HTTP_URL`.

Карты можно задавать JSON-объектом:

```json
{ "79020000000": "123456789", "user-abc": "987654321" }
```

или строкой:

```text
79020000000=123456789,user-abc=987654321
```

Для Telegram и MAX официальный bot API отправляет сообщение в уже известный `chat_id`/`user_id`; если в анкете пока есть только телефон, нужен либо собственный HTTP-шлюз, либо предварительная привязка пользователя к боту.
