export type AccountRole = 'client' | 'driver' | 'fleet';

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
  payments: 'Выплаты',
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
  driver: {
    title: 'Водитель-партнер',
    subtitle: 'Работа с заказами по месячной подписке после юридического допуска.',
    submitLabel: 'Отправить заявку водителя',
    reviewStatus:
      'После проверки документов, реестров и допуска откроется оплата месячного доступа',
  },
  fleet: {
    title: 'Партнер-автопарк',
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
    helper: 'Нужен для проверки статуса самозанятого, ИП или трудового договора.',
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
    label: 'Статус для работы',
    placeholder: 'Самозанятый, ИП или трудовой договор',
    section: 'legal',
    required: true,
  },
  {
    id: 'taxiPermitNumber',
    label: 'Номер разрешения такси',
    placeholder: 'Разрешение на перевозку пассажиров и багажа',
    section: 'legal',
    required: true,
    helper: 'Заказы открываются только после проверки разрешения в реестре.',
  },
  {
    id: 'taxiPermitRegion',
    label: 'Регион разрешения',
    placeholder: 'Республика Башкортостан',
    section: 'legal',
    required: true,
  },
  {
    id: 'taxiPermitExpiresAt',
    label: 'Срок действия разрешения',
    placeholder: 'ДД.ММ.ГГГГ',
    section: 'legal',
    required: true,
  },
  {
    id: 'carrierRegistryEntry',
    label: 'Запись в реестре перевозчиков',
    placeholder: 'Номер записи ФГИС Такси или регионального реестра',
    section: 'legal',
    required: true,
  },
  {
    id: 'serviceContractNumber',
    label: 'Договор со службой заказа',
    placeholder: 'Номер договора или заявки',
    section: 'legal',
    required: true,
    helper: 'Для самозанятого нужен договор со службой заказа легкового такси.',
  },
  {
    id: 'medicalCheckProvider',
    label: 'Предрейсовый медосмотр',
    placeholder: 'Организация или кабинет, где проходите осмотр',
    section: 'legal',
    required: true,
  },
  {
    id: 'technicalCheckProvider',
    label: 'Предрейсовый техконтроль',
    placeholder: 'Организация или механик техконтроля',
    section: 'legal',
    required: true,
  },
  {
    id: 'waybillReadiness',
    label: 'Путевой лист',
    placeholder: 'Подтверждаю, что путевой лист оформляется перед сменой',
    section: 'legal',
    required: true,
    helper: 'Нужен вместе с отметками медосмотра и техконтроля.',
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
    id: 'taxiVehicleRegistryEntry',
    label: 'Запись автомобиля в реестре такси',
    placeholder: 'Номер записи автомобиля',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'osagoNumber',
    label: 'ОСАГО',
    placeholder: 'Серия и номер полиса',
    section: 'vehicle',
    required: true,
  },
  {
    id: 'osagoTaxiUse',
    label: 'ОСАГО для такси',
    placeholder: 'Да, использование такси указано в полисе',
    section: 'vehicle',
    required: true,
    helper: 'Полис должен покрывать использование автомобиля в качестве такси.',
  },
  {
    id: 'payoutAccount',
    label: 'Реквизиты для выплат',
    placeholder: 'Банк, БИК, счет',
    section: 'payments',
    required: true,
  },
];

const fleetFields: RegistrationField[] = [
  {
    id: 'companyName',
    label: 'Название организации',
    placeholder: 'ООО Такси',
    section: 'business',
    required: true,
  },
  {
    id: 'inn',
    label: 'ИНН',
    placeholder: '10 или 12 цифр',
    section: 'business',
    required: true,
    keyboardType: 'number-pad',
  },
  {
    id: 'ogrn',
    label: 'ОГРН / ОГРНИП',
    placeholder: 'Регистрационный номер',
    section: 'business',
    required: true,
    keyboardType: 'number-pad',
  },
  {
    id: 'legalAddress',
    label: 'Юридический адрес',
    placeholder: 'Город, улица, дом',
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
    label: 'Расчетный счет',
    placeholder: 'Банк, БИК, счет',
    section: 'payments',
    required: true,
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
  driver: [
    'Проверка телефона и почты',
    'Проверка паспорта, ИНН и ВУ',
    'Проверка стажа не менее 3 лет',
    'Проверка разрешения и реестров ФГИС Такси',
    'Проверка автомобиля, СТС и ОСАГО для такси',
    'Подтверждение медосмотра, техконтроля и путевого листа',
    'Оплата месячной подписки',
    'Допуск к заказам',
  ],
  fleet: [
    'Проверка контакта',
    'Проверка юрлица',
    'Настройка выплат',
    'Подключение водителей',
  ],
};

export function getFieldsForRole(role: AccountRole) {
  if (role === 'driver') {
    return [...commonFields, ...driverFields];
  }

  if (role === 'fleet') {
    return [...commonFields, ...fleetFields];
  }

  return commonFields;
}
