import { AccountRole } from './registration';

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

export const orderStatusConfig: Record<AccountRole, OrderStatusConfig> = {
  client: {
    title: 'Статус поездки',
    subtitle: 'Клиент видит поиск водителя, подачу автомобиля и ход поездки.',
    participantTitle: 'Водитель',
    participantName: 'Алексей, Hyundai Solaris',
    participantMeta: 'Рейтинг 4.92 · госномер А123ВС 96',
    contactTitle: 'Связь с водителем',
    contactPhone: '+7 917 000-42-11',
    chatActionLabel: 'Написать водителю в приложении',
    callActionLabel: 'Позвонить водителю',
    primaryAction: 'Обновить статус',
    completedTitle: 'Поездка завершена',
    completedText: 'Чек сформирован, поездка добавлена в историю. Можно оставить оценку.',
    steps: [
      {
        id: 'searching',
        title: 'Ищем водителя',
        description: 'Система подбирает ближайшего водителя по тарифу и расстоянию.',
      },
      {
        id: 'assigned',
        title: 'Водитель назначен',
        description: 'Клиент видит водителя, автомобиль, госномер и время подачи.',
      },
      {
        id: 'arriving',
        title: 'Водитель едет к вам',
        description: 'Отображается примерное время подачи и связь с водителем.',
      },
      {
        id: 'arrived',
        title: 'Водитель на месте',
        description: 'Можно начать ожидание и показать точку встречи.',
      },
      {
        id: 'in_progress',
        title: 'Поездка началась',
        description: 'Клиент видит текущий маршрут и статус поездки.',
      },
      {
        id: 'completed',
        title: 'Поездка завершена',
        description: 'Оплата закрыта, чек и оценка доступны в истории.',
      },
    ],
    details: ['Связь с водителем', 'Отмена по правилам сервиса', 'Чек после завершения'],
  },
  driver: {
    title: 'Ведение заказа',
    subtitle: 'Водитель пошагово управляет статусами заказа на линии.',
    participantTitle: 'Клиент',
    participantName: 'Клиент подтвержден',
    participantMeta: 'Комментарий и связь доступны после принятия заказа',
    contactTitle: 'Связь с клиентом',
    contactPhone: '+7 917 000-10-24',
    chatActionLabel: 'Написать клиенту в приложении',
    callActionLabel: 'Позвонить клиенту',
    primaryAction: 'Следующий статус',
    completedTitle: 'Заказ выполнен',
    completedText: 'Доход зафиксирован, поездка попадет в выплаты после расчета.',
    steps: [
      {
        id: 'accepted',
        title: 'Заказ принят',
        description: 'Водитель получил маршрут до точки подачи.',
      },
      {
        id: 'to_pickup',
        title: 'Еду к клиенту',
        description: 'Клиент видит автомобиль и примерное время подачи.',
      },
      {
        id: 'arrived',
        title: 'На месте',
        description: 'Начинается ожидание по правилам тарифа.',
      },
      {
        id: 'in_progress',
        title: 'Поездка началась',
        description: 'Фиксируется время старта и маршрут поездки.',
      },
      {
        id: 'completed',
        title: 'Завершить поездку',
        description: 'Система считает итог и закрывает оплату.',
      },
    ],
    details: ['Кнопка связи с клиентом', 'Навигация до подачи', 'Фиксация ожидания'],
  },
  fleet: {
    title: 'Контроль заказа',
    subtitle: 'Автопарк отслеживает назначение, подачу, поездку и закрытие заказа.',
    participantTitle: 'Экипаж',
    participantName: 'Водитель и автомобиль назначаются диспетчером',
    participantMeta: 'Можно отправить заказ конкретному водителю или в очередь',
    contactTitle: 'Связь по заказу',
    contactPhone: '+7 917 000-77-01',
    chatActionLabel: 'Написать в чат заказа',
    callActionLabel: 'Позвонить участнику',
    primaryAction: 'Продвинуть этап',
    completedTitle: 'Заказ закрыт',
    completedText: 'Операция попала в финансовую историю автопарка.',
    steps: [
      {
        id: 'created',
        title: 'Заказ создан',
        description: 'Диспетчерская заявка сохранена и готова к назначению.',
      },
      {
        id: 'assigned',
        title: 'Экипаж назначен',
        description: 'Выбран водитель и автомобиль автопарка.',
      },
      {
        id: 'to_pickup',
        title: 'Подача',
        description: 'Автопарк видит движение экипажа к клиенту.',
      },
      {
        id: 'in_progress',
        title: 'В поездке',
        description: 'Маршрут выполняется, диспетчер контролирует статус.',
      },
      {
        id: 'closed',
        title: 'Закрытие',
        description: 'Формируются финансы, отчеты и история заказа.',
      },
    ],
    details: ['Контроль водителя', 'Контроль автомобиля', 'Финансовое закрытие'],
  },
};
