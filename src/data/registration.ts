import { driverAccessPlans } from './subscription';

export type CanonicalAccountRole =
  | 'client'
  | 'self_employed_driver'
  | 'park_admin'
  | 'park_driver';
export type LegacyAccountRole = 'driver' | 'fleet';
export type AccountRole = CanonicalAccountRole | LegacyAccountRole;

export type RegistrationSection =
  | 'account'
  | 'identity'
  | 'vehicle'
  | 'legal'
  | 'business'
  | 'payments';

export type RegistrationField = {
  id: string;
  label: string;
  placeholder: string;
  section: RegistrationSection;
  required: boolean;
  helper?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  textContentType?:
    | 'emailAddress'
    | 'familyName'
    | 'givenName'
    | 'newPassword'
    | 'none'
    | 'telephoneNumber'
    | 'username';
};

export const sectionTitles: Record<RegistrationSection, string> = {
  account: 'Аккаунт',
  identity: 'Проверка личности',
  vehicle: 'Автомобиль',
  legal: 'Правовой допуск',
  business: 'Автопарк',
  payments: 'Расчеты',
};

export const roleCopy: Record<
  AccountRole,
  {
    title: string;
    subtitle: string;
    submitLabel: string;
    reviewStatus: string;
  }
> = {
  client: {
    title: 'Клиент',
    subtitle: 'Заказ поездок и управление профилем пассажира.',
    submitLabel: 'Создать аккаунт клиента',
    reviewStatus: 'Профиль готов к подтверждению телефона и почты',
  },
  self_employed_driver: {
    title: 'Водитель',
    subtitle: 'Принимает заказы, получает оплату напрямую и выбирает комиссию или Партнёр PRO.',
    submitLabel: 'Отправить заявку водителя',
    reviewStatus:
      'После проверки документов откроется лента заказов и выбор формата работы.',
  },
  park_admin: {
    title: 'Таксопарк',
    subtitle: 'Только ИП: парк управляет своими водителями, автомобилями, заказами и ручной сверкой.',
    submitLabel: 'Зарегистрировать таксопарк',
    reviewStatus: 'Анкета уйдет на проверку ИП, ОГРНИП и расчетного счета',
  },
  park_driver: {
    title: 'Водитель таксопарка',
    subtitle: 'Работает по приглашению зарегистрированного таксопарка и проходит быструю привязку к парку.',
    submitLabel: 'Присоединиться к таксопарку',
    reviewStatus: 'Доступ откроется после активации таксопарком и проверки документов',
  },
  driver: {
    title: 'Водитель',
    subtitle: 'Устаревшая роль, будет сохранена как водитель.',
    submitLabel: 'Отправить заявку водителя',
    reviewStatus:
      'После проверки автомобиля администратор открывает доступ к заказам',
  },
  fleet: {
    title: 'Таксопарк',
    subtitle: 'Подключение водителей, автомобилей и выплат автопарка.',
    submitLabel: 'Отправить заявку автопарка',
    reviewStatus: 'Анкета уйдет на проверку юридических данных',
  },
};

const commonFields: RegistrationField[] = [
  {
    id: 'firstName',
    label: 'Имя',
    placeholder: 'Алексей',
    section: 'account',
    required: true,
    textContentType: 'givenName',
  },
  {
    id: 'lastName',
    label: 'Фамилия',
    placeholder: 'Иванов',
    section: 'account',
    required: true,
    textContentType: 'familyName',
  },
  {
    id: 'email',
    label: 'Почта',
    placeholder: 'name@example.com',
    section: 'account',
    required: true,
    keyboardType: 'email-address',
    textContentType: 'emailAddress',
    helper: 'Почту подтверждаем кодом или ссылкой. Пароль от почты не нужен.',
  },
  {
    id: 'appPassword',
    label: 'Пароль для приложения',
    placeholder: 'Минимум 8 символов',
    section: 'account',
    required: true,
    secureTextEntry: true,
    textContentType: 'newPassword',
    helper: 'Это новый пароль только для входа в сервис.',
  },
  {
    id: 'phone',
    label: 'Номер телефона',
    placeholder: '+7 900 000-00-00',
    section: 'account',
    required: true,
    keyboardType: 'phone-pad',
    textContentType: 'telephoneNumber',
    helper: 'Телефон подтверждается одноразовым кодом.',
  },
  {
    id: 'referralCode',
    label: 'Реферальный код',
    placeholder: 'Например, TP12345',
    section: 'account',
    required: false,
    textContentType: 'none',
    helper: 'Если вас пригласили, код закрепит бонусы за вами и пригласившим.',
  },
];

const driverFields: RegistrationField[] = [
  {
    id: 'passportSeriesNumber',
    label: 'Серия и номер паспорта',
    placeholder: '0000 000000',
    section: 'identity',
    required: true,
    keyboardType: 'number-pad',
  },
  {
    id: 'driverInn',
    label: 'ИНН водителя',
    placeholder: '12 цифр',
    section: 'identity',
    required: true,
    keyboardType: 'number-pad',
    helper: 'Нужен для анкеты, ручной проверки и сверки расчетов.',
  },
  {
    id: 'driverLicense',
    label: 'Водительское удостоверение',
    placeholder: '00 00 000000',
    section: 'identity',
    required: true,
    helper: 'После отправки понадобится фото документа.',
  },
  {
    id: 'drivingExperienceSince',
    label: 'Водительский стаж с года',
    placeholder: '2020',
    section: 'identity',
    required: true,
    keyboardType: 'number-pad',
    helper: 'Для допуска к легковому такси нужен стаж не менее 3 лет.',
  },
  {
    id: 'taxStatus',
    label: 'Подтверждение условий расчетов',
    placeholder: 'Понимаю: клиент платит мне напрямую, долю сервиса перевожу в конце дня',
    section: 'legal',
    required: true,
    helper: 'Платежных систем в пилоте нет: приложение считает сумму к ручному переводу сервису.',
  },
  {
    id: 'noLegalRestrictionsDeclaration',
    label: 'Отсутствие запретов',
    placeholder: 'Подтверждаю отсутствие ограничений для работы в такси',
    section: 'legal',
    required: true,
    helper: 'Проверяем ограничения по 580-ФЗ до доступа к заказам.',
  },
  {
    id: 'carBrand',
    label: 'Марка автомобиля',
    placeholder: 'Hyundai',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'carModel',
    label: 'Модель автомобиля',
    placeholder: 'Solaris',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'carPlate',
    label: 'Госномер',
    placeholder: 'А123ВС 102',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'carColor',
    label: 'Цвет',
    placeholder: 'Белый',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'stsNumber',
    label: 'СТС',
    placeholder: '99 99 000000',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'vehicleDocumentsReady',
    label: 'Документы на автомобиль',
    placeholder: 'Подтверждаю, что готов предоставить СТС и документы авто',
    section: 'vehicle',
    required: true,
    helper: 'Детальная проверка проходит вручную у администратора до открытия заказов.',
  },
  {
    id: 'payoutAccount',
    label: 'Карта или счет для оплаты от клиента',
    placeholder: 'Банк, карта или счет, куда клиент переводит оплату',
    section: 'payments',
    required: true,
  },
];

const fleetFields: RegistrationField[] = [
  {
    id: 'companyName',
    label: 'Наименование ИП / таксопарка',
    placeholder: 'ИП Иванов Иван Иванович',
    section: 'business',
    required: true,
  },
  {
    id: 'inn',
    label: 'ИНН ИП',
    placeholder: '12 цифр',
    section: 'business',
    required: true,
    keyboardType: 'number-pad',
  },
  {
    id: 'ogrn',
    label: 'ОГРНИП',
    placeholder: '15 цифр',
    section: 'business',
    required: true,
    keyboardType: 'number-pad',
  },
  {
    id: 'legalAddress',
    label: 'Адрес регистрации ИП',
    placeholder: 'Салаватский район, населенный пункт, улица, дом',
    section: 'business',
    required: true,
  },
  {
    id: 'fleetContact',
    label: 'Контактное лицо',
    placeholder: 'ФИО ответственного',
    section: 'business',
    required: true,
  },
  {
    id: 'fleetPayoutAccount',
    label: 'Расчетный счет ИП',
    placeholder: 'Банк, БИК, расчетный счет ИП',
    section: 'payments',
    required: true,
  },
];

const parkDriverFields: RegistrationField[] = [
  {
    id: 'parkInviteCode',
    label: 'Код приглашения таксопарка',
    placeholder: 'Например, PARK-12345',
    section: 'account',
    required: true,
    helper: 'Водитель таксопарка регистрируется только по приглашению парка.',
  },
  {
    id: 'driverLicense',
    label: 'Водительское удостоверение',
    placeholder: '00 00 000000',
    section: 'identity',
    required: true,
    helper: 'После отправки понадобится фото документа.',
  },
  {
    id: 'drivingExperienceSince',
    label: 'Водительский стаж с года',
    placeholder: '2020',
    section: 'identity',
    required: true,
    keyboardType: 'number-pad',
  },
  {
    id: 'taxiParkDriverAgreement',
    label: 'Подтверждение привязки',
    placeholder: 'Подтверждаю работу через таксопарк',
    section: 'legal',
    required: true,
    helper: 'Таксопарк добавляет водителя по коду и контролирует его допуск к заказам.',
  },
];

export const consentItems = [
  {
    id: 'terms',
    label: 'Условия сервиса',
    text: 'Принимаю пользовательское соглашение.',
  },
  {
    id: 'privacy',
    label: 'Политика конфиденциальности',
    text: 'Согласен с политикой обработки и хранения данных.',
  },
  {
    id: 'personalData',
    label: 'Персональные данные',
    text: 'Даю согласие на обработку персональных данных.',
  },
  {
    id: 'taxiRules',
    label: 'Правила перевозок',
    text: 'Согласен с правилами сервиса, требованиями перевозки и проверкой допуска к заказам.',
  },
] as const;

export type ConsentId = (typeof consentItems)[number]['id'];

export const verificationSteps: Record<AccountRole, string[]> = {
  client: ['Подтверждение телефона', 'Подтверждение почты', 'Готов к заказу'],
  self_employed_driver: [
    'Проверка телефона и почты',
    'Проверка паспорта, ИНН и ВУ',
    '7 дней или 20 заказов без комиссии',
    'Проверка автомобиля, СТС, ОСАГО и ОСГОП',
    'Выбор: комиссия 7% / 5% / 3% или Партнёр PRO',
  ],
  park_admin: [
    'Проверка контакта',
    'Проверка ИП и ОГРНИП',
    'Проверка расчетного счета ИП',
    'Ручная активация таксопарка после договора',
    'Создание приглашений для водителей парка',
    'Подключение автомобилей и выпуск на линию',
  ],
  park_driver: [
    'Проверка приглашения таксопарка',
    'Проверка телефона и почты',
    'Проверка водительских документов',
    'Активация водителя таксопарком',
    'Доступ к заказам через активный таксопарк',
  ],
  driver: [
    'Проверка телефона и почты',
    'Проверка паспорта, ИНН и ВУ',
    'Проверка стажа не менее 3 лет',
    'Проверка автомобиля и СТС',
    'Ручное решение администратора по допуску',
    'Дневная сверка доли сервиса',
    'Открытие заказов',
  ],
  fleet: [
    'Проверка контакта',
    'Проверка ИП',
    'Настройка расчетного счета',
    'Подключение водителей',
  ],
};

export function getFieldsForRole(role: AccountRole) {
  const canonicalRole = normalizeAccountRole(role);

  if (canonicalRole === 'self_employed_driver') {
    return [...commonFields, ...driverFields];
  }

  if (canonicalRole === 'park_admin') {
    return [...commonFields, ...fleetFields];
  }

  if (canonicalRole === 'park_driver') {
    return [...commonFields, ...parkDriverFields];
  }

  return commonFields;
}

export function normalizeAccountRole(role: AccountRole | string | undefined): CanonicalAccountRole {
  if (role === 'driver') {
    return 'self_employed_driver';
  }

  if (role === 'fleet') {
    return 'park_admin';
  }

  if (
    role === 'client' ||
    role === 'self_employed_driver' ||
    role === 'park_admin' ||
    role === 'park_driver'
  ) {
    return role;
  }

  return 'client';
}

export function isSelfEmployedDriverRole(role: AccountRole | string | undefined) {
  return normalizeAccountRole(role) === 'self_employed_driver';
}

export function isParkAdminRole(role: AccountRole | string | undefined) {
  return normalizeAccountRole(role) === 'park_admin';
}

export function isParkDriverRole(role: AccountRole | string | undefined) {
  return normalizeAccountRole(role) === 'park_driver';
}

export function isDriverLikeRole(role: AccountRole | string | undefined) {
  const canonicalRole = normalizeAccountRole(role);
  return canonicalRole === 'self_employed_driver' || canonicalRole === 'park_driver';
}

export function isParkRole(role: AccountRole | string | undefined) {
  const canonicalRole = normalizeAccountRole(role);
  return canonicalRole === 'park_admin' || canonicalRole === 'park_driver';
}
