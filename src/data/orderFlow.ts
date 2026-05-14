import { AccountRole } from './registration';

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
    subtitle: 'Быстрая подача для обычной поездки',
    price: 420,
    eta: '4 мин',
  },
  {
    id: 'comfort',
    title: 'Комфорт',
    subtitle: 'Просторнее салон и выше рейтинг',
    price: 590,
    eta: '6 мин',
  },
  {
    id: 'business',
    title: 'Бизнес',
    subtitle: 'Премиальный автомобиль и водитель',
    price: 980,
    eta: '9 мин',
  },
];

export const orderFlowConfig: Record<AccountRole, OrderFlowConfig> = {
  client: {
    title: 'Оформление поездки',
    subtitle: 'Маршрут по Салаватскому району, тариф, опции и оплата на одном экране.',
    routeTitle: 'Маршрут',
    tariffTitle: 'Тариф',
    detailsTitle: 'Опции поездки',
    summaryTitle: 'Итог заказа',
    primaryAction: 'Заказать поездку',
    secondaryAction: 'Сохранить черновик',
    statusTitle: 'Заказ готов к подтверждению',
    statusText: 'После подтверждения система начнет искать ближайшего подходящего водителя.',
    fields: [
      {
        id: 'pickup',
        label: 'Откуда',
        placeholder: 'Начните вводить: Малояз, Янгантау, Кургазак...',
        helper: 'Можно указать подъезд, ориентир или комментарий.',
      },
      {
        id: 'destination',
        label: 'Куда',
        placeholder: 'Например: санаторий Янгантау или источник Кургазак',
        helper: 'Цена пересчитается после выбора точки назначения.',
      },
    ],
    detailFields: [
      {
        id: 'entrance',
        label: 'Подъезд или ориентир',
        placeholder: 'Подъезд 3, ждать у шлагбаума',
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
    tariffs: baseTariffs,
    paymentMethods: ['Карта', 'Наличные', 'Корпоративный счет'],
    timeline: ['Маршрут', 'Расчет', 'Поиск водителя', 'Подача', 'Поездка'],
    suggestions: ['Малояз', 'Янгантау', 'Кургазак', 'Мурсалимкино'],
  },
  driver: {
    title: 'Карточка заказа',
    subtitle: 'Водитель видит только важное: подача по Салаватскому району, маршрут, тариф, оплата и действия.',
    routeTitle: 'Заказ от клиента',
    tariffTitle: 'Условия',
    detailsTitle: 'Что важно перед принятием',
    summaryTitle: 'Доход и маршрут',
    primaryAction: 'Принять заказ',
    secondaryAction: 'Пропустить',
    statusTitle: 'Заказ доступен',
    statusText: 'После принятия водитель получит точный маршрут до клиента и кнопку статуса.',
    fields: [
      {
        id: 'pickup',
        label: 'Точка подачи',
        placeholder: 'Центр Малояза',
        helper: 'Показываем расстояние до клиента и время подачи.',
      },
      {
        id: 'destination',
        label: 'Куда едет клиент',
        placeholder: 'Санаторий Янгантау',
        helper: 'Полный адрес можно показывать после принятия, если так решит сервис.',
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
        subtitle: 'Заказ подходит под класс автомобиля',
        price: 590,
        eta: '6 мин до клиента',
      },
      {
        id: 'nearby',
        title: 'Ближайший',
        subtitle: 'Короткая подача, средний чек',
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
    paymentMethods: ['Карта', 'Наличные'],
    timeline: ['Принять', 'Еду к клиенту', 'На месте', 'Начать', 'Завершить'],
    suggestions: ['Ближайшие', 'Малояз', 'Янгантау', 'Без наличных'],
  },
  fleet: {
    title: 'Диспетчерский заказ',
    subtitle: 'Автопарк создает заказ, назначает водителя и контролирует выполнение.',
    routeTitle: 'Данные клиента и маршрут',
    tariffTitle: 'Тариф и назначение',
    detailsTitle: 'Назначение водителя',
    summaryTitle: 'Контроль заказа',
    primaryAction: 'Создать и назначить',
    secondaryAction: 'Сохранить заявку',
    statusTitle: 'Заказ готов к диспетчеризации',
    statusText: 'После создания заказ можно отправить конкретному водителю или в очередь автопарка.',
    fields: [
      {
        id: 'clientPhone',
        label: 'Телефон клиента',
        placeholder: '+7 900 000-00-00',
        keyboardType: 'phone-pad',
        helper: 'Нужен для связи и истории заказов.',
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
        placeholder: 'Выберите водителя автопарка',
      },
      {
        id: 'vehicle',
        label: 'Автомобиль',
        placeholder: 'Выберите автомобиль',
      },
      {
        id: 'dispatcherComment',
        label: 'Комментарий диспетчера',
        placeholder: 'Особые условия заказа',
      },
    ],
    options: [
      { id: 'priority', label: 'Приоритетная подача', price: 150 },
      { id: 'child-seat', label: 'Детское кресло', price: 120 },
      { id: 'cashless', label: 'Безналичный расчет', price: 0 },
    ],
    tariffs: baseTariffs,
    paymentMethods: ['Карта клиента', 'Наличные', 'Счет автопарка'],
    timeline: ['Создать', 'Назначить', 'Подача', 'Контроль', 'Закрытие'],
    suggestions: ['Постоянный клиент', 'Свободный водитель', 'Комфорт', 'Счет компании'],
  },
};
