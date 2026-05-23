export type DriverBillingMode = 'monthly' | 'commission';

export type DriverSubscriptionPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type DriverPaymentProviderMode = 'demo' | 'live' | 'manual';

export type DriverPaymentProvider = {
  name: string;
  mode: DriverPaymentProviderMode;
  shopId?: string;
};

export type DriverSubscriptionReceipt = {
  id: string;
  paymentId: string;
  driverId: string;
  issuedAt: string;
  total: number;
  currency: 'RUB';
  fiscalStatus: 'demo' | 'provider' | 'manual';
  fiscalNumber: string;
  paymentStatus: DriverSubscriptionPaymentStatus;
  items: Array<{
    amount: number;
    label: string;
  }>;
};

export type DriverSubscriptionPayment = {
  id: string;
  driverId: string;
  driverName?: string;
  billingMode: DriverBillingMode;
  planName: string;
  amount: number;
  currency: 'RUB';
  paymentMethod: string;
  provider: DriverPaymentProvider;
  providerPaymentId?: string;
  confirmationUrl?: string;
  status: DriverSubscriptionPaymentStatus;
  accessStartsAt?: string;
  accessExpiresAt?: string;
  paidAt?: string;
  refundedAt?: string;
  refundReason?: string;
  receipt?: DriverSubscriptionReceipt;
  refundReceipt?: DriverSubscriptionReceipt;
  createdAt: string;
  updatedAt: string;
};

export const driverAccessPlans: Record<
  DriverBillingMode,
  {
    id: DriverBillingMode;
    name: string;
    shortName: string;
    accessDays?: number;
    monthlyPrice: number;
    commissionPercent: number;
    currency: '₽';
    headline: string;
    description: string;
    primaryAction: string;
  }
> = {
  monthly: {
    accessDays: 30,
    commissionPercent: 0,
    currency: '₽',
    description:
      'Водитель оплачивает месяц доступа к заказам и оставляет себе всю стоимость поездки без комиссии сервиса.',
    headline: '5000 ₽ в месяц и 0% с поездок',
    id: 'monthly',
    monthlyPrice: 5000,
    name: 'Месячный доступ к заказам',
    primaryAction: 'Оплатить 5000 ₽ за 30 дней',
    shortName: '5000 ₽/мес',
  },
  commission: {
    commissionPercent: 12,
    currency: '₽',
    description:
      'Водитель ничего не платит заранее, но с каждой выполненной поездки сервис удерживает 12%.',
    headline: '0 ₽ заранее и 12% с каждой поездки',
    id: 'commission',
    monthlyPrice: 0,
    name: 'Комиссия с поездок',
    primaryAction: 'Подключить 12% с поездки',
    shortName: '12%/поездка',
  },
};

export const driverSubscriptionPlan = driverAccessPlans.monthly;

export const driverSubscriptionBenefits = [
  'Водитель сам выбирает модель: фиксированный месяц или процент с поездок',
  'При оплате месяца комиссия сервиса с каждого заказа: 0%',
  'При модели 12% водитель не платит заранее и рассчитывается только с выполненных поездок',
  'Не нужно платить автопарку ежедневные удержания',
  'Выплаты идут на собственные реквизиты водителя',
];

export const driverSubscriptionRules = [
  'Доступ к заказам открывается только после проверки документов',
  'Сервис не становится работодателем водителя',
  'Заказы распределяются по спросу, рейтингу, географии и доступности',
  'Выбранную модель оплаты можно менять перед новым расчетным периодом',
  'Возвраты, безопасность и спорные поездки остаются под правилами сервиса',
];

export const driverSubscriptionEconomics = [
  {
    label: 'Вариант 1',
    value: `${driverAccessPlans.monthly.monthlyPrice} ${driverAccessPlans.monthly.currency}/мес`,
    helper: 'Фиксированный платеж за 30 дней доступа, комиссия с поездок 0%',
  },
  {
    label: 'Вариант 2',
    value: `${driverAccessPlans.commission.commissionPercent}%`,
    helper: 'Без оплаты заранее, сервис удерживает процент с каждой выполненной поездки',
  },
  {
    label: 'Главная задача',
    value: 'Трафик',
    helper: 'Сервис обязан приводить клиентов и держать плотность заказов',
  },
];
