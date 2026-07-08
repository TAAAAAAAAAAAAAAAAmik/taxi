# Деплой бэкенда бесплатно (Render + Neon)

Цель: заказы, чаты, оплата смен и админка работают **между реальными
телефонами**. Всё бесплатно; данные хранятся в Postgres и переживают
перезапуски.

Бэкенд уже готов к облаку: порт из `PORT`, CORS открыт, healthcheck
`/health`, хранилище Postgres через `MVP_STORAGE_DRIVER=postgres` +
`DATABASE_URL`.

---

## Шаг 1. База данных — Neon.tech (бесплатно, 5 минут)

1. Зарегистрируйся: https://neon.tech (вход через GitHub).
2. Create project → регион любой (Frankfurt ближе всего).
3. На дашборде скопируй **Connection string** вида
   `postgresql://user:pass@ep-…neon.tech/neondb?sslmode=require`.

## Шаг 2. Бэкенд — Render.com (бесплатно, 10 минут)

1. Зарегистрируйся: https://render.com (вход через GitHub).
2. New → **Blueprint** → выбери репозиторий `taxi` — Render сам прочитает
   `render.yaml` из корня.
3. В настройках сервиса заполни секретные переменные:
   - `DATABASE_URL` — строка из Neon (шаг 1);
   - `MVP_ADMIN_PASSWORD` — твой пароль админки;
   - `PAYMENT_CARD_NUMBER` — карта для оплаты смен (16 цифр);
   - `PAYMENT_CARD_HOLDER` — например, `Иванов Иван`.
4. Deploy. Через пару минут получишь URL вида
   `https://kinetix-backend.onrender.com`.
5. Проверка: открой `https://…onrender.com/health` — должен ответить JSON.

## Шаг 3. Пересобрать приложение под сервер

Сказать Claude URL из шага 2 — он пересоберёт web с
`EXPO_PUBLIC_API_URL=https://…onrender.com` и задеплоит на gh-pages.
(Вручную: `EXPO_PUBLIC_API_URL=<url> npm run build:web` и выложить `dist`.)

## Шаг 4. Боевой прогон на двух телефонах

1. Телефон А: регистрация клиента → заказ.
2. Телефон Б: регистрация водителя → админка одобряет → смена → заказ
   виден в ленте → принять → статусы/навигатор → завершение.
3. Админка: `https://taaaaaaaaaaaaaaaamik.github.io/taxi/?screen=admin`.

---

## Честные ограничения бесплатного тарифа

- **Render free засыпает** после ~15 минут без запросов; первый запрос
  будит его за 30–60 сек. Для показов и пилота — терпимо, для боевых
  смен водителей — раздражает. Лечится: платный Render ($7/мес) или
  российский VPS за 150–300 ₽/мес (Timeweb, Beget, VDSina) — там же
  снимается риск блокировок зарубежных хостов.
- Neon free: 0.5 ГБ — для района хватит надолго.
- Если Render/Neon не открываются с твоего интернета — сразу берём
  план Б: RU VPS, установка в одну команду (`node scripts/mvp-backend.mjs`
  под pm2/systemd + caddy для HTTPS). Claude подготовит скрипт.

## Переменные окружения бэкенда (справочно)

| Переменная | Зачем |
|---|---|
| `MVP_STORAGE_DRIVER=postgres` | хранить данные в Postgres |
| `DATABASE_URL` | строка подключения Neon |
| `MVP_ADMIN_PASSWORD` | пароль входа в админку |
| `MVP_PAYMENT_PROVIDER_MODE=manual` | ручная оплата смен переводом |
| `PAYMENT_CARD_NUMBER`, `PAYMENT_CARD_HOLDER` | карта владельца на экране оплаты доступа |
| `MVP_FIREBASE_SERVICE_ACCOUNT_JSON` | (позже) пуши водителям через FCM |
