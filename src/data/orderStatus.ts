export type OrderStatusStep = {
  id: string;
  title: string;
  description: string;
};

export type OrderStatusConfig = {
  title: string;
  subtitle: string;
  participantTitle: string;
  participantName: string;
  participantMeta: string;
  contactTitle: string;
  contactPhone: string;
  chatActionLabel: string;
  callActionLabel: string;
  primaryAction: string;
  completedTitle: string;
  completedText: string;
  steps: OrderStatusStep[];
  details: string[];
};

export const orderStatusConfig: Record<string, OrderStatusConfig> = {
  client: {
    title: 'Статус поездки',
    subtitle: 'Поиск, подача и ход поездки.',
    participantTitle: 'Водитель',
    participantName: 'Алексей, Hyundai Solaris',
    participantMeta: '4.92 · А123ВС 96',
    contactTitle: 'Связь с водителем',
    contactPhone: '+7 917 000-42-11',
    chatActionLabel: 'Написать в приложении',
    callActionLabel: 'Позвонить',
    primaryAction: 'Обновляется автоматически',
    completedTitle: 'Поездка завершена',
    completedText: 'Чек в истории. Можно оценить.',
    steps: [
      {
        id: 'searching',
        title: 'Ищем водителя',
        description: 'Подбираем ближайшего по тарифу.',
      },
      {
        id: 'accepted',
        title: 'Водитель назначен',
        description: 'Авто, госномер и время подачи.',
      },
      {
        id: 'arrived',
        title: 'Водитель на месте',
        description: 'Машина у точки встречи.',
      },
      {
        id: 'started',
        title: 'Поездка началась',
        description: 'Маршрут и статус в реальном времени.',
      },
      {
        id: 'completed',
        title: 'Поездка завершена',
        description: 'Оплата закрыта, чек в истории.',
      },
    ],
    details: ['Связь с водителем', 'Отмена по правилам', 'Чек после поездки'],
  },
  driver: {
    title: 'Ведение заказа',
    subtitle: 'Пошаговое управление статусами.',
    participantTitle: 'Клиент',
    participantName: 'Клиент подтверждён',
    participantMeta: 'Связь — после принятия',
    contactTitle: 'Связь с клиентом',
    contactPhone: '+7 917 000-10-24',
    chatActionLabel: 'Написать в приложении',
    callActionLabel: 'Позвонить',
    primaryAction: 'Следующий статус',
    completedTitle: 'Заказ выполнен',
    completedText: 'Доход уйдёт в выплаты после расчёта.',
    steps: [
      {
        id: 'accepted',
        title: 'Заказ принят',
        description: 'Маршрут до точки подачи.',
      },
      {
        id: 'arrived',
        title: 'На месте',
        description: 'Ожидание по тарифу.',
      },
      {
        id: 'started',
        title: 'Поездка началась',
        description: 'Старт и маршрут зафиксированы.',
      },
      {
        id: 'completed',
        title: 'Завершить поездку',
        description: 'Итог и закрытие оплаты.',
      },
    ],
    details: ['Связь с клиентом', 'Навигация до подачи', 'Фиксация ожидания'],
  },
  fleet: {
    title: 'Контроль заказа',
    subtitle: 'Назначение, подача, поездка, закрытие.',
    participantTitle: 'Экипаж',
    participantName: 'Назначает диспетчер',
    participantMeta: 'Можно отправить конкретному водителю',
    contactTitle: 'Связь по заказу',
    contactPhone: '+7 917 000-77-01',
    chatActionLabel: 'Написать в чат',
    callActionLabel: 'Позвонить',
    primaryAction: 'Продвинуть этап',
    completedTitle: 'Заказ закрыт',
    completedText: 'Операция в финансовой истории парка.',
    steps: [
      {
        id: 'created',
        title: 'Заказ создан',
        description: 'Заявка готова к назначению.',
      },
      {
        id: 'assigned',
        title: 'Экипаж назначен',
        description: 'Выбраны водитель и авто.',
      },
      {
        id: 'arrived',
        title: 'Подача',
        description: 'Экипаж едет к клиенту.',
      },
      {
        id: 'started',
        title: 'В поездке',
        description: 'Маршрут выполняется.',
      },
      {
        id: 'closed',
        title: 'Закрытие',
        description: 'Финансы, отчёты и история.',
      },
    ],
    details: ['Контроль водителя', 'Контроль авто', 'Финансовое закрытие'],
  },
};

orderStatusConfig.self_employed_driver = orderStatusConfig.driver;
orderStatusConfig.park_admin = orderStatusConfig.fleet;
orderStatusConfig.park_driver = {
  ...orderStatusConfig.driver,
  subtitle: 'Вы ведёте заказ, парк видит статус.',
  participantMeta: 'Связь и данные парка — после принятия',
};
