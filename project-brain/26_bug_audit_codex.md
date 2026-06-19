# QA-аудит дефектов Codex

Дата: 2026-06-15
Режим: только анализ, код приложения не менялся.

Не дублирую исправленные записи из `project-brain/07_bugs.md`: сериализация `mutateDb`, forward-only статус-переходы и идемпотентный повторный `assign` тем же водителем.

## Critical

### 1. Аноним может менять жизненный цикл и оплату любого заказа

Severity: critical

Файл: `scripts/mvp-backend.mjs:8389`, `scripts/mvp-backend.mjs:8417`, `scripts/mvp-backend.mjs:8464`, `scripts/mvp-backend.mjs:8588`, `scripts/mvp-backend.mjs:8957`

Пометка: возможно, уже в работе у Claude, потому что пересекается с зоной статусов/assign/биллинга из `09_last_state.md`, но это не тот же исправленный баг.

В чём дефект: ручки `/orders`, `/orders/:id/status`, `/orders/:id/payment`, `/orders/:id/assign` не требуют `sessionContext` и не проверяют роль/владение. Любой клиент без `Authorization` может получить все заказы, создать заказ от чужого `userId`, назначить любого водителя, перевести заказ в `completed` и тем самым запустить `settleOrderPayment` на `scripts/mvp-backend.mjs:8513`.

Как воспроизвести:
1. Запустить backend.
2. Без токена выполнить `GET /orders` и взять любой `id`.
3. Без токена выполнить `PATCH /orders/{id}/status` с body `{"status":"completed"}` или `PATCH /orders/{id}/assign` с body `{"driverId":"driver-alexey-solaris"}`.
4. Сервер изменит заказ, разошлёт realtime/push и для `completed` пересчитает оплату/долю сервиса.

Направление фикса: требовать сессию для всех мутирующих order-ручек; `userId`, `driverId`, `role` и actor брать из токена, а не из payload; разрешить клиенту менять только свои заказы, водителю только назначенный/доступный заказ, администратору отдельные операции оплаты; добавить smoke-тесты на 401/403 без токена и при чужой роли.

### 2. Публичные internal billing/notification endpoints позволяют писать денежный ledger

Severity: critical

Файл: `scripts/mvp-backend.mjs:8703`, `scripts/mvp-backend.mjs:8721`, `scripts/mvp-backend.mjs:8761`, `scripts/mvp-backend.mjs:8778`

В чём дефект: `/internal/billing/driver-credit` без авторизации добавляет запись в `db.walletLedger`, а `/internal/billing/client-charge` возвращает успешную оплату. Также публичны `/internal/notifications` и marketing internal-ручки. Название `internal` не даёт защиты.

Как воспроизвести:
1. Без токена выполнить `POST /internal/billing/driver-credit` с body `{"driverId":"driver-alexey-solaris","amount":999999,"orderId":"fake"}`.
2. В ответ придёт `200`, а в `walletLedger` появится начисление.

Направление фикса: закрыть internal-ручки отдельным server-to-server secret, allowlist/mTLS или убрать из публичного handler; валидировать сумму, существование заказа/водителя и идемпотентный ключ; не писать ledger без подтверждённого источника.

### 3. Публичные park endpoints дают управление таксопарком и подпиской

Severity: critical

Файл: `scripts/mvp-backend.mjs:8801`, `scripts/mvp-backend.mjs:8833`, `scripts/mvp-backend.mjs:8854`, `scripts/mvp-backend.mjs:8901`, `scripts/mvp-backend.mjs:8917`

В чём дефект: весь блок `/parks/{parkId}/...` не проверяет `sessionContext`. Аноним может смотреть финансы/заказы/водителей парка, создавать invite, менять статус водителя парка и активировать подписку парка, что создаёт `subscription` и продлевает доступ.

Как воспроизвести:
1. Узнать `parkId` из realtime/ответов приложения.
2. Без токена выполнить `GET /parks/{parkId}/finance`.
3. Без токена выполнить `POST /parks/{parkId}/subscription/activate`.
4. Парк станет `active`, появится активная подписка.

Направление фикса: для всех `/parks` требовать `park_admin` владельца конкретного `parkId` или `admin`; для денежных действий добавить подтверждение оплаты/админское действие; не возвращать финансы и документы без проверки доступа.

## High

### 4. Realtime snapshot/stream/ws публично отдают полное состояние

Severity: high

Файл: `scripts/mvp-backend.mjs:1055`, `scripts/mvp-backend.mjs:1060`, `scripts/mvp-backend.mjs:6608`, `scripts/mvp-backend.mjs:6617`, `scripts/mvp-backend.mjs:9089`

В чём дефект: `/realtime/snapshot`, `/realtime/stream` и WebSocket `/realtime/ws` открываются без auth и отправляют `orders: db.orders`, `notifications`, `supportThreads`, `drivers`. Это раскрывает маршруты, телефоны, `userId`, статусы, сообщения поддержки и PIN после назначения.

Как воспроизвести:
1. Без токена открыть `GET /realtime/snapshot`.
2. Или подключиться к `/realtime/stream`.
3. Получить полный snapshot всех заказов и обращений.

Направление фикса: требовать токен в snapshot/SSE/WS; строить snapshot по роли: клиент видит свои заказы, водитель открытые/свои, парк свой парк, админ всё; из публичных событий вырезать PIN, телефоны и чужие supportThreads.

### 5. Публичный `/users` раскрывает персональные данные всех пользователей

Severity: high

Файл: `scripts/mvp-backend.mjs:3936`, `scripts/mvp-backend.mjs:3941`, `scripts/mvp-backend.mjs:7586`

В чём дефект: `GET /users` не требует сессии и возвращает `publicUser`, который удаляет только `passwordHash`. Email, phone, role, referralCode, bonusBalance, parkId остаются в ответе.

Как воспроизвести:
1. Без токена выполнить `GET /users`.
2. Получить список пользователей с контактами и внутренними идентификаторами.

Направление фикса: закрыть `/users` admin-only или удалить endpoint из MVP API; для не-админских сценариев сделать отдельные scoped endpoints без контактов и финансовых полей.

### 6. ID заказа может повториться и смешать чужие статусы/оплату

Severity: high

Файл: `scripts/mvp-backend.mjs:2409`, `src/screens/OrderFlowScreen.tsx:604`, `src/state/AppState.tsx:783`

В чём дефект: ID заказа строится как `TX-${Date.now().toString().slice(-6)}`. Последние 6 цифр миллисекунд повторяются каждые 16 минут 40 секунд, а при параллельном создании могут совпасть в одну миллисекунду. Сервер дальше ищет заказ через `.find((item) => item.id === pathParts[1])`, а клиент фильтрует по `id`, поэтому новый заказ может вытеснить старый или статус/оплата применятся не к тому заказу.

Как воспроизвести:
1. Замокать `Date.now()` на одинаковое значение в клиенте/сервере или создать два заказа в один и тот же миллисекундный слот.
2. Получить два заказа с одинаковым `TX-...`.
3. Выполнить PATCH по этому `id` и увидеть, что изменяется первый найденный заказ, а клиентский список дедуплицируется по `id`.

Направление фикса: генерировать ID на сервере через `randomUUID()`/ULID/монотонный sequence; клиентский предварительный ID держать отдельно как `clientRequestId`; на сервере запрещать дубликат `order.id`.

### 7. Клиент оптимистично меняет статус/оплату до ответа сервера и не откатывает отказ

Severity: high

Файл: `src/state/AppState.tsx:1438`, `src/state/AppState.tsx:1439`, `src/state/AppState.tsx:1457`, `src/state/AppState.tsx:1462`, `src/state/AppState.tsx:1463`, `src/state/AppState.tsx:1500`, `src/state/AppState.tsx:1501`

Пометка: возможно, уже в работе у Claude, потому что пересекается со статусами, PIN и биллингом, но находится в клиентском состоянии, не в исправленном backend forward-only.

В чём дефект: `updateOrderStatus`, `updateOrderPaymentStatus` и `updateOrderServiceShareStatus` сначала меняют локальный `orders`, а уже потом вызывают API. В `catch` выставляется offline-сообщение, но локальная мутация не откатывается. Если сервер вернёт 403 по неверному PIN или 422 по недопустимому переходу, экран уже покажет новый статус/оплату.

Как воспроизвести:
1. Открыть экран водителя для заказа с PIN.
2. Ввести неверный 4-значный PIN и нажать переход к `started`.
3. Сервер вернёт `403 Trip PIN does not match`, но локальный state уже продвинул заказ.

Направление фикса: для критичных статусов/оплаты применять pessimistic update: менять state только после успешного ответа; на ошибке показывать отказ сервера и оставлять прежний заказ; optimistic update допустим только с rollback snapshot.

### 8. Support endpoints позволяют читать и перезаписывать чужие обращения

Severity: high

Файл: `scripts/mvp-backend.mjs:2268`, `scripts/mvp-backend.mjs:2277`, `scripts/mvp-backend.mjs:2287`, `scripts/mvp-backend.mjs:2288`, `scripts/mvp-backend.mjs:6896`, `scripts/mvp-backend.mjs:6908`

В чём дефект: `/support/threads` и `/support/messages` публичны. `listSupportThreads` без `userId` возвращает все треды, а `appendSupportMessage` принимает `payload.userId` и `payload.threadId`. Дефолтный `threadId` строится только из role+category, поэтому разные пользователи одной роли и категории могут попасть в один тред.

Как воспроизвести:
1. Без токена выполнить `GET /support/threads`.
2. Без токена выполнить `POST /support/messages` с чужим `userId` или известным `threadId`.
3. Сообщение добавится в существующий тред и уйдёт в realtime.

Направление фикса: требовать auth; `userId` брать только из session; `threadId` генерировать сервером и связывать с владельцем; admin-only доступ к чужим обращениям; добавить 403-тесты.

## Medium

### 9. Push token можно привязать к чужому `userId`

Severity: medium

Файл: `scripts/mvp-backend.mjs:6622`, `scripts/mvp-backend.mjs:6635`, `src/services/pushNotifications.ts:42`, `src/services/pushNotifications.ts:50`

В чём дефект: `/push-tokens` не требует auth и доверяет `userId`/`role` из body. После утечки `userId` через `/users` или realtime атакующий может зарегистрировать свой device token на чужого пользователя и получать его push-уведомления.

Как воспроизвести:
1. Узнать чужой `userId`.
2. Без токена отправить `POST /push-tokens` с `{"userId":"victim","role":"client","token":"attacker-token","tokenType":"expo","platform":"ios"}`.
3. Следующие push для этого userId будут отправляться и на чужой token.

Направление фикса: требовать session; игнорировать `payload.userId` и `payload.role`, брать их из токена; разрешить удаление/ротацию токенов при logout; ограничить количество токенов на пользователя.

### 10. Платёжные webhook-проверки fail-open при пустых секретах

Severity: medium

Файл: `scripts/mvp-backend.mjs:3638`, `scripts/mvp-backend.mjs:3639`, `scripts/mvp-backend.mjs:3640`, `scripts/mvp-backend.mjs:3649`, `scripts/mvp-backend.mjs:3657`, `scripts/mvp-backend.mjs:3659`, `scripts/mvp-backend.mjs:3660`, `scripts/mvp-backend.mjs:7980`, `scripts/mvp-backend.mjs:8001`

В чём дефект: YooKassa webhook считается валидным, если `MVP_YOOKASSA_WEBHOOK_TOKEN` пустой. T-Bank webhook при отсутствии `Token` или terminal/password тоже возвращает `true`. `validate-release-env.mjs` требует секреты для production, но сам backend fail-open: если процесс запущен без release-check или с неправильным env, поддельный webhook может попасть в `applyYooKassaWebhook`/`applyTBankWebhook`.

Как воспроизвести:
1. Запустить backend без `MVP_YOOKASSA_WEBHOOK_TOKEN` или без T-Bank token/password.
2. Отправить `POST /payments/yookassa/webhook` или `/payments/tbank/webhook` с payload, похожим на успешный платёж.
3. Проверка токена не отклонит запрос на входе.

Направление фикса: для live provider делать fail-closed прямо в backend; разрешать пустой webhook secret только в явном `demo/manual` режиме; логировать misconfiguration как startup error; покрыть тестом forged webhook.
