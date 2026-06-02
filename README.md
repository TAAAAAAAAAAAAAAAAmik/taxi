# Такси Салават

Основа мобильного приложения Kinetix для такси на Expo и React Native. Главный MVP-фокус: клиенты сразу заказывают поездки, самозанятые водители выбирают 3000 ₽/мес без комиссии или 7% с поездки без ежемесячного платежа.

## Что уже есть

- выбор роли: клиент или водитель-партнер;
- навигация между стартом, входом, регистрацией, подтверждениями и кабинетом;
- регистрационная форма с базовой валидацией;
- локальный backend для регистрации, входа, сессий, demo/live-кодов подтверждения и demo-аккаунтов;
- восстановление пароля, выход из аккаунта и live-доставка кодов через SMS, Telegram, MAX или email;
- безопасная формулировка "пароль для приложения" вместо пароля от почты;
- поля для документов водителя и данных автомобиля;
- защищенный экран загрузки фото паспорта, ВУ, СТС и ОСАГО с отправкой на backend;
- согласия на условия сервиса, конфиденциальность и обработку персональных данных;
- статусы проверки для клиента и водителя;
- ролевое меню после успешной регистрации;
- оформление заказа для клиента и принятие заказа водителем;
- диспетчеризация заказа с назначением водителя, историей статусов, платежными статусами, чеком и возвратом в demo-режиме;
- допуск водителя к заказам через статусы документов, договора, реестра, налогового профиля и разрешения автомобиля;
- реферальная программа с личным кодом, invite-ссылками для клиента/водителя, бонусным балансом и админским обзором;
- локальный справочник адресов и популярных маршрутов Салаватского района;
- детальные подсказки улиц и домов, включая дробные номера вроде `Коммунистическая улица, 65/1`;
- запрос геолокации для выбора ближайшего адресного контекста и будущей загрузки маршрутов по РФ;
- выбор связи в заказе: чат приложения или звонок по мобильному номеру;
- история заказов и переход из истории обратно в статус заказа;
- автоматическое обновление статуса заказа через WebSocket, SSE и polling без ручной кнопки;
- отзыв после завершения поездки, чек и добавление хорошего водителя в избранные;
- сохранение домашнего адреса через быстрый пункт "Дом";
- простой чат поддержки внутри приложения с заделом под сервер сообщений;
- выбор модели доступа водителя: 3000 ₽/мес без комиссии или 7% с поездки;
- demo/manual/live-сценарии операций водительского доступа с платежной записью, чеком и возвратом для месячной модели;
- уведомления о новых заказах через WebSocket и push-каналы FCM/APNs;
- диспетчеризация ближайших водителей с Redis GEO и greedy/batch режимами в FastAPI logistics-сервисе;
- локальный MVP backend на Node.js с JSON-базой для заказов, водителей и админки;
- заготовка Universal Links и Android App Links в `app.config.js`;
- чек-листы для публикации и юридической подготовки.

## Запуск

```bash
npm install
npm run backend
npm run start
```

Backend запускается на `http://localhost:3100` и хранит локальную JSON-базу в `.data/mvp-db.json`.
Для теста на телефоне замените `EXPO_PUBLIC_API_URL` на IP компьютера в локальной сети.
Админ-пароль локального backend по умолчанию: `admin-demo-5000`; для пилота задайте `MVP_ADMIN_PASSWORD`.

Для локальной web-проверки одной командой:

```bash
npm run dev:local
```

Скрипт поднимает backend на `http://localhost:3100` и Expo Web на `http://localhost:8093`.
Demo-входы: `demo-client@example.test / password123`, `demo-driver@example.test / password123`, админка - `admin-demo-5000`.

Для закрытого Android APK-пилота без SMS:

```bash
npm run backend:pilot
npm run prepare:pilot-apk
npm run build:pilot-apk
```

`backend:pilot` автоматически включает `MVP_SKIP_PHONE_VERIFICATION=true`, а `prepare:pilot-apk` подставляет текущий LAN-IP в `eas.json`. Если автоопределение IP не подходит, задайте `PILOT_API_HOST=<LAN-IP>`.

Для проверки TypeScript:

```bash
npm run typecheck
```

Backend smoke-тесты:

```bash
npm run test:verification
npm run test:auth-delivery
npm run test:documents
npm run test:driver-billing
npm run test:driver-billing:yookassa
npm run test:driver-billing:tbank
npm run test:dispatch
npm run test:geo-messaging
npm run test:realtime
npm run test:referrals
```

## Справочник домов Салаватского района

`src/data/salavatDistrictHouses.ts` - сгенерированный справочник домов для офлайн-пилота. Файл намеренно хранится в репозитории: сейчас это около 8.7 МБ и 14 325 домов, что приемлемо для MVP без отдельного геокодер-сервера.

Источник указан в `salavatDistrictHouseSourceSummary`: онлайн-справочник ФИАС/ГАР ФНС по Салаватскому району, версия `22.05.2026`, плюс адресные теги OpenStreetMap relation `398510`, где они доступны. OSM-импорт берет bbox вокруг района и фильтрует точки по границе relation, чтобы не захватывать соседние города. Файл не редактируется вручную; для обновления нужно запускать:

```bash
npm run import:salavat-addresses
```

Для продакшена импорт лучше перенести на серверную сторону и регулярно сверять с официальной выгрузкой ГАР/ФИАС.

## Основные файлы

- `App.tsx` - входная точка приложения.
- `src/navigation/AppNavigator.tsx` - стек экранов приложения.
- `src/navigation/types.ts` - типы параметров навигации.
- `src/screens/WelcomeScreen.tsx` - стартовый экран.
- `src/screens/LoginScreen.tsx` - вход в приложение.
- `src/screens/PasswordResetScreen.tsx` - восстановление пароля кодом.
- `src/screens/RegistrationScreen.tsx` - регистрация по ролям.
- `src/screens/VerifyPhoneScreen.tsx` - подтверждение телефона.
- `src/screens/VerifyEmailScreen.tsx` - подтверждение почты.
- `src/screens/DashboardScreen.tsx` - ролевой кабинет после входа.
- `src/screens/OrderFlowScreen.tsx` - оформление заказа для всех ролей.
- `src/screens/OrderStatusScreen.tsx` - контроль статуса созданного заказа.
- `src/screens/OrderHistoryScreen.tsx` - история заказов.
- `src/screens/SavedPlaceScreen.tsx` - сохранение домашнего адреса.
- `src/screens/SupportChatScreen.tsx` - чат поддержки.
- `src/screens/SubscriptionScreen.tsx` - выбор модели доступа и операции доступа водителя.
- `src/screens/ReferralScreen.tsx` - личный реферальный код, invite-ссылки и история бонусов.
- `src/data/registration.ts` - роли, поля, согласия и статусы.
- `src/data/menu.ts` - пункты меню после регистрации.
- `src/data/sectionPages.ts` - отдельные страницы разделов кабинета.
- `src/data/orderFlow.ts` - сценарии оформления заказа по ролям.
- `src/data/orderStatus.ts` - статусы и этапы заказа по ролям.
- `src/data/subscription.ts` - параметры месячной модели и комиссии водителя.
- `src/data/salavatDistrict.ts` - адресные подсказки и маршруты Салаватского района.
- `src/data/salavatDistrictHouses.ts` - сгенерированный справочник домов Салаватского района.
- `src/services/apiClient.ts` - клиент локального MVP backend.
- `src/services/locationService.ts` - запрос геолокации без новой нативной зависимости.
- `src/services/messageServer.ts` - режим подключения будущего сервера сообщений.
- `src/state/AppState.tsx` - состояние пользователя, заказов, водителей, рефералов и backend-синхронизации.
- `src/utils/validation.ts` - базовая валидация формы.
- `scripts/mvp-backend.mjs` - backend для пилота с локальным JSON-хранилищем и PostgreSQL storage driver для первого продакшен-среза.
- `scripts/start-local-dev.mjs` - запуск backend и Expo Web одной командой.
- `scripts/auth-delivery-smoke-test.mjs` - smoke-тест live-доставки кодов, logout и восстановления пароля.
- `scripts/dispatch-smoke-test.mjs` - smoke-тест назначения заказа, статусов, оплаты и чека.
- `scripts/referral-smoke-test.mjs` - smoke-тест реферальной логики клиента и водителя.
- `Dockerfile.backend` и `docker-compose.backend.yml` - заготовка контейнерного запуска backend + PostgreSQL.
- `app.config.js` - настройки Expo, bundle id, Android package и app links из env.
- `docs/data-model.md` - модель данных регистрации.
- `docs/auth-delivery.md` - настройка SMS, Telegram, MAX, email, сессий и восстановления пароля.
- `docs/post-registration-menu.md` - карта меню клиента, водителя и автопарка.
- `docs/legal-checklist.md` - юридический чек-лист.
- `docs/driver-subscription-model.md` - разбор модели расчетов и доступа водителя.
- `docs/nationwide-routing-and-messaging.md` - схема маршрутов России и сервера сообщений.
- `docs/production-backend.md` - первый продакшен-срез backend: PostgreSQL storage, env, Docker Compose и ограничения.
- `docs/salavat-district-mvp.md` - локальная зона MVP и адресный справочник.
- `docs/store-release-checklist.md` - чек-лист App Store и Google Play.

## Что заменить перед релизом

- `ru.taxipartner.app` на реальный bundle id и Android package.
- `EXPO_PUBLIC_LINKS_DOMAIN` / `MVP_LINKS_ORIGIN` на рабочий домен для инвайт-ссылок.
- `EXPO_PUBLIC_API_URL` / `MVP_API_ORIGIN` на HTTPS-адрес API.
- webhook URL платежного провайдера: `MVP_TBANK_NOTIFICATION_URL` или URL `/payments/yookassa/webhook` в кабинете YooKassa.
- `MVP_STORAGE_DRIVER=json` на `postgres`, задать `MVP_DATABASE_URL` и постоянный `MVP_DOCUMENT_STORAGE_PATH`.
- ключи и URL провайдеров `MVP_SMS_*`, `MVP_TELEGRAM_*`, `MVP_MAX_*`, `MVP_EMAIL_*` для live-доставки кодов.
- значения `MVP_INVITE_BASE_URL` и реферальных правил в `.env.example`, если бонусы пилота будут другими.
- TTL кодов подтверждения и восстановления `MVP_VERIFICATION_CODE_TTL_MINUTES` / `MVP_PASSWORD_RESET_CODE_TTL_MINUTES`, если нужен другой срок.
- ссылки на пользовательское соглашение, политику конфиденциальности и согласие на обработку данных.
- иконку и splash screen в папке `assets`.

## Ближайшие следующие шаги

1. Поднять backend в `MVP_BACKEND_ENV=production` с `MVP_STORAGE_DRIVER=postgres` и реальным доменом.
2. Задать реальные ключи SMS/Telegram/MAX/email и привязку Telegram/MAX-получателей для пилота.
3. Вынести документы водителей в private object storage и описать сроки хранения.
4. Постепенно заменить `jsonb` state на нормализованные таблицы пользователей, заказов, документов и платежей.
5. Подключить серверный геокодер, маршруты РФ и сервер сообщений.
6. Проверить сценарий удаления аккаунта на тестовых сборках и подготовить EAS Build.
