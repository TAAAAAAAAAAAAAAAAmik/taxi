export const driverSubscriptionPlan = {
  accessDays: 30,
  commissionPercent: 0,
  currency: '₽',
  monthlyPrice: 4990,
  name: 'Месячный доступ к заказам',
};

export const driverSubscriptionBenefits = [
  'Заказы доступны напрямую в приложении после оплаты месяца',
  'Комиссия сервиса с каждого заказа: 0%',
  'Водитель заранее понимает себестоимость доступа',
  'Не нужно платить автопарку ежедневные удержания',
  'Выплаты идут на собственные реквизиты водителя',
];

export const driverSubscriptionRules = [
  'Подписка открывает доступ только после проверки документов',
  'Сервис не становится работодателем водителя',
  'Заказы распределяются по спросу, рейтингу, географии и доступности',
  'Отмена, безопасность и спорные поездки остаются под правилами сервиса',
];

export const driverSubscriptionEconomics = [
  {
    label: 'Доход сервиса',
    value: `${driverSubscriptionPlan.monthlyPrice} ${driverSubscriptionPlan.currency}/мес`,
    helper: 'Фиксированный платеж водителя вместо комиссии с поездки',
  },
  {
    label: 'Комиссия',
    value: `${driverSubscriptionPlan.commissionPercent}%`,
    helper: 'После оплаты месяца вся стоимость заказа остается водителю',
  },
  {
    label: 'Главная задача',
    value: 'Трафик',
    helper: 'Сервис обязан приводить клиентов и держать плотность заказов',
  },
];
