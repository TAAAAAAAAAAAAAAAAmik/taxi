export type MenuIconName =
  | 'bell'
  | 'briefcase'
  | 'car'
  | 'credit-card'
  | 'file'
  | 'headphones'
  | 'home'
  | 'map'
  | 'route'
  | 'shield'
  | 'star'
  | 'users'
  | 'wallet';

export type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: MenuIconName;
  badge?: string;
};

export type MenuActionTarget =
  | 'deleteAccount'
  | 'fleetDriverInvite'
  | 'history'
  | 'documents'
  | 'homeAddress'
  | 'none'
  | 'order'
  | 'referral'
  | 'registration'
  | 'subscription'
  | 'supportChat';

export type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  icon: MenuIconName;
  target?: MenuActionTarget;
};

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

export type RoleMenuConfig = {
  title: string;
  subtitle: string;
  statusTitle: string;
  statusText: string;
  primaryAction: string;
  secondaryAction: string;
  menuItems: MenuItem[];
  quickActions: QuickAction[];
  metrics: DashboardMetric[];
};

export const roleMenuConfig: Record<string, RoleMenuConfig> = {
  client: {
    title: 'Меню клиента',
    subtitle: 'Главная, вызов такси, адреса и поддержка в одном кабинете.',
    statusTitle: 'Аккаунт почти готов',
    statusText: 'После подтверждения телефона и почты клиент сможет заказать первую поездку.',
    primaryAction: 'Заказать поездку',
    secondaryAction: 'Добавить адрес',
    menuItems: [
      {
        id: 'home',
        title: 'Главная',
        subtitle: 'Быстрый заказ и текущая поездка',
        icon: 'home',
      },
      {
        id: 'rides',
        title: 'Мои поездки',
        subtitle: 'История, чеки и повтор заказа',
        icon: 'route',
      },
      {
        id: 'payment',
        title: 'Оплата водителю',
        subtitle: 'Клиент платит водителю напрямую',
        icon: 'wallet',
      },
      {
        id: 'referrals',
        title: 'Пригласить',
        subtitle: 'Код, ссылка и бонусы за друзей',
        icon: 'users',
        badge: 'Бонусы',
      },
      {
        id: 'support',
        title: 'Поддержка',
        subtitle: 'Вопросы по поездкам и профилю',
        icon: 'headphones',
      },
      {
        id: 'profile',
        title: 'Профиль',
        subtitle: 'Данные аккаунта и удаление профиля',
        icon: 'shield',
      },
    ],
    quickActions: [
      {
        id: 'order',
        title: 'Новая поездка',
        subtitle: 'Выбор точки подачи и назначения.',
        icon: 'map',
        target: 'order',
      },
      {
        id: 'saved-places',
        title: 'Избранные адреса',
        subtitle: 'Дом, работа и частые маршруты.',
        icon: 'star',
      },
      {
        id: 'support-ticket',
        title: 'Обращение',
        subtitle: 'Связь с поддержкой по поездке.',
        icon: 'headphones',
        target: 'supportChat',
      },
      {
        id: 'referral',
        title: 'Пригласить',
        subtitle: 'Код, ссылка и бонусы за клиентов и водителей.',
        icon: 'users',
        target: 'referral',
      },
    ],
    metrics: [
      {
        label: 'Статус',
        value: 'Новый',
        helper: 'Нужно подтверждение',
      },
      {
        label: 'Поездки',
        value: '0',
        helper: 'История появится после заказа',
      },
      {
        label: 'Оплата',
        value: 'Водителю',
        helper: 'Без платежной системы',
      },
    ],
  },
  driver: {
    title: 'Меню водителя',
    subtitle: 'Расчеты, заказы, документы, сверка дня и профиль водителя-партнера.',
    statusTitle: 'Доступ к заказам и сверка',
    statusText: 'Клиент платит водителю напрямую, сервис считает 7% к вечернему переводу.',
    primaryAction: 'Открыть расчеты',
    secondaryAction: 'Посмотреть заказы',
    menuItems: [
      {
        id: 'subscription',
        title: 'Расчеты',
        subtitle: '0 ₽/мес, 7% к переводу',
        icon: 'wallet',
        badge: 'Главное',
      },
      {
        id: 'orders',
        title: 'Лента заказов',
        subtitle: 'Доступна после проверки и допуска',
        icon: 'briefcase',
        badge: 'После допуска',
      },
      {
        id: 'documents',
        title: 'Документы',
        subtitle: 'Паспорт, ВУ, СТС, ОСАГО',
        icon: 'file',
      },
      {
        id: 'vehicle',
        title: 'Автомобиль',
        subtitle: 'Данные машины и статус проверки',
        icon: 'car',
      },
      {
        id: 'payouts',
        title: 'Сверка дня',
        subtitle: 'Собрано, к переводу, подтверждения',
        icon: 'wallet',
      },
      {
        id: 'rating',
        title: 'Рейтинг',
        subtitle: 'Оценки, качество, рекомендации',
        icon: 'star',
      },
      {
        id: 'support',
        title: 'Поддержка',
        subtitle: 'Помощь водителю и спорные поездки',
        icon: 'headphones',
      },
      {
        id: 'profile',
        title: 'Профиль',
        subtitle: 'Данные аккаунта и удаление',
        icon: 'shield',
      },
    ],
    quickActions: [
      {
        id: 'upload-documents',
        title: 'Документы на проверку',
        subtitle: 'Фото паспорта, ВУ, СТС и ОСАГО.',
        icon: 'file',
        target: 'documents',
      },
      {
        id: 'subscription',
        title: 'Расчеты',
        subtitle: 'Доля сервиса по завершенным поездкам.',
        icon: 'wallet',
        target: 'subscription',
      },
      {
        id: 'bank-details',
        title: 'Перевод доли',
        subtitle: 'Сумма к вечерней сверке.',
        icon: 'wallet',
      },
      {
        id: 'safety',
        title: 'Правила сервиса',
        subtitle: 'Требования к поездкам и безопасности.',
        icon: 'shield',
      },
    ],
    metrics: [
      {
        label: 'Доля сервиса',
        value: '7%',
        helper: 'К переводу за день',
      },
      {
        label: 'Собрано',
        value: '0 ₽',
        helper: 'После выполненных заказов',
      },
      {
        label: 'К переводу',
        value: '0 ₽',
        helper: 'После завершения поездок',
      },
    ],
  },
  fleet: {
    title: 'Меню таксопарка',
    subtitle: 'ИП, водители, автомобили, документы и ручная сверка.',
    statusTitle: 'Проверка партнера',
    statusText: 'После проверки ИП откроется подключение водителей и автомобилей.',
    primaryAction: 'Добавить водителя',
    secondaryAction: 'Добавить автомобиль',
    menuItems: [
      {
        id: 'overview',
        title: 'Обзор',
        subtitle: 'Статус автопарка и показатели',
        icon: 'home',
      },
      {
        id: 'drivers',
        title: 'Водители',
        subtitle: 'Подключение, статусы, документы',
        icon: 'users',
      },
      {
        id: 'cars',
        title: 'Автомобили',
        subtitle: 'СТС, ОСАГО, допуск к линии',
        icon: 'car',
      },
      {
        id: 'finance',
        title: 'Финансы',
        subtitle: 'Выплаты, комиссии, акты',
        icon: 'wallet',
      },
      {
        id: 'documents',
        title: 'Документы',
        subtitle: 'Договоры и данные организации',
        icon: 'file',
      },
      {
        id: 'notifications',
        title: 'Уведомления',
        subtitle: 'Проверки, блокировки, события',
        icon: 'bell',
      },
      {
        id: 'profile',
        title: 'Профиль',
        subtitle: 'Данные аккаунта и удаление',
        icon: 'shield',
      },
    ],
    quickActions: [
      {
        id: 'invite-driver',
        title: 'Пригласить водителя',
        subtitle: 'Отправка ссылки на регистрацию.',
        icon: 'users',
        target: 'fleetDriverInvite',
      },
      {
        id: 'add-car',
        title: 'Новый автомобиль',
        subtitle: 'Марка, модель, госномер и документы.',
        icon: 'car',
      },
      {
        id: 'finance-report',
        title: 'Финансовый отчет',
        subtitle: 'Сводка выплат и удержаний.',
        icon: 'wallet',
      },
    ],
    metrics: [
      {
        label: 'Водители',
        value: '0',
        helper: 'Можно пригласить',
      },
      {
        label: 'Автомобили',
        value: '0',
        helper: 'Нужна проверка',
      },
      {
        label: 'Статус',
        value: 'Модерация',
        helper: 'ИП проверяется',
      },
    ],
  },
};

roleMenuConfig.client = {
  ...roleMenuConfig.client,
  title: 'Клиент',
  subtitle: 'Заказ всегда под рукой, а история, оплата, рефералы, поддержка и профиль остаются в отдельных разделах.',
  primaryAction: 'Заказать поездку',
  secondaryAction: 'История',
  menuItems: [
    {
      id: 'home',
      title: 'Главная',
      subtitle: 'Куда едем, активный заказ и быстрые действия',
      icon: 'home',
    },
    {
      id: 'rides',
      title: 'Заказы',
      subtitle: 'Заказать поездку, активный заказ и история',
      icon: 'route',
    },
    {
      id: 'payment',
      title: 'Оплата',
      subtitle: 'Оплата водителю напрямую и правила поездки',
      icon: 'wallet',
    },
    {
      id: 'referrals',
      title: 'Рефералы',
      subtitle: 'Код, ссылка и бонусы',
      icon: 'users',
      badge: 'Бонусы',
    },
    {
      id: 'support',
      title: 'Поддержка',
      subtitle: 'Вопросы по поездкам и профилю',
      icon: 'headphones',
    },
    {
      id: 'profile',
      title: 'Профиль',
      subtitle: 'Данные клиента и сохраненные адреса',
      icon: 'shield',
    },
  ],
};

roleMenuConfig.driver = {
  ...roleMenuConfig.driver,
  title: 'Водитель',
  subtitle: 'Главное как в водительском приложении: линия, заказы, доход, тариф, документы и поддержка в отдельных разделах.',
  primaryAction: 'Смотреть заказы',
  secondaryAction: 'Доход',
  menuItems: [
    {
      id: 'orders',
      title: 'Заказы',
      subtitle: 'Доступные, активные и история',
      icon: 'briefcase',
      badge: 'Работа',
    },
    {
      id: 'payouts',
      title: 'Доход',
      subtitle: 'Дневной заработок и комиссия к оплате',
      icon: 'wallet',
    },
    {
      id: 'subscription',
      title: 'Тариф',
      subtitle: 'Trial, комиссия 7/5/3% и Партнер PRO',
      icon: 'credit-card',
    },
    {
      id: 'documents',
      title: 'Документы',
      subtitle: 'Паспорт, ВУ, СТС, ОСАГО и проверка',
      icon: 'file',
    },
    {
      id: 'vehicle',
      title: 'Авто',
      subtitle: 'Данные машины и статус допуска',
      icon: 'car',
    },
    {
      id: 'referrals',
      title: 'Рефералы',
      subtitle: 'Приглашенные водители и бонус 200 ₽',
      icon: 'users',
    },
    {
      id: 'rating',
      title: 'Рейтинг',
      subtitle: 'Оценки, качество и рекомендации',
      icon: 'star',
    },
    {
      id: 'support',
      title: 'Поддержка',
      subtitle: 'Помощь водителю и спорные поездки',
      icon: 'headphones',
    },
    {
      id: 'profile',
      title: 'Профиль',
      subtitle: 'Данные аккаунта и настройки',
      icon: 'shield',
    },
  ],
  quickActions: [
    ...roleMenuConfig.driver.quickActions,
    {
      id: 'driver-referrals',
      title: 'Рефералы',
      subtitle: 'Бонус 200 ₽ после 10 завершенных поездок приглашенного водителя.',
      icon: 'users',
      target: 'referral',
    },
  ],
};

roleMenuConfig.self_employed_driver = roleMenuConfig.driver;
roleMenuConfig.park_admin = roleMenuConfig.fleet;
roleMenuConfig.park_driver = {
  ...roleMenuConfig.driver,
  title: 'Меню водителя таксопарка',
  subtitle: 'Заказы, документы, выплаты и связь с вашим таксопарком.',
  statusTitle: 'Доступ зависит от таксопарка',
  statusText: 'Заказы доступны, если таксопарк активирован вручную, водитель активен и документы валидны.',
  primaryAction: 'Посмотреть заказы',
  secondaryAction: 'Мой таксопарк',
  menuItems: [
    {
      id: 'orders',
      title: 'Лента заказов',
      subtitle: 'Доступ через активный таксопарк',
      icon: 'briefcase',
      badge: 'Работа',
    },
    {
      id: 'documents',
      title: 'Документы',
      subtitle: 'Паспорт, ВУ, СТС, ОСАГО',
      icon: 'file',
    },
    {
      id: 'vehicle',
      title: 'Автомобиль',
      subtitle: 'Данные машины и статус проверки',
      icon: 'car',
    },
    {
      id: 'payouts',
      title: 'Выплаты',
      subtitle: 'Баланс, реквизиты, история',
      icon: 'wallet',
    },
    {
      id: 'support',
      title: 'Поддержка',
      subtitle: 'Связь с парком и сервисом',
      icon: 'headphones',
    },
    {
      id: 'profile',
      title: 'Профиль',
      subtitle: 'Данные аккаунта и удаление',
      icon: 'shield',
    },
  ],
  metrics: [
    { label: 'Таксопарк', value: 'Привязан', helper: 'Доступ через парк' },
    { label: 'Документы', value: 'Проверка', helper: 'Нужна валидация' },
    { label: 'Комиссия', value: '0%', helper: 'По договору парка' },
  ],
};
