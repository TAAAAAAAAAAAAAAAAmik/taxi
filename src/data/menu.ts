import { AccountRole } from './registration';

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
  | 'history'
  | 'homeAddress'
  | 'none'
  | 'order'
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

export const roleMenuConfig: Record<AccountRole, RoleMenuConfig> = {
  client: {
    title: 'Меню клиента',
    subtitle: 'Заказы, адреса, оплата и поддержка в одном кабинете.',
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
        title: 'Оплата',
        subtitle: 'Карты, наличные, промокоды',
        icon: 'credit-card',
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
        value: 'Не задана',
        helper: 'Можно добавить карту',
      },
    ],
  },
  driver: {
    title: 'Меню водителя',
    subtitle: 'Подписка, заказы, документы, выплаты и профиль водителя-партнера.',
    statusTitle: 'Доступ к заказам по подписке',
    statusText: 'Водитель оплачивает месяц доступа и принимает заказы без комиссии сервиса.',
    primaryAction: 'Оформить подписку',
    secondaryAction: 'Посмотреть заказы',
    menuItems: [
      {
        id: 'subscription',
        title: 'Подписка',
        subtitle: 'Месяц доступа, 0% комиссии с заказов',
        icon: 'wallet',
        badge: 'Главное',
      },
      {
        id: 'orders',
        title: 'Лента заказов',
        subtitle: 'Доступна после подписки и проверки',
        icon: 'briefcase',
        badge: 'После оплаты',
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
    ],
    quickActions: [
      {
        id: 'upload-documents',
        title: 'Документы на проверку',
        subtitle: 'Фото паспорта, ВУ, СТС и ОСАГО.',
        icon: 'file',
      },
      {
        id: 'subscription',
        title: 'Месячный доступ',
        subtitle: 'Оплата подписки открывает заказы.',
        icon: 'wallet',
        target: 'subscription',
      },
      {
        id: 'bank-details',
        title: 'Реквизиты выплат',
        subtitle: 'Банк, БИК и счет для переводов.',
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
        label: 'Подписка',
        value: 'Не активна',
        helper: 'Нужна оплата месяца',
      },
      {
        label: 'Баланс',
        value: '0 ₽',
        helper: 'Все заказы без комиссии',
      },
      {
        label: 'Комиссия',
        value: '0%',
        helper: 'После оплаты доступа',
      },
    ],
  },
  fleet: {
    title: 'Меню автопарка',
    subtitle: 'Управление водителями, автомобилями, документами и выплатами.',
    statusTitle: 'Проверка партнера',
    statusText: 'После проверки юрлица откроется подключение водителей и автомобилей.',
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
    ],
    quickActions: [
      {
        id: 'invite-driver',
        title: 'Пригласить водителя',
        subtitle: 'Отправка ссылки на регистрацию.',
        icon: 'users',
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
        helper: 'Юрданные проверяются',
      },
    ],
  },
};
