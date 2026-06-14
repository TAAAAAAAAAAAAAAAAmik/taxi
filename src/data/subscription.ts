export type DriverBillingMode = 'monthly' | 'commission';
export type SubscriptionOwnerType = 'self_employed_driver';

export type DriverSubscriptionPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type DriverPaymentProviderMode = 'demo' | 'live' | 'manual';

export type DriverPaymentProvider = {
  name: string;
  mode: DriverPaymentProviderMode;
  shopId?: string;
};

export const driverCommissionPercent = 7;
export const driverServiceSharePercent = driverCommissionPercent;
export const driverPartnerProPrice = 3990;
export const driverPartnerProPlanId = 'partner_pro';
export const driverDailyCommissionTiers = [
  { fromOrder: 1, toOrder: 15, percent: 7 },
  { fromOrder: 16, toOrder: 20, percent: 5 },
  { fromOrder: 21, percent: 3 },
];

export function getDriverDailyCommissionPercent(orderNumber: number) {
  if (orderNumber >= 21) {
    return 3;
  }

  if (orderNumber >= 16) {
    return 5;
  }

  return 7;
}

export function getNextDriverDailyCommissionPercent(completedToday: number) {
  return getDriverDailyCommissionPercent(completedToday + 1);
}

export type MonthlySubscriptionPlan = {
  accessDays: number;
  amount: number;
  currency: '₽';
  ownerType: SubscriptionOwnerType;
  type: 'driver_monthly';
};

export const monthlySubscriptionPlans: Record<SubscriptionOwnerType, MonthlySubscriptionPlan> = {
  self_employed_driver: {
    accessDays: 30,
    amount: driverPartnerProPrice,
    currency: '₽',
    ownerType: 'self_employed_driver',
    type: 'driver_monthly',
  },
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
  providerPaymentStatus?: string;
  providerOrderId?: string;
  providerRebillId?: string;
  providerError?: string;
  confirmationUrl?: string;
  status: DriverSubscriptionPaymentStatus;
  accessStartsAt?: string;
  accessExpiresAt?: string;
  paidAt?: string;
  refundedAt?: string;
  refundReason?: string;
  providerRefundId?: string;
  providerRefundStatus?: string;
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
    benefits: string[];
    salesCopy: string;
    subscriptionPlan: string;
    primaryAction: string;
  }
> = {
  monthly: {
    accessDays: 30,
    commissionPercent: 0,
    currency: '₽',
    description:
      'Один платеж в месяц — и все заказы полностью ваши. Без процентов с поездок. Без скрытых удержаний.',
    benefits: [
      'Заказы без комиссии',
      'Вся сумма поездки остается водителю',
      'Фиксированная оплата на месяц',
      'Без скрытых удержаний',
      'Чем больше поездок — тем выгоднее тариф',
    ],
    headline: '3 990 ₽ / месяц',
    id: 'monthly',
    monthlyPrice: monthlySubscriptionPlans.self_employed_driver.amount,
    name: 'Партнёр PRO',
    primaryAction: 'Подключить за 3 990 ₽',
    salesCopy: 'Фиксированная подписка: платформа не забирает процент с заказов.',
    shortName: 'Партнёр PRO',
    subscriptionPlan: driverPartnerProPlanId,
  },
  commission: {
    commissionPercent: driverCommissionPercent,
    currency: '₽',
    description:
      'Клиент платит водителю напрямую. Комиссия снижается по мере роста заказов за день.',
    benefits: [
      'Без ежемесячного платежа',
      '1–15 заказов в день: 7%',
      '16–20 заказов в день: 5%',
      '21-й заказ и дальше: 3%',
      'Дневная сверка с администратором',
    ],
    headline: '0 ₽/мес, комиссия 7% / 5% / 3%',
    id: 'commission',
    monthlyPrice: 0,
    name: 'Доля сервиса с поездки',
    primaryAction: 'Подключить ручную сверку',
    salesCopy: 'Стартовая модель для редких поездок и пилотной проверки.',
    shortName: 'Доля сервиса',
    subscriptionPlan: 'commission',
  },
};

export const driverSubscriptionPlan = driverAccessPlans.commission;

export const driverSubscriptionBenefits = [
  'Партнёр PRO: 3 990 ₽ в месяц и 0% комиссии с заказов.',
  'Вся сумма поездки остается водителю.',
  'Без подписки работает обычная модель: 7% / 5% / 3% за день.',
  'Администратор может активировать подписку вручную.',
];

export const driverSubscriptionRules = [
  'Доступ к заказам открывается только после проверки документов.',
  'Сервис не становится работодателем водителя.',
  'Заказы распределяются по спросу, рейтингу, географии и доступности.',
  'Доля сервиса начисляется только в режиме комиссии: 7% / 5% / 3% за день.',
  'При активном тарифе Партнёр PRO комиссия с заказа равна 0%.',
  'В конце рабочего дня водитель переводит начисленную долю сервиса и администратор подтверждает сверку.',
  'Возвраты, безопасность и спорные поездки остаются под правилами сервиса.',
];

export const driverSubscriptionEconomics = [
  {
    label: 'Доля сервиса',
    value: `${driverCommissionPercent}%`,
    helper: 'Водитель переводит ее в конце рабочего дня',
  },
  {
    label: 'Онлайн-оплата',
    value: 'Нет',
    helper: 'Клиент рассчитывается напрямую с водителем',
  },
  {
    label: 'Главная задача',
    value: 'Трафик',
    helper: 'Сервис должен приводить клиентов и держать плотность заказов.',
  },
];
