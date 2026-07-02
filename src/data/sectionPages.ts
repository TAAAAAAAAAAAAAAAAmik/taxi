import { DashboardMetric, MenuActionTarget, MenuIconName, QuickAction } from './menu';
import { driverAccessPlans } from './subscription';

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

export const sectionPages: Record<string, Record<string, SectionPage>> = {
  client: {
    home: {
      title: 'Главная',
      subtitle: 'Кнопка вызова, адреса района и статус аккаунта.',
      icon: 'home',
      statusTitle: 'Готовим первый заказ',
      statusText: 'С главной такси вызывается одной кнопкой.',
      primaryAction: 'Вызвать такси',
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
          target: 'referral',
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
          title: 'Оплата водителю',
          subtitle: 'В пилоте клиент оплачивает поездку напрямую водителю.',
          value: 'Без карты',
          status: 'Пилот',
        },
      ],
      note: 'Сначала кнопка вызова, затем выбор маршрута.',
    },
    rides: {
      title: 'Мои поездки',
      subtitle: 'История заказов, маршруты, стоимость и повтор поездки.',
      icon: 'route',
      statusTitle: 'Поездок пока нет',
      statusText: 'После заказа появятся маршрут, водитель и цена.',
      primaryAction: 'Создать заказ',
      primaryTarget: 'order',
      secondaryAction: 'Открыть чеки',
      secondaryTarget: 'history',
      metrics: [
        { label: 'Всего поездок', value: '0', helper: 'История пустая' },
        { label: 'Последняя', value: '-', helper: 'Пока не было заказов' },
        { label: 'Расчет', value: '0 ₽', helper: 'Оплата водителю' },
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
          title: 'Стоимость',
          subtitle: 'Сумма поездки и способ оплаты водителю.',
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
      note: 'Прозрачная история поездок без хранения карт.',
    },
    payment: {
      title: 'Оплата водителю',
      subtitle: 'Клиент платит водителю напрямую после поездки.',
      icon: 'wallet',
      statusTitle: 'Платежная система не используется',
      statusText: 'Оплату получает водитель напрямую, сервис хранит только сумму.',
      primaryAction: 'Вызвать такси',
      primaryTarget: 'order',
      secondaryAction: 'История поездок',
      secondaryTarget: 'history',
      metrics: [
        { label: 'Карты', value: 'Нет', helper: 'Не храним платежные данные' },
        { label: 'Промокоды', value: '0', helper: 'Активных нет' },
        { label: 'Баланс', value: '0 ₽', helper: 'Только внутренние бонусы' },
      ],
      quickActions: [
        {
          id: 'new-order',
          title: 'Вызвать такси',
          subtitle: 'Перейти к маршруту и тарифу.',
          icon: 'map',
          target: 'order',
        },
        {
          id: 'cash',
          title: 'Напрямую водителю',
          subtitle: 'Наличные или перевод по договоренности с водителем.',
          icon: 'wallet',
        },
        {
          id: 'promo',
          title: 'Промокод',
          subtitle: 'Скидка или бонус на поездку.',
          icon: 'star',
        },
      ],
      listTitle: 'Как проходит расчет',
      rows: [
        {
          id: 'cash',
          title: 'Оплата водителю',
          subtitle: 'Клиент платит водителю напрямую после поездки.',
          value: 'Доступно',
          status: 'Активно',
        },
        {
          id: 'no-provider',
          title: 'Без онлайн-оплаты',
          subtitle: 'Банковские карты и списания внутри приложения не используются.',
          value: '0 карт',
          status: 'Отключено',
        },
      ],
      note: 'Приложение считает поездку, оплату принимает водитель.',
    },
    referrals: {
      title: 'Пригласить',
      subtitle: 'Личная ссылка, код и бонусы за клиентов и водителей.',
      icon: 'users',
      statusTitle: 'Реферальная система готова к пилоту',
      statusText:
        'Приглашайте по ссылке или коду. Бонус — после 5 поездок клиента или 10 поездок водителя.',
      primaryAction: 'Открыть кабинет',
      primaryTarget: 'referral',
      secondaryAction: 'Новая поездка',
      secondaryTarget: 'order',
      metrics: [
        { label: 'За клиента', value: '60 ₽', helper: 'После 5 поездок' },
        { label: 'За водителя', value: '200 ₽', helper: 'После 10 заказов' },
      ],
      quickActions: [
        {
          id: 'open-referrals',
          title: 'Мой код',
          subtitle: 'Показать ссылку, код и историю бонусов.',
          icon: 'users',
          target: 'referral',
        },
        {
          id: 'client-rule',
          title: 'Пригласить клиента',
          subtitle: 'Пригласивший получает бонус после активных поездок клиента.',
          icon: 'route',
          target: 'referral',
        },
        {
          id: 'driver-rule',
          title: 'Пригласить водителя',
          subtitle: 'Повышенная награда за рабочий supply.',
          icon: 'car',
          target: 'referral',
        },
      ],
      listTitle: 'Механика начисления',
      rows: [
        {
          id: 'client',
          title: 'Приглашенный клиент',
          subtitle: 'Пригласивший получает бонус после 5 завершенных поездок клиента.',
          value: '60 ₽',
          status: 'Массово',
        },
        {
          id: 'driver',
          title: 'Приглашенный водитель',
          subtitle: 'Пробный доступ после проверки; бонус — после 10 заказов.',
          value: '200 ₽',
          status: 'Ценно',
        },
      ],
      note: 'Бонусы пока живут внутри приложения.',
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
          supportCategory: 'Поездка',
          target: 'supportChat',
        },
        {
          id: 'payment-issue',
          title: 'Оплата',
          subtitle: 'Чек, карта или списание.',
          icon: 'credit-card',
          supportCategory: 'Оплата',
          target: 'supportChat',
        },
        {
          id: 'safety',
          title: 'Безопасность',
          subtitle: 'Срочные и важные обращения.',
          icon: 'shield',
          supportCategory: 'Безопасность',
          target: 'supportChat',
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
      statusText: 'Можно изменить данные или удалить аккаунт.',
      primaryAction: 'Редактировать профиль',
      secondaryAction: 'Удалить аккаунт',
      secondaryTarget: 'deleteAccount',
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
          subtitle: 'Удалить профиль и связанные персональные данные.',
          icon: 'shield',
          target: 'deleteAccount',
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
          value: 'API',
          status: 'Доступно',
        },
      ],
      note: 'Удаление профиля стирает связанные данные.',
    },
  },
  driver: {
    home: {
      title: 'Главная',
      subtitle: 'Линия, лента, расчёт и статистика.',
      icon: 'home',
      statusTitle: 'Рабочий экран водителя',
      statusText: 'Главные действия — здесь, остальное — в меню.',
      primaryAction: 'Выйти на линию',
      secondaryAction: 'Лента заказов',
      secondaryTarget: 'order',
      metrics: [
        { label: 'Смена', value: 'Готово', helper: 'Включается кнопкой' },
        { label: 'Лента', value: 'Рядом', helper: 'Короткие карточки' },
        { label: 'Сверка', value: 'День', helper: 'Оплата сервиса' },
      ],
      quickActions: [
        {
          id: 'orders',
          title: 'Лента заказов',
          subtitle: 'Расстояние, адрес, цена и принятие.',
          icon: 'briefcase',
          target: 'order',
        },
        {
          id: 'settlement',
          title: 'Расчитаться',
          subtitle: 'Сумма к оплате и статус сверки.',
          icon: 'wallet',
          target: 'subscription',
        },
      ],
      listTitle: 'Сегодня',
      rows: [
        {
          id: 'line',
          title: 'Линия',
          subtitle: 'Водитель сам включает смену, когда готов принимать заказы.',
          value: 'Кнопка',
          status: 'Главное',
        },
      ],
      note: 'Остальные функции — в меню с тремя линиями.',
    },
    subscription: {
      title: 'Тариф и расчеты',
      subtitle: 'Дневной доступ за 120 ₽ или Партнёр PRO за 3 290 ₽.',
      icon: 'wallet',
      statusTitle: 'Доступ к заказам открывается после допуска',
      statusText:
        'После проверки водитель выбирает дневной доступ или подключает Партнёр PRO.',
      primaryAction: 'Подключить тариф',
      primaryTarget: 'subscription',
      secondaryAction: 'Посмотреть ленту',
      secondaryTarget: 'order',
      metrics: [
        { label: 'Партнёр PRO', value: '3 290 ₽', helper: '30 дней доступа' },
        { label: 'Дневной доступ', value: '120 ₽', helper: '24 часа на линии' },
        { label: 'Проценты', value: 'Нет', helper: 'С заказов ничего не удерживается' },
      ],
      quickActions: [
        {
          id: 'pay',
          title: 'Расчеты',
          subtitle: 'Посмотреть долю сервиса к переводу.',
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
          title: 'Дневной доступ',
          subtitle: 'Клиент платит водителю напрямую, сервис не считает процент с поездки.',
          value: '120 ₽',
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
      note: 'Сначала проверка документов, потом оплата доступа.',
    },
    orders: {
      title: 'Лента заказов',
      subtitle: 'Заказы, фильтры, смена и история.',
      icon: 'briefcase',
      statusTitle: 'Заказы закрыты до допуска',
      statusText: 'Сначала проверка документов, потом приём заказов.',
      primaryAction: 'Открыть расчеты',
      primaryTarget: 'subscription',
      secondaryAction: 'Открыть демо-заказ',
      secondaryTarget: 'order',
      metrics: [
        { label: 'Доступ', value: 'Нет', helper: 'Нужен допуск' },
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
          id: 'access',
            title: 'Модель расчетов',
            subtitle: 'Дневной доступ 120 ₽ или Партнёр PRO 3 290 ₽/мес.',
            value: 'День/PRO',
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
        note: 'Скоро здесь появятся реальные заказы и смена.',
    },
    documents: {
      title: 'Документы',
      subtitle: 'Паспорт, водительское удостоверение, СТС, ОСАГО и статусы проверки.',
      icon: 'file',
      statusTitle: 'Документы ждут загрузки',
      statusText: 'Файлы передаются по защищённому каналу.',
      primaryAction: 'Загрузить документы',
      primaryTarget: 'documents',
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
          target: 'documents',
        },
        {
          id: 'license',
          title: 'Водительское удостоверение',
          subtitle: 'Номер и фото обеих сторон.',
          icon: 'shield',
          target: 'documents',
        },
        {
          id: 'insurance',
          title: 'ОСАГО',
          subtitle: 'Полис и срок действия.',
          icon: 'car',
          target: 'documents',
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
      note: 'Файлы уходят на проверку.',
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
      note: 'Позже добавим классы авто: эконом, комфорт, бизнес.',
    },
    payouts: {
      title: 'Сверка дня',
      subtitle: 'Собрано, к переводу сервису и что подтверждено.',
      icon: 'wallet',
      statusTitle: 'Доля сервиса ожидает закрытия',
      statusText: 'Долю сервиса водитель переводит в конце дня.',
      primaryAction: 'Открыть расчеты',
      secondaryAction: 'История заказов',
      metrics: [
        { label: 'Собрано', value: '0 ₽', helper: 'Нет поездок' },
        { label: 'К переводу', value: '0 ₽', helper: 'Появится после заказов' },
        { label: 'Статус', value: 'Открыто', helper: 'Сверка дня' },
      ],
      quickActions: [
        {
          id: 'bank',
          title: 'Перевод',
          subtitle: 'Отметить перевод доли сервиса.',
          icon: 'wallet',
        },
        {
          id: 'history',
          title: 'История',
          subtitle: 'Заказы, начисления и статусы сверки.',
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
      note: 'Реквизиты и выплаты проверяются на сервере.',
    },
    rating: {
      title: 'Рейтинг',
      subtitle: 'Оценки пассажиров, качество поездок и рекомендации сервиса.',
      icon: 'star',
      statusTitle: 'Рейтинг появится позже',
      statusText: 'После поездок появятся оценки и подсказки.',
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
      note: 'Рейтинг влияет на доход — правила прозрачные.',
    },
    support: {
      title: 'Поддержка',
      subtitle: 'Помощь водителю по заказам, выплатам, документам и блокировкам.',
      icon: 'headphones',
      statusTitle: 'Канал поддержки готов',
      statusText: 'Напишите поддержке прямо из приложения.',
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
          supportCategory: 'Поездка',
          target: 'supportChat',
        },
        {
          id: 'payout',
          title: 'Выплата',
          subtitle: 'Начисления и реквизиты.',
          icon: 'wallet',
          supportCategory: 'Оплата',
          target: 'supportChat',
        },
        {
          id: 'block',
          title: 'Блокировка',
          subtitle: 'Проверка статуса доступа.',
          icon: 'shield',
          supportCategory: 'Безопасность',
          target: 'supportChat',
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
      note: 'Поддержка доступна из каждого раздела.',
    },
  },
  fleet: {
    overview: {
      title: 'Обзор',
      subtitle: 'Состояние автопарка, подключение и основные показатели.',
      icon: 'home',
      statusTitle: 'Автопарк на модерации',
        statusText: 'После проверки ИП откроется управление водителями и автомобилями.',
      primaryAction: 'Завершить проверку',
      secondaryAction: 'Пригласить водителя',
      metrics: [
        { label: 'Водители', value: '0', helper: 'Можно пригласить' },
        { label: 'Авто', value: '0', helper: 'Нужны документы' },
          { label: 'Статус', value: 'Модерация', helper: 'Проверка ИП' },
      ],
      quickActions: [
        {
            id: 'invite',
            title: 'Пригласить водителя',
            subtitle: 'Отправить регистрационную ссылку.',
            icon: 'users',
            target: 'fleetDriverInvite',
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
            title: 'Проверить ИП',
            subtitle: 'ИНН, ОГРНИП, адрес регистрации и расчетный счет.',
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
      note: 'Видно, почему парк ещё не на линии.',
    },
    drivers: {
      title: 'Водители',
      subtitle: 'Подключение, статусы, документы и доступ к заказам.',
      icon: 'users',
      statusTitle: 'Водителей пока нет',
        statusText: 'Парк добавляет водителя по PARK-коду через анкету.',
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
            title: 'Инвайт водителя',
            subtitle: 'Открыть анкету водителя таксопарка с PARK-кодом.',
            icon: 'users',
            target: 'fleetDriverInvite',
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
          subtitle: 'Добавьте водителя — он заполнит анкету по PARK-коду.',
          value: '0',
          status: 'Пусто',
        },
      ],
        note: 'Парк видит и ведёт только своих водителей.',
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
      note: 'Позже: импорт авто и напоминания об ОСАГО.',
    },
    finance: {
      title: 'Финансы',
      subtitle: 'Выплаты, доступ, акты, отчеты и банковские реквизиты.',
      icon: 'wallet',
      statusTitle: 'Финансы не активированы',
      statusText: 'Расчеты станут доступны после проверки организации и договора.',
      primaryAction: 'Добавить реквизиты',
      secondaryAction: 'Скачать отчет',
      metrics: [
        { label: 'Баланс', value: '0 ₽', helper: 'Нет поездок' },
        { label: 'К выплате', value: '0 ₽', helper: 'Нет начислений' },
        { label: 'Удержания', value: 'Нет', helper: 'По договору' },
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
      note: 'Доступ к финансам — по ролям и правам.',
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
      note: 'Храним историю версий договоров.',
    },
    notifications: {
      title: 'Уведомления',
      subtitle: 'Проверки, блокировки, события автопарка и системные сообщения.',
      icon: 'bell',
      statusTitle: 'Уведомления готовы к настройке',
      statusText: 'Скоро: события по водителям, машинам и выплатам.',
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
      note: 'Push подключается отдельно для iOS и Android.',
    },
  },
};

sectionPages.driver.profile = {
  ...sectionPages.client.profile,
  subtitle: 'Личные данные, безопасность и удаление профиля.',
  statusText: 'Можно изменить профиль или удалить аккаунт.',
};
sectionPages.driver.referrals = {
  ...sectionPages.client.referrals,
  title: 'Рефералы',
  subtitle: 'Приглашенные водители, прогресс до 10 поездок и бонус 200 ₽.',
  icon: 'users',
  statusTitle: 'Бонус после 10 поездок',
  statusText: '200 ₽ после 10 поездок приглашённого водителя.',
  primaryAction: 'Открыть рефералы',
  primaryTarget: 'referral',
  secondaryAction: 'К заказам',
  secondaryTarget: 'order',
  metrics: [
    { label: 'Бонус', value: '200 ₽', helper: 'После 10 поездок приглашенного водителя' },
    { label: 'Порог', value: '10', helper: 'Завершенных поездок приглашенного' },
    { label: 'Статус', value: 'Ожидает', helper: 'Подтверждает администратор' },
  ],
  quickActions: [
    {
      id: 'open-referrals',
      title: 'Мои рефералы',
      subtitle: 'Список приглашенных водителей и прогресс до бонуса.',
      icon: 'users',
      target: 'referral',
    },
    {
      id: 'orders',
      title: 'Заказы',
      subtitle: 'Вернуться к доступным и активным заказам.',
      icon: 'briefcase',
      target: 'order',
    },
  ],
  listTitle: 'Статусы бонусов',
  rows: [
    {
      id: 'threshold',
      title: 'До бонуса',
      subtitle: 'Показываем, сколько поездок осталось до выплаты 200 ₽.',
      value: '10',
      status: 'Порог',
    },
    {
      id: 'admin-confirm',
      title: 'Подтверждение',
      subtitle: 'Готовые бонусы подтверждаются или отклоняются в админ-панели.',
      value: 'Админ',
      status: 'Контроль',
    },
  ],
  note: 'Бонус и порог в 10 поездок без изменений.',
};

sectionPages.fleet.profile = {
  ...sectionPages.client.profile,
  subtitle: 'Данные владельца, безопасность и управление.',
  statusText: 'Можно изменить профиль или удалить аккаунт.',
};

sectionPages.client.settings = {
  ...sectionPages.client.profile,
  title: 'Настройки',
  subtitle: 'Адреса, простой режим, безопасность и поддержка.',
  icon: 'shield',
  statusTitle: 'Настройки собраны отдельно',
  statusText: 'Профиль, адреса и удаление аккаунта — здесь.',
  primaryAction: 'Сохраненные адреса',
  primaryTarget: 'homeAddress',
  secondaryAction: 'Поддержка',
  secondaryTarget: 'supportChat',
  metrics: [
    { label: 'Адреса', value: '0', helper: 'Дом и работа доступны отдельно' },
    { label: 'Режим', value: 'Простой', helper: 'Можно включить на главной' },
    { label: 'Аккаунт', value: 'Защищен', helper: 'Удаление через код' },
  ],
  quickActions: [
    {
      id: 'saved-addresses',
      title: 'Адреса',
      subtitle: 'Дом, работа и частые маршруты.',
      icon: 'star',
      target: 'homeAddress',
    },
    {
      id: 'support',
      title: 'Поддержка',
      subtitle: 'Вопросы по профилю и поездкам.',
      icon: 'headphones',
      target: 'supportChat',
    },
    {
      id: 'delete',
      title: 'Удаление аккаунта',
      subtitle: 'Подтверждение кодом через backend.',
      icon: 'shield',
      target: 'deleteAccount',
    },
  ],
};

sectionPages.client.about = {
  ...sectionPages.client.payment,
  title: 'О приложении',
  subtitle: 'Kinetix: заказ, статусы, поддержка и честные правила.',
  icon: 'star',
  statusTitle: 'Функции сохранены',
  statusText: 'Главное — снизу, остальное — в меню с тремя линиями.',
  primaryAction: 'Заказать поездку',
  primaryTarget: 'order',
  secondaryAction: 'Поддержка',
  secondaryTarget: 'supportChat',
  listTitle: 'Что доступно клиенту',
  rows: [
    {
      id: 'order',
      title: 'Заказ поездки',
      subtitle: 'Главная кнопка ведет к выбору маршрута и тарифа.',
      value: 'Снизу',
      status: 'Главное',
    },
    {
      id: 'history',
      title: 'История и статусы',
      subtitle: 'Заказы — во вкладке «Заказы» и в меню.',
      value: 'Заказы',
      status: 'Доступно',
    },
    {
      id: 'support',
      title: 'Поддержка',
      subtitle: 'Чат поддержки вынесен в профиль и боковое меню.',
      value: 'Меню',
      status: 'Доступно',
    },
  ],
  note: 'Раздел объясняет структуру и ничего не отключает.',
};

sectionPages.driver.settings = {
  ...sectionPages.driver.profile,
  title: 'Настройки',
  subtitle: 'Профиль, уведомления, безопасность и сессия.',
  icon: 'shield',
  statusTitle: 'Настройки вне рабочего стола',
  statusText: 'Профиль, документы, поддержка и удаление — доступны.',
  primaryAction: 'Открыть документы',
  primaryTarget: 'documents',
  secondaryAction: 'Поддержка',
  secondaryTarget: 'supportChat',
  metrics: [
    { label: 'Профиль', value: 'Доступен', helper: 'Личные данные и безопасность' },
    { label: 'Документы', value: 'Отдельно', helper: 'Через защищенный экран' },
    { label: 'Сессия', value: 'В меню', helper: 'Смена роли и выход' },
  ],
  quickActions: [
    {
      id: 'documents',
      title: 'Документы',
      subtitle: 'Паспорт, ВУ, СТС и ОСАГО.',
      icon: 'file',
      target: 'documents',
    },
    {
      id: 'support',
      title: 'Поддержка',
      subtitle: 'Спорные поездки и вопросы по доступу.',
      icon: 'headphones',
      target: 'supportChat',
    },
    {
      id: 'delete',
      title: 'Удаление аккаунта',
      subtitle: 'Подтверждение кодом через backend.',
      icon: 'shield',
      target: 'deleteAccount',
    },
  ],
};

sectionPages.fleet.finance = {
  ...sectionPages.fleet.finance,
  title: 'Расчеты',
  subtitle: 'Дневные расчеты, история оплат, доступ и отчеты таксопарка.',
  listTitle: 'История оплат',
};

sectionPages.fleet.orders = {
  ...sectionPages.client.rides,
  title: 'Заказы',
  subtitle: 'Активные, завершенные и отмененные заказы таксопарка.',
  icon: 'route',
  statusTitle: 'Заказы таксопарка',
  statusText: 'Парк видит статусы заказов своих водителей.',
  primaryAction: 'Обновить заказы',
  secondaryAction: 'Отчеты',
  metrics: [
    { label: 'Активные', value: '0', helper: 'Сейчас нет заказов' },
    { label: 'Завершенные', value: '0', helper: 'История появится после поездок' },
    { label: 'Отмененные', value: '0', helper: 'Для контроля качества' },
  ],
  quickActions: [
    {
      id: 'active',
      title: 'Активные',
      subtitle: 'Заказы на линии и назначенные водители.',
      icon: 'route',
    },
    {
      id: 'completed',
      title: 'Завершенные',
      subtitle: 'История выполненных поездок.',
      icon: 'file',
    },
    {
      id: 'cancelled',
      title: 'Отмененные',
      subtitle: 'Причины отмен и спорные случаи.',
      icon: 'headphones',
    },
  ],
  listTitle: 'Последние заказы',
  rows: [
    {
      id: 'empty',
      title: 'Заказов пока нет',
      subtitle: 'После выхода водителей на линию здесь появится список заказов парка.',
      value: '0',
      status: 'Пусто',
    },
  ],
  note: 'Парку — обзор по своим водителям.',
};

sectionPages.fleet.settings = {
  ...sectionPages.fleet.documents,
  title: 'Настройки таксопарка',
  subtitle: 'Данные ИП, реквизиты, договоры и автомобили.',
  icon: 'briefcase',
  statusTitle: 'Настройки вынесены в меню',
  statusText: 'Документы, автомобили и реквизиты — на месте.',
  primaryAction: 'Пригласить водителя',
  primaryTarget: 'fleetDriverInvite',
  secondaryAction: 'Профиль',
  metrics: [
    { label: 'ИП', value: 'Проверка', helper: 'Данные из анкеты' },
    { label: 'Реквизиты', value: 'Черновик', helper: 'Для актов и выплат' },
    { label: 'Авто', value: '0', helper: 'Добавляются отдельно' },
  ],
};

sectionPages.fleet.referrals = {
  ...sectionPages.client.referrals,
  title: 'Рефералы',
  subtitle: 'Приглашения, коды, бонусы и статусы начисления.',
  statusTitle: 'Реферальная система доступна',
  statusText: 'Бонусы прежние, раздел — в дополнительных функциях.',
  primaryAction: 'Открыть рефералы',
  primaryTarget: 'referral',
  secondaryAction: 'Пригласить водителя',
  secondaryTarget: 'fleetDriverInvite',
};

sectionPages.fleet.reports = {
  ...sectionPages.fleet.finance,
  title: 'Отчеты',
  subtitle: 'Сводки по водителям, заказам и оплатам.',
  icon: 'file',
  statusTitle: 'Отчеты собраны отдельно',
  statusText: 'Финансы — основная вкладка, выгрузки — в меню.',
  primaryAction: 'Скачать отчет',
  secondaryAction: 'Расчеты',
  listTitle: 'Доступные отчеты',
  rows: [
    {
      id: 'finance',
      title: 'Финансовый отчет',
      subtitle: 'Сводка выплат, удержаний и дневных сверок.',
      value: '0 ₽',
      status: 'Готовится',
    },
    {
      id: 'drivers',
      title: 'Активность водителей',
      subtitle: 'Заказы, статусы и допуск к линии.',
      value: '0',
      status: 'Готовится',
    },
  ],
};

sectionPages.fleet.support = {
  ...sectionPages.client.support,
  title: 'Поддержка',
  subtitle: 'Вопросы по таксопарку, водителям, расчетам и документам.',
  statusTitle: 'Поддержка таксопарка',
  statusText: 'Связь с сервисом — через меню.',
  primaryAction: 'Написать поддержке',
  primaryTarget: 'supportChat',
  secondaryAction: 'Правила работы',
};

sectionPages.fleet.rules = {
  ...sectionPages.fleet.documents,
  title: 'Правила работы',
  subtitle: 'Требования к парку, водителям, документам и качеству.',
  icon: 'shield',
  statusTitle: 'Правила доступны из меню',
  statusText: 'Все требования доступны — вынесены из главной.',
  primaryAction: 'Профиль парка',
  secondaryAction: 'Поддержка',
  secondaryTarget: 'supportChat',
  listTitle: 'Основные требования',
  rows: [
    {
      id: 'drivers',
      title: 'Водители',
      subtitle: 'Допуск, документы и активность должны контролироваться таксопарком.',
      value: 'Контроль',
      status: 'Важно',
    },
    {
      id: 'payments',
      title: 'Расчеты',
      subtitle: 'Дневные суммы и история оплат доступны в разделе Расчеты.',
      value: 'Ежедневно',
      status: 'Важно',
    },
  ],
};

sectionPages.self_employed_driver = sectionPages.driver;
sectionPages.park_admin = sectionPages.fleet;
sectionPages.park_driver = {
  ...sectionPages.driver,
  subscription: {
    ...sectionPages.driver.subscription,
    title: 'Таксопарк',
    subtitle: 'Привязка к парку, статус доступа и условия работы.',
    statusTitle: 'Оплата на стороне таксопарка',
    statusText: 'Доступ зависит от активации таксопарком.',
    primaryAction: 'Открыть заказы',
    primaryTarget: 'order',
    secondaryAction: 'Связаться с парком',
    secondaryTarget: 'supportChat',
    metrics: [
      { label: 'B2B-доступ', value: 'Ручной', helper: 'Активирует администратор' },
      { label: 'Статус', value: 'Активен', helper: 'После допуска парком' },
        { label: 'Удержания', value: 'Нет', helper: 'Доступ через парк' },
    ],
    quickActions: [
      {
        id: 'orders',
        title: 'Лента заказов',
        subtitle: 'Заказы доступны через активный таксопарк.',
        icon: 'briefcase',
        target: 'order',
      },
      {
        id: 'documents',
        title: 'Документы',
        subtitle: 'Проверить статус допуска к линии.',
        icon: 'file',
        target: 'documents',
      },
      {
        id: 'support',
        title: 'Связаться с парком',
        subtitle: 'Вопросы по доступу, машине и выплатам.',
        icon: 'headphones',
        target: 'supportChat',
      },
    ],
    note: 'Водитель таксопарка не оплачивает доступ самостоятельно.',
  },
  orders: {
    ...sectionPages.driver.orders,
    statusTitle: 'Лента доступна через таксопарк',
    statusText:
      'Заказы — когда парк активен, водитель допущен, документы проверены.',
    primaryAction: 'Открыть ленту',
    primaryTarget: 'order',
    secondaryAction: 'Документы',
    secondaryTarget: 'documents',
    metrics: [
      { label: 'Оплата', value: 'Парк', helper: 'Водитель не платит собственный доступ' },
        { label: 'Удержания', value: 'Нет', helper: 'Доступ через парк' },
      { label: 'Допуск', value: 'Проверка', helper: 'Документы и статус парка' },
    ],
    quickActions: [
      {
        id: 'orders',
        title: 'Лента заказов',
        subtitle: 'Перейти к доступным заказам.',
        icon: 'briefcase',
        target: 'order',
      },
      {
        id: 'documents',
        title: 'Документы',
        subtitle: 'Статус проверки водителя и автомобиля.',
        icon: 'file',
        target: 'documents',
      },
      {
        id: 'support',
        title: 'Поддержка',
        subtitle: 'Написать по вопросу доступа к линии.',
        icon: 'headphones',
        target: 'supportChat',
      },
    ],
  },
};

sectionPages.self_employed_driver = sectionPages.driver;
sectionPages.park_driver = sectionPages.driver;
sectionPages.park_admin = sectionPages.fleet;
