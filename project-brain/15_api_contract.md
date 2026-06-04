# API Contract

## Назначение

Этот файл нужен, чтобы Codex не придумывал каждый раз новые названия API.

API должен быть простым и понятным.

---

# Orders

## Создание заказа

POST /orders

Поля:

- clientId
- fromAddress
- toAddress
- phone
- comment
- orderType
- priceEstimate

orderType:

- taxi
- delivery

## Получение доступных заказов

GET /orders/available

Используется водителем, чтобы увидеть заказы, которые еще никто не принял.

## Принятие заказа водителем

PATCH /orders/:id/accept

Поля:

- driverId

После принятия заказа статус должен измениться на:

accepted

## Изменение статуса заказа

PATCH /orders/:id/status

Поля:

- status

Статусы заказа:

- created
- accepted
- driver_on_way
- trip_started
- completed
- cancelled

---

# Drivers

## Получение профиля водителя

GET /drivers/me

## Изменение статуса водителя

PATCH /drivers/me/status

Статусы водителя:

- online
- busy
- offline

---

# Admin

## Получение всех заказов

GET /admin/orders

## Получение всех водителей

GET /admin/drivers

## Подтверждение водителя

PATCH /admin/drivers/:id/approve

## Блокировка водителя

PATCH /admin/drivers/:id/block

## Подтверждение оплаты

PATCH /admin/payments/:id/approve
