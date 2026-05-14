import { AccountRole } from './registration';
import { DashboardMetric, MenuActionTarget, MenuIconName, QuickAction } from './menu';

export type PageActionTarget = MenuActionTarget;

export type SectionRow = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  status: string;
};

export type SectionPage = {
  title: string;
  subtitle: string;
  icon: MenuIconName;
  statusTitle: string;
  statusText: string;
  primaryAction: string;
  primaryTarget?: PageActionTarget;
  secondaryAction: string;
  secondaryTarget?: PageActionTarget;
  metrics: DashboardMetric[];
  quickActions: QuickAction[];
  listTitle: string;
  rows: SectionRow[];
  note: string;
};

export const sectionPages: Record<AccountRole, Record<string, SectionPage>> = {
  client: {
    home: {
      title: 'Главная',
      subtitle: 'Быстрый заказ поездки и текущий статус аккаунта.',
      icon: 'home',
      statusTitle: 'Готовим первый заказ',
      statusText: 'После подтверждения телефона откроется выбор адресов и способа оплаты.',
      primaryAction: 'Выбрать маршрут',
      primaryTarget: 'order',
      secondaryAction: 'Добавить адрес',
      metrics: [
        { label: 'Статус', value: 'Новый', helper: 'Нужно подтверждение' },
        { label: 'Активная поездка', value: 'Нет', helper: 'Можно создать заказ' },
        { label: 'Адреса', value: '0', helper: 'Дом и работа не заданы' },
      ],
      quickActions: [
        {
          id: 'new-ride',
          title: 'Новая поездка',
          subtitle: 'Точка подачи, назначение и тариф.',
          icon: 'map',
          target: 'order',
        },
        {
          id: 'home-address',
          title: 'Дом',
          subtitle: 'Сохранить домашний адрес.',
          icon: 'star',
          target: 'homeAddress',
        },
        {
          id: 'share-invite',
          title: 'Инвайт-ссылка',
          subtitle: 'Открывает приложение или магазин.',
          icon: 'route',
        },
      ],
      listTitle: 'Ближайшие действия',
      rows: [
        {
          id: 'phone',
          title: 'Подтвердить телефон',
          subtitle: 'Одноразовый код нужен для безопасности аккаунта.',
          value: '1 мин',
          status: 'Обязательно',
        },
        {
          id: 'email',
          title: 'Подтвердить почту',
          subtitle: 'На почту придет ссылка или код подтверждения.',
          value: '1 мин',
          status: 'Рекомендуется',
        },
        {
          id: 'payment',
          title: 'Добавить оплату',
          subtitle: 'Карта, наличные или корпоративный способ оплаты.',
          value: '2 мин',
          status: 'По желанию',
        },
      ],
      note: 'На этой странице позже появится карта, выбор тарифа и расчет стоимости поездки.',
    },
    rides: {
      title: 'Мои поездки',
      subtitle: 'История заказов, чеки, маршруты и повтор поездки.',
      icon: 'route',
      statusTitle: 'Поездок пока нет',
      statusText: 'После первого заказа здесь появятся маршрут, водитель, чек и оценка.',
      primaryAction: 'Создать заказ',
      primaryTarget: 'order',
      secondaryAction: 'Открыть чеки',
      secondaryTarget: 'history',
      metrics: [
        { label: 'Всего поездок', value: '0', helper: 'История пустая' },
        { label: 'Последняя', value: '-', helper: 'Пока не было заказов' },
        { label: 'Чеки', value: '0', helper: 'Будут доступны после оплаты' },
      ],
      quickActions: [
        {
          id: 'repeat',
          title: 'Повторить маршрут',
          subtitle: 'Быстрый заказ по прошлому адресу.',
          icon: 'route',
          target: 'order',
        },
        {
          id: 'receipts',
          title: 'Чеки',
          subtitle: 'Документы по оплате поездок.',
          icon: 'file',
        },
        {
          id: 'rate',
          title: 'Оценки',
          subtitle: 'Отзывы о завершенных поездках.',
          icon: 'star',
        },
      ],
      listTitle: 'История поездок',
      rows: [
        {
          id: 'empty',
          title: 'История появится после первой поездки',
          subtitle: 'Здесь будут адреса, время подачи, водитель и стоимость.',
          value: '0 ₽',
          status: 'Пусто',
        },
      ],
      note: 'Для реального запуска этот раздел подключается к API поездок и платежным чекам.',
    },
    payment: {
      title: 'Оплата',
      subtitle: 'Карты, наличные, промокоды и платежные настройки.',
      icon: 'credit-card',
      statusTitle: 'Способ оплаты не выбран',
      statusText: 'Клиент сможет оплатить наличными или добавить карту после подключения платежного провайдера.',
      primaryAction: 'Добавить карту',
      secondaryAction: 'Ввести промокод',
      metrics: [
        { label: 'Карты', value: '0', helper: 'Нет сохраненных карт' },
        { label: 'Промокоды', value: '0', helper: 'Активных нет' },
        { label: 'Баланс', value: '0 ₽', helper: 'Бонусы появятся позже' },
      ],
      quickActions: [
        {
          id: 'add-card',
          title: 'Банковская карта',
          subtitle: 'Привязка через платежный шлюз.',
          icon: 'credit-card',
        },
        {
          id: 'cash',
          title: 'Наличные',
          subtitle: 'Оплата водителю после поездки.',
          icon: 'wallet',
        },
        {
          id: 'promo',
          title: 'Промокод',
          subtitle: 'Скидка или бонус на поездку.',
          icon: 'star',
        },
      ],
      listTitle: 'Платежные способы',
      rows: [
        {
          id: 'cash',
          title: 'Наличные',
          subtitle: 'Базовый способ оплаты без привязки карты.',
          value: 'Доступно',
          status: 'Активно',
        },
        {
          id: 'card',
          title: 'Банковская карта',
          subtitle: 'Нужна интеграция с платежным провайдером.',
          value: '0 карт',
          status: 'Не настроено',
        },
      ],
      note: 'Для App Store и Google Play важно раскрыть платежные условия и не хранить карточные данные напрямую.',
    },
    support: {
      title: 'Поддержка',
      subtitle: 'Обращения по поездкам, оплате, аккаунту и безопасности.',
      icon: 'headphones',
      statusTitle: 'Поддержка доступна',
      statusText: 'Можно открыть чат и написать поддержке прямо в приложении.',
      primaryAction: 'Написать поддержке',
      primaryTarget: 'supportChat',
      secondaryAction: 'Частые вопросы',
      metrics: [
        { label: 'Открытые', value: '0', helper: 'Нет активных обращений' },
        { label: 'Средний ответ', value: '-', helper: 'Задается службой поддержки' },
        { label: 'Категории', value: '4', helper: 'Поездка, оплата, профиль, безопасность' },
      ],
      quickActions: [
        {
          id: 'support-chat',
          title: 'Написать поддержке',
          subtitle: 'Открыть простой чат с оператором.',
          icon: 'headphones',
          target: 'supportChat',
        },
        {
          id: 'trip-issue',
          title: 'Проблема с поездкой',
          subtitle: 'Маршрут, водитель или стоимость.',
          icon: 'route',
        },
        {
          id: 'payment-issue',
          title: 'Оплата',
          subtitle: 'Чек, карта или списание.',
          icon: 'credit-card',
        },
        {
          id: 'safety',
          title: 'Безопасность',
          subtitle: 'Срочные и важные обращения.',
          icon: 'shield',
        },
      ],
      listTitle: 'Категории обращений',
      rows: [
        {
          id: 'ride',
          title: 'Поездка',
          subtitle: 'Вопросы по маршруту, ожиданию и завершению заказа.',
          value: '24/7',
          status: 'Доступно',
        },
        {
          id: 'account',
          title: 'Аккаунт',
          subtitle: 'Телефон, почта, вход и удаление профиля.',
          value: 'До 1 дня',
          status: 'Стандарт',
        },
      ],
      note: 'Позже здесь появятся чат, вложения и история обращений.',
    },
    profile: {
      title: 'Профиль',
      subtitle: 'Личные данные, безопасность аккаунта и управление данными.',
      icon: 'shield',
      statusTitle: 'Профиль создан',
      statusText: 'Для публикации в магазинах здесь нужен сценарий удаления аккаунта и данных.',
      primaryAction: 'Редактировать профиль',
      secondaryAction: 'Удалить аккаунт',
      metrics: [
        { label: 'Телефон', value: 'На проверке', helper: 'Нужен код' },
        { label: 'Почта', value: 'На проверке', helper: 'Нужна ссылка' },
        { label: 'Безопасность', value: 'Пароль', helper: 'Пароль только для приложения' },
      ],
      quickActions: [
        {
          id: 'edit',
          title: 'Личные данные',
          subtitle: 'Имя, фамилия, почта и телефон.',
          icon: 'shield',
        },
        {
          id: 'password',
          title: 'Пароль',
          subtitle: 'Смена пароля приложения.',
          icon: 'file',
        },
        {
          id: 'delete',
          title: 'Удаление аккаунта',
          subtitle: 'Обязательный сценарий для магазинов.',
          icon: 'shield',
        },
      ],
      listTitle: 'Настройки профиля',
      rows: [
        {
          id: 'personal',
          title: 'Персональные данные',
          subtitle: 'Редактирование базовых данных клиента.',
          value: 'Черновик',
          status: 'Заполнено',
        },
        {
          id: 'delete',
          title: 'Удаление аккаунта',
          subtitle: 'Запрос на удаление профиля и данных.',
          value: 'Нужно API',
          status: 'Важно',
        },
      ],
      note: 'Удаление аккаунта нужно реализовать до публикации, если регистрация остается в приложении.',
    },
  },
  driver: {
    subscription: {
      title: 'Подписка',
      subtitle: 'Главная модель сервиса: водитель платит за месяц доступа и работает без автопарка.',
      icon: 'wallet',
      statusTitle: 'Доступ к заказам открывается подпиской',
      statusText:
        'После проверки документов водитель оплачивает месяц доступа. Дальше он принимает заказы в приложении без комиссии сервиса с каждой поездки.',
      primaryAction: 'Оформить подписку',
      primaryTarget: 'subscription',
      secondaryAction: 'Посмотреть ленту',
      secondaryTarget: 'order',
      metrics: [
        { label: 'Стоимость', value: '4 990 ₽', helper: '30 дней доступа' },
        { label: 'Комиссия', value: '0%', helper: 'С заказа не удерживаем' },
        { label: 'Фокус сервиса', value: 'Трафик', helper: 'Привести клиентов водителю' },
      ],
      quickActions: [
        {
          id: 'pay',
          title: 'Оплатить месяц',
          subtitle: 'Открыть доступ к ленте заказов.',
          icon: 'wallet',
          target: 'subscription',
        },
        {
          id: 'orders',
          title: 'Лента заказов',
          subtitle: 'Проверить, как выглядит карточка заказа.',
          icon: 'briefcase',
          target: 'order',
        },
        {
          id: 'history',
          title: 'История',
          subtitle: 'Выполненные заказы и суммы.',
          icon: 'route',
          target: 'history',
        },
      ],
      listTitle: 'Как это работает',
      rows: [
        {
          id: 'verify',
          title: 'Проверка водителя',
          subtitle: 'Документы, автомобиль и реквизиты должны быть проверены до доступа.',
          value: 'Шаг 1',
          status: 'Обязательно',
        },
        {
          id: 'pay',
          title: 'Оплата месяца',
          subtitle: 'Фиксированная подписка заменяет комиссию и выплаты автопарку.',
          value: '4 990 ₽',
          status: 'Доступ',
        },
        {
          id: 'traffic',
          title: 'Заказы из приложения',
          subtitle: 'Сервис инвестирует в клиентов, удержание и плотность спроса.',
          value: '30 дней',
          status: 'Работа',
        },
      ],
      note: 'Ключевой риск модели: если сервис не дает водителю достаточно заказов, подписка быстро теряет ценность.',
    },
    orders: {
      title: 'Лента заказов',
      subtitle: 'Доступные заказы, фильтры, текущая смена и история выполнения после подписки.',
      icon: 'briefcase',
      statusTitle: 'Заказы закрыты до подписки',
      statusText: 'Сначала нужно подтвердить документы и оплатить месяц доступа. После этого водитель принимает заказы без комиссии сервиса.',
      primaryAction: 'Оформить подписку',
      primaryTarget: 'subscription',
      secondaryAction: 'Открыть демо-заказ',
      secondaryTarget: 'order',
      metrics: [
        { label: 'Доступ', value: 'Нет', helper: 'Нужна подписка' },
        { label: 'Смена', value: 'Закрыта', helper: 'Включится после допуска' },
        { label: 'Заказы', value: '0', helper: 'Лента пустая' },
      ],
      quickActions: [
        {
          id: 'requirements',
          title: 'Требования',
          subtitle: 'Что нужно для допуска к линии.',
          icon: 'shield',
        },
        {
          id: 'filters',
          title: 'Фильтры заказов',
          subtitle: 'Районы, тарифы и расстояние подачи.',
          icon: 'route',
        },
        {
          id: 'shift',
          title: 'Смена',
          subtitle: 'Выход на линию после одобрения.',
          icon: 'briefcase',
          target: 'order',
        },
      ],
      listTitle: 'Доступ к заказам',
      rows: [
        {
          id: 'subscription',
          title: 'Подписка на месяц',
          subtitle: 'Фиксированная оплата открывает ленту заказов без комиссии.',
          value: '0/1',
          status: 'Нужно',
        },
        {
          id: 'docs',
          title: 'Документы',
          subtitle: 'Паспорт и водительское удостоверение должны пройти проверку.',
          value: '0/2',
          status: 'Нужно',
        },
        {
          id: 'car',
          title: 'Автомобиль',
          subtitle: 'СТС, ОСАГО и данные автомобиля.',
          value: '0/3',
          status: 'Нужно',
        },
      ],
      note: 'После подключения API здесь появятся реальные заказы и управление сменой.',
    },
    documents: {
      title: 'Документы',
      subtitle: 'Паспорт, водительское удостоверение, СТС, ОСАГО и статусы проверки.',
      icon: 'file',
      statusTitle: 'Документы ждут загрузки',
      statusText: 'Файлы должны загружаться только через защищенный канал и храниться с ограниченным доступом.',
      primaryAction: 'Загрузить документы',
      secondaryAction: 'Посмотреть требования',
      metrics: [
        { label: 'Загружено', value: '0/4', helper: 'Нужны фото документов' },
        { label: 'Проверка', value: 'Не начата', helper: 'Старт после загрузки' },
        { label: 'Доступ', value: 'Нет', helper: 'До одобрения' },
      ],
      quickActions: [
        {
          id: 'passport',
          title: 'Паспорт',
          subtitle: 'Серия, номер и фото разворота.',
          icon: 'file',
        },
        {
          id: 'license',
          title: 'Водительское удостоверение',
          subtitle: 'Номер и фото обеих сторон.',
          icon: 'shield',
        },
        {
          id: 'insurance',
          title: 'ОСАГО',
          subtitle: 'Полис и срок действия.',
          icon: 'car',
        },
      ],
      listTitle: 'Пакет документов',
      rows: [
        {
          id: 'passport',
          title: 'Паспорт',
          subtitle: 'Серия и номер указаны при регистрации, нужен файл.',
          value: 'Нет файла',
          status: 'Нужно',
        },
        {
          id: 'license',
          title: 'Водительское удостоверение',
          subtitle: 'Проверяется номер, срок действия и фото.',
          value: 'Нет файла',
          status: 'Нужно',
        },
        {
          id: 'sts',
          title: 'СТС',
          subtitle: 'Проверка автомобиля и владельца.',
          value: 'Нет файла',
          status: 'Нужно',
        },
        {
          id: 'osago',
          title: 'ОСАГО',
          subtitle: 'Проверка действующего страхового полиса.',
          value: 'Нет файла',
          status: 'Нужно',
        },
      ],
      note: 'Этот экран дальше стоит связать с камерой, галереей и серверной модерацией.',
    },
    vehicle: {
      title: 'Автомобиль',
      subtitle: 'Марка, модель, цвет, госномер, документы и допуск к линии.',
      icon: 'car',
      statusTitle: 'Автомобиль не проверен',
      statusText: 'До проверки СТС и ОСАГО автомобиль нельзя выпускать на заказы.',
      primaryAction: 'Редактировать авто',
      secondaryAction: 'Загрузить СТС',
      metrics: [
        { label: 'Статус', value: 'Черновик', helper: 'Нужна проверка' },
        { label: 'Документы', value: '0/2', helper: 'СТС и ОСАГО' },
        { label: 'Допуск', value: 'Нет', helper: 'До модерации' },
      ],
      quickActions: [
        {
          id: 'car-info',
          title: 'Данные машины',
          subtitle: 'Марка, модель, цвет и номер.',
          icon: 'car',
        },
        {
          id: 'sts',
          title: 'СТС',
          subtitle: 'Свидетельство о регистрации.',
          icon: 'file',
        },
        {
          id: 'inspection',
          title: 'Осмотр',
          subtitle: 'Фото автомобиля перед допуском.',
          icon: 'shield',
        },
      ],
      listTitle: 'Проверка автомобиля',
      rows: [
        {
          id: 'plate',
          title: 'Госномер',
          subtitle: 'Номер должен совпадать с СТС.',
          value: 'Из анкеты',
          status: 'Черновик',
        },
        {
          id: 'insurance',
          title: 'ОСАГО',
          subtitle: 'Полис должен быть действующим.',
          value: 'Не проверено',
          status: 'Нужно',
        },
      ],
      note: 'Позже можно добавить классы авто: эконом, комфорт, бизнес, минивэн.',
    },
    payouts: {
      title: 'Выплаты',
      subtitle: 'Баланс, банковские реквизиты, история выплат и удержания.',
      icon: 'wallet',
      statusTitle: 'Реквизиты ожидают проверки',
      statusText: 'Выплаты включаются после проверки личности и банковских данных.',
      primaryAction: 'Добавить реквизиты',
      secondaryAction: 'История выплат',
      metrics: [
        { label: 'Баланс', value: '0 ₽', helper: 'Нет поездок' },
        { label: 'К выплате', value: '0 ₽', helper: 'Появится после заказов' },
        { label: 'Реквизиты', value: 'Черновик', helper: 'Нужна проверка' },
      ],
      quickActions: [
        {
          id: 'bank',
          title: 'Банк',
          subtitle: 'БИК, счет и получатель.',
          icon: 'wallet',
        },
        {
          id: 'history',
          title: 'История',
          subtitle: 'Начисления, удержания, переводы.',
          icon: 'file',
        },
        {
          id: 'tax',
          title: 'Документы',
          subtitle: 'Акты и финансовые отчеты.',
          icon: 'briefcase',
        },
      ],
      listTitle: 'Финансовые операции',
      rows: [
        {
          id: 'empty',
          title: 'Операций пока нет',
          subtitle: 'История выплат появится после выполненных заказов.',
          value: '0 ₽',
          status: 'Пусто',
        },
      ],
      note: 'Реквизиты и выплаты нужно валидировать на сервере, не только в приложении.',
    },
    rating: {
      title: 'Рейтинг',
      subtitle: 'Оценки пассажиров, качество поездок и рекомендации сервиса.',
      icon: 'star',
      statusTitle: 'Рейтинг появится позже',
      statusText: 'После первых поездок здесь появятся оценки, жалобы и подсказки по качеству.',
      primaryAction: 'Правила качества',
      secondaryAction: 'История оценок',
      metrics: [
        { label: 'Рейтинг', value: '-', helper: 'Нет оценок' },
        { label: 'Поездки', value: '0', helper: 'Нет завершенных' },
        { label: 'Жалобы', value: '0', helper: 'Нет обращений' },
      ],
      quickActions: [
        {
          id: 'quality',
          title: 'Качество',
          subtitle: 'Пунктуальность и аккуратность.',
          icon: 'star',
        },
        {
          id: 'feedback',
          title: 'Отзывы',
          subtitle: 'Комментарии пассажиров.',
          icon: 'headphones',
        },
        {
          id: 'recommendations',
          title: 'Рекомендации',
          subtitle: 'Как повысить рейтинг.',
          icon: 'shield',
        },
      ],
      listTitle: 'Показатели качества',
      rows: [
        {
          id: 'punctuality',
          title: 'Пунктуальность',
          subtitle: 'Подача автомобиля и отмены.',
          value: '-',
          status: 'Нет данных',
        },
        {
          id: 'comfort',
          title: 'Комфорт',
          subtitle: 'Оценки салона, маршрута и общения.',
          value: '-',
          status: 'Нет данных',
        },
      ],
      note: 'Этот раздел должен быть аккуратным: рейтинг влияет на доход водителя, значит нужны прозрачные правила.',
    },
    support: {
      title: 'Поддержка',
      subtitle: 'Помощь водителю по заказам, выплатам, документам и блокировкам.',
      icon: 'headphones',
      statusTitle: 'Канал поддержки готов',
      statusText: 'Водитель может написать поддержке прямо из приложения, а сервер сообщений заберет историю диалога.',
      primaryAction: 'Написать поддержке',
      primaryTarget: 'supportChat',
      secondaryAction: 'База знаний',
      metrics: [
        { label: 'Открытые', value: '0', helper: 'Нет обращений' },
        { label: 'Темы', value: '5', helper: 'Заказы, выплаты, документы' },
        { label: 'SLA', value: '-', helper: 'Настроить позже' },
      ],
      quickActions: [
        {
          id: 'support-chat',
          title: 'Написать поддержке',
          subtitle: 'Открыть чат по заказу, выплате или документам.',
          icon: 'headphones',
          target: 'supportChat',
        },
        {
          id: 'order',
          title: 'Проблема с заказом',
          subtitle: 'Пассажир, маршрут или отмена.',
          icon: 'briefcase',
        },
        {
          id: 'payout',
          title: 'Выплата',
          subtitle: 'Начисления и реквизиты.',
          icon: 'wallet',
        },
        {
          id: 'block',
          title: 'Блокировка',
          subtitle: 'Проверка статуса доступа.',
          icon: 'shield',
        },
      ],
      listTitle: 'Темы поддержки',
      rows: [
        {
          id: 'docs',
          title: 'Документы',
          subtitle: 'Ошибки загрузки и причины отказа.',
          value: 'До 1 дня',
          status: 'Стандарт',
        },
        {
          id: 'urgent',
          title: 'Срочная ситуация',
          subtitle: 'Безопасность на линии и конфликтные случаи.',
          value: '24/7',
          status: 'Важно',
        },
      ],
      note: 'Для водителей поддержку лучше делать видимой из каждого ключевого раздела.',
    },
  },
  fleet: {
    overview: {
      title: 'Обзор',
      subtitle: 'Состояние автопарка, подключение и основные показатели.',
      icon: 'home',
      statusTitle: 'Автопарк на модерации',
      statusText: 'После проверки организации откроется управление водителями и автомобилями.',
      primaryAction: 'Завершить проверку',
      secondaryAction: 'Пригласить водителя',
      metrics: [
        { label: 'Водители', value: '0', helper: 'Можно пригласить' },
        { label: 'Авто', value: '0', helper: 'Нужны документы' },
        { label: 'Статус', value: 'Модерация', helper: 'Проверка юрлица' },
      ],
      quickActions: [
        {
          id: 'invite',
          title: 'Пригласить водителя',
          subtitle: 'Отправить регистрационную ссылку.',
          icon: 'users',
        },
        {
          id: 'add-car',
          title: 'Добавить авто',
          subtitle: 'Создать карточку автомобиля.',
          icon: 'car',
        },
        {
          id: 'docs',
          title: 'Документы',
          subtitle: 'Юрданные и договоры.',
          icon: 'file',
        },
      ],
      listTitle: 'Сводка запуска',
      rows: [
        {
          id: 'company',
          title: 'Проверить организацию',
          subtitle: 'ИНН, ОГРН, адрес и реквизиты.',
          value: '0/4',
          status: 'Нужно',
        },
        {
          id: 'fleet',
          title: 'Добавить парк',
          subtitle: 'Водители и автомобили появятся после одобрения.',
          value: '0',
          status: 'Ожидает',
        },
      ],
      note: 'Обзор должен быстро показывать, почему автопарк еще не может выпускать машины на линию.',
    },
    drivers: {
      title: 'Водители',
      subtitle: 'Подключение, статусы, документы и доступ к заказам.',
      icon: 'users',
      statusTitle: 'Водителей пока нет',
      statusText: 'Партнер сможет пригласить водителя по ссылке после проверки автопарка.',
      primaryAction: 'Пригласить водителя',
      secondaryAction: 'Импортировать список',
      metrics: [
        { label: 'Всего', value: '0', helper: 'Нет подключенных' },
        { label: 'На линии', value: '0', helper: 'После допуска' },
        { label: 'Проверка', value: '0', helper: 'Нет заявок' },
      ],
      quickActions: [
        {
          id: 'invite',
          title: 'Инвайт',
          subtitle: 'Ссылка для регистрации водителя.',
          icon: 'users',
        },
        {
          id: 'statuses',
          title: 'Статусы',
          subtitle: 'Одобрен, проверка, блокировка.',
          icon: 'shield',
        },
        {
          id: 'documents',
          title: 'Документы',
          subtitle: 'Контроль пакета водителя.',
          icon: 'file',
        },
      ],
      listTitle: 'Список водителей',
      rows: [
        {
          id: 'empty',
          title: 'Список пуст',
          subtitle: 'После приглашения здесь появятся карточки водителей.',
          value: '0',
          status: 'Пусто',
        },
      ],
      note: 'У автопарка должны быть права видеть только водителей своей организации.',
    },
    cars: {
      title: 'Автомобили',
      subtitle: 'Карточки машин, документы, привязка водителей и допуск к линии.',
      icon: 'car',
      statusTitle: 'Автомобилей пока нет',
      statusText: 'Каждый автомобиль должен пройти проверку СТС, ОСАГО и основных данных.',
      primaryAction: 'Добавить автомобиль',
      secondaryAction: 'Загрузить документы',
      metrics: [
        { label: 'Всего', value: '0', helper: 'Нет машин' },
        { label: 'Допущено', value: '0', helper: 'Нужна проверка' },
        { label: 'Документы', value: '0', helper: 'Нет файлов' },
      ],
      quickActions: [
        {
          id: 'create',
          title: 'Новая машина',
          subtitle: 'Марка, модель, год, номер.',
          icon: 'car',
        },
        {
          id: 'docs',
          title: 'СТС и ОСАГО',
          subtitle: 'Загрузка и сроки действия.',
          icon: 'file',
        },
        {
          id: 'drivers',
          title: 'Назначить водителя',
          subtitle: 'Связать машину с водителем.',
          icon: 'users',
        },
      ],
      listTitle: 'Автомобили автопарка',
      rows: [
        {
          id: 'empty',
          title: 'Автомобилей нет',
          subtitle: 'Добавьте первую машину и загрузите документы.',
          value: '0',
          status: 'Пусто',
        },
      ],
      note: 'Позже стоит добавить массовый импорт автомобилей и напоминания о сроках ОСАГО.',
    },
    finance: {
      title: 'Финансы',
      subtitle: 'Выплаты, комиссии, акты, отчеты и банковские реквизиты.',
      icon: 'wallet',
      statusTitle: 'Финансы не активированы',
      statusText: 'Расчеты станут доступны после проверки организации и договора.',
      primaryAction: 'Добавить реквизиты',
      secondaryAction: 'Скачать отчет',
      metrics: [
        { label: 'Баланс', value: '0 ₽', helper: 'Нет поездок' },
        { label: 'К выплате', value: '0 ₽', helper: 'Нет начислений' },
        { label: 'Комиссия', value: '-', helper: 'По договору' },
      ],
      quickActions: [
        {
          id: 'bank',
          title: 'Реквизиты',
          subtitle: 'Расчетный счет организации.',
          icon: 'wallet',
        },
        {
          id: 'reports',
          title: 'Отчеты',
          subtitle: 'Период, водители, удержания.',
          icon: 'file',
        },
        {
          id: 'acts',
          title: 'Акты',
          subtitle: 'Закрывающие документы.',
          icon: 'briefcase',
        },
      ],
      listTitle: 'Финансовая история',
      rows: [
        {
          id: 'empty',
          title: 'Начислений пока нет',
          subtitle: 'После поездок здесь появятся операции автопарка.',
          value: '0 ₽',
          status: 'Пусто',
        },
      ],
      note: 'Финансы автопарка требуют серверной модели ролей и прав доступа.',
    },
    documents: {
      title: 'Документы',
      subtitle: 'Договоры, данные организации, лицензии и юридические файлы.',
      icon: 'file',
      statusTitle: 'Юридические документы не проверены',
      statusText: 'До одобрения нужны ИНН, ОГРН, адрес, реквизиты и договорные документы.',
      primaryAction: 'Загрузить документы',
      secondaryAction: 'Редактировать данные',
      metrics: [
        { label: 'Пакет', value: '0/4', helper: 'Нужна загрузка' },
        { label: 'Проверка', value: 'Не начата', helper: 'После отправки' },
        { label: 'Договор', value: 'Черновик', helper: 'Нужна подпись' },
      ],
      quickActions: [
        {
          id: 'company',
          title: 'Данные организации',
          subtitle: 'ИНН, ОГРН, адрес.',
          icon: 'briefcase',
        },
        {
          id: 'contract',
          title: 'Договор',
          subtitle: 'Файл и статус подписания.',
          icon: 'file',
        },
        {
          id: 'bank',
          title: 'Реквизиты',
          subtitle: 'Счет для выплат и актов.',
          icon: 'wallet',
        },
      ],
      listTitle: 'Юридический пакет',
      rows: [
        {
          id: 'inn',
          title: 'ИНН и ОГРН',
          subtitle: 'Проверка регистрационных данных.',
          value: 'Из анкеты',
          status: 'Черновик',
        },
        {
          id: 'contract',
          title: 'Договор',
          subtitle: 'Документ для подключения автопарка.',
          value: 'Нет файла',
          status: 'Нужно',
        },
      ],
      note: 'Раздел должен хранить историю версий договоров и статусы согласования.',
    },
    notifications: {
      title: 'Уведомления',
      subtitle: 'Проверки, блокировки, события автопарка и системные сообщения.',
      icon: 'bell',
      statusTitle: 'Уведомления готовы к настройке',
      statusText: 'После подключения push-сервиса сюда придут события по водителям, машинам и выплатам.',
      primaryAction: 'Настроить push',
      secondaryAction: 'История событий',
      metrics: [
        { label: 'Новые', value: '0', helper: 'Нет событий' },
        { label: 'Критичные', value: '0', helper: 'Нет блокировок' },
        { label: 'Каналы', value: 'Push', helper: 'Плюс email позже' },
      ],
      quickActions: [
        {
          id: 'push',
          title: 'Push',
          subtitle: 'Настройки мобильных уведомлений.',
          icon: 'bell',
        },
        {
          id: 'events',
          title: 'События',
          subtitle: 'Проверки и статусы объектов.',
          icon: 'shield',
        },
        {
          id: 'reports',
          title: 'Отчеты',
          subtitle: 'Сводка за период.',
          icon: 'file',
        },
      ],
      listTitle: 'Последние события',
      rows: [
        {
          id: 'empty',
          title: 'Событий пока нет',
          subtitle: 'История появится после подключения водителей и машин.',
          value: '0',
          status: 'Пусто',
        },
      ],
      note: 'Push-уведомления нужно подключать отдельно для iOS и Android через Expo Notifications или нативный сервис.',
    },
  },
};
