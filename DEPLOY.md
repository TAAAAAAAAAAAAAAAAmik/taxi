# Деплой бэкенда

Два варианта: **A** — RU VPS за ~300 ₽/мес (рекомендуется: не засыпает,
в России) и **B** — бесплатный Render + Neon (для показов; засыпает).

---

## Вариант A (рекомендуется): RU VPS за ~300 ₽ — FirstVDS / FirstByte / Timeweb

Бэкенд лёгкий — хватит минимального тарифа: **1 CPU / 1 ГБ RAM,
Ubuntu 24.04**. Свой домен не нужен (HTTPS выдаётся на домен-по-IP).

1. Купи VPS, при заказе выбери ОС **Ubuntu 24.04**, получи IP и root-пароль.
2. Зайди на сервер (с телефона — приложение Termius; с ПК — `ssh root@IP`).
3. Выполни одну команду (подставь свои значения):

```bash
curl -fsSL https://raw.githubusercontent.com/TAAAAAAAAAAAAAAAAmik/taxi/claude/github-taxi-project-ho7q97/scripts/setup-vps.sh -o setup.sh \
&& REPO_URL=https://github.com/TAAAAAAAAAAAAAAAAmik/taxi.git \
   ADMIN_PASSWORD='твой_пароль_админки' \
   CARD_NUMBER='2200XXXXXXXXXXXX' \
   CARD_HOLDER='Иванов Иван' \
   bash setup.sh
```

Скрипт сам ставит Node 22 и Caddy, поднимает systemd-сервис с
автоперезапуском и HTTPS, и в конце печатает адрес вида
`https://85-198-1-2.sslip.io`.

> Репозиторий приватный? В `REPO_URL` подставь GitHub-токен:
> `https://<токен>@github.com/TAAAAAAAAAAAAAAAAmik/taxi.git`
> (токен: github.com → Settings → Developer settings → Fine-grained token,
> доступ read к репо taxi).

4. Проверь `https://…sslip.io/health` в браузере — JSON = работает.
5. **Пришли URL Claude** — он пересоберёт приложение под сервер.

Обслуживание: логи `journalctl -u kinetix -f`; обновление кода —
`cd /opt/kinetix && git pull && systemctl restart kinetix`. Данные
лежат в `/var/lib/kinetix/db.json` (бэкап = скопировать файл).

---

## Вариант B: бесплатно (Render + Neon)

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
