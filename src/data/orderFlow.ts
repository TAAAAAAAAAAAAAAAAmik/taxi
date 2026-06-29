export type OrderField = {
  id: string;
  label: string;
  placeholder: string;
  helper?: string;
  keyboardType?: 'default' | 'phone-pad';
};

export type OrderOption = {
  id: string;
  label: string;
  price: number;
};

export type OrderTariff = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  eta: string;
};

export type OrderFlowConfig = {
  title: string;
  subtitle: string;
  routeTitle: string;
  tariffTitle: string;
  detailsTitle: string;
  summaryTitle: string;
  primaryAction: string;
  secondaryAction: string;
  statusTitle: string;
  statusText: string;
  fields: OrderField[];
  detailFields: OrderField[];
  options: OrderOption[];
  tariffs: OrderTariff[];
  paymentMethods: string[];
  timeline: string[];
  suggestions: string[];
};

const baseTariffs: OrderTariff[] = [
  {
    id: 'economy',
    title: 'Эконом',
    subtitle: 'Фиксированная цена',
    price: 120,
    eta: '4 мин',
  },
  {
    id: 'comfort',
    title: 'Комфорт',
    subtitle: 'Просторный салон',
    price: 590,
    eta: '6 мин',
  },
  {
    id: 'business',
    title: 'Бизнес',
    subtitle: 'Премиум-авто',
    price: 980,
    eta: '9 мин',
  },
];

const clientTariffs: OrderTariff[] = [baseTariffs[0]];

export const orderFlowConfig: Record<string, OrderFlowConfig> = {
  client: {
    title: 'Поездка',
    subtitle: 'Маршрут, тариф и оплата на одном экране.',
    routeTitle: 'Маршрут',
    tariffTitle: 'Тариф',
    detailsTitle: 'Опции',
    summaryTitle: 'Итог',
    primaryAction: 'Вызвать',
    secondaryAction: 'Сохранить',
    statusTitle: 'Готово к подтверждению',
    statusText: 'Найдём ближайшего водителя.',
    fields: [
      {
        id: 'pickup',
        label: 'Откуда',
        placeholder: 'Малояз, Янгантау, Кургазак…',
        helper: 'Можно добавить подъезд или ориентир.',
      },
      {
        id: 'destination',
        label: 'Куда',
        placeholder: 'Санаторий Янгантау, Кургазак…',
        helper: 'Цена — после выбора точки.',
      },
    ],
    detailFields: [
      {
        id: 'entrance',
        label: 'Подъезд или ориентир',
        placeholder: 'Подъезд 3, у шлагбаума',
      },
      {
        id: 'comment',
        label: 'Комментарий водителю',
        placeholder: 'Позвонить за 2 минуты',
      },
    ],
    options: [
      { id: 'child-seat', label: 'Детское кресло', price: 120 },
      { id: 'luggage', label: 'Багаж', price: 80 },
      { id: 'pet', label: 'Животное', price: 100 },
    ],
    tariffs: clientTariffs,
    paymentMethods: ['Перевод водителю', 'Наличные водителю'],
    timeline: ['Маршрут', 'Расчет', 'Поиск водителя', 'Подача', 'Поездка'],
    suggestions: ['Малояз', 'Янгантау', 'Кургазак', 'Мурсалимкино'],
  },
  driver: {
    title: 'Заказ',
    subtitle: 'Подача, маршрут, тариф и действия.',
    routeTitle: 'Заказ от клиента',
    tariffTitle: 'Условия',
    detailsTitle: 'Перед принятием',
    summaryTitle: 'Доход и маршрут',
    primaryAction: 'Принять',
    secondaryAction: 'Пропустить',
    statusTitle: 'Заказ доступен',
    statusText: 'После принятия — маршрут до клиента и статусы.',
    fields: [
      {
        id: 'pickup',
        label: 'Точка подачи',
        placeholder: 'Центр Малояза',
        helper: 'Расстояние и время до клиента.',
      },
      {
        id: 'destination',
        label: 'Куда едет клиент',
        placeholder: 'Санаторий Янгантау',
        helper: 'Полный адрес — после принятия.',
      },
    ],
    detailFields: [
      {
        id: 'clientComment',
        label: 'Комментарий клиента',
        placeholder: 'Ждать у подъезда',
      },
      {
        id: 'pickupDistance',
        label: 'До подачи',
        placeholder: '2.4 км, 6 минут',
      },
    ],
    options: [
      { id: 'cash', label: 'Оплата наличными', price: 0 },
      { id: 'luggage', label: 'Есть багаж', price: 0 },
      { id: 'priority', label: 'Приоритетный заказ', price: 70 },
    ],
    tariffs: [
      {
        id: 'current',
        title: 'Комфорт',
        subtitle: 'Подходит под класс авто',
        price: 590,
        eta: '6 мин до клиента',
      },
      {
        id: 'nearby',
        title: 'Ближайший',
        subtitle: 'Короткая подача',
        price: 420,
        eta: '3 мин до клиента',
      },
      {
        id: 'airport',
        title: 'Аэропорт',
        subtitle: 'Длинный маршрут, выше доход',
        price: 1180,
        eta: '8 мин до клиента',
      },
    ],
    paymentMethods: ['Перевод водителю', 'Наличные водителю'],
    timeline: ['Принять', 'Еду к клиенту', 'На месте', 'Начать', 'Завершить'],
    suggestions: ['Ближайшие', 'Малояз', 'Янгантау', 'Оплата напрямую'],
  },
  fleet: {
    title: 'Диспетчерский заказ',
    subtitle: 'Создать заказ, назначить водителя, контроль.',
    routeTitle: 'Клиент и маршрут',
    tariffTitle: 'Тариф и назначение',
    detailsTitle: 'Назначение водителя',
    summaryTitle: 'Контроль заказа',
    primaryAction: 'Создать и назначить',
    secondaryAction: 'Сохранить',
    statusTitle: 'Готово к назначению',
    statusText: 'Можно отправить водителю или в очередь.',
    fields: [
      {
        id: 'clientPhone',
        label: 'Телефон клиента',
        placeholder: '+7 900 000-00-00',
        keyboardType: 'phone-pad',
        helper: 'Для связи и истории.',
      },
      {
        id: 'pickup',
        label: 'Точка подачи',
        placeholder: 'Адрес подачи',
      },
      {
        id: 'destination',
        label: 'Назначение',
        placeholder: 'Адрес назначения',
      },
    ],
    detailFields: [
      {
        id: 'driver',
        label: 'Водитель',
        placeholder: 'Выберите водителя',
      },
      {
        id: 'vehicle',
        label: 'Автомобиль',
        placeholder: 'Выберите автомобиль',
      },
      {
        id: 'dispatcherComment',
        label: 'Комментарий диспетчера',
        placeholder: 'Особые условия',
      },
    ],
    options: [
      { id: 'priority', label: 'Приоритетная подача', price: 150 },
      { id: 'child-seat', label: 'Детское кресло', price: 120 },
      { id: 'cashless', label: 'Перевод водителю', price: 0 },
    ],
    tariffs: baseTariffs,
    paymentMethods: ['Перевод водителю', 'Наличные водителю', 'Сверка таксопарка'],
    timeline: ['Создать', 'Назначить', 'Подача', 'Контроль', 'Закрытие'],
    suggestions: ['Постоянный клиент', 'Свободный водитель', 'Комфорт', 'Счет компании'],
  },
};

orderFlowConfig.self_employed_driver = orderFlowConfig.driver;
orderFlowConfig.park_admin = orderFlowConfig.fleet;
orderFlowConfig.park_driver = {
  ...orderFlowConfig.driver,
  subtitle: 'Заказы через активный таксопарк.',
  statusText: 'После принятия учитывается в финансах парка.',
};
