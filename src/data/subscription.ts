export type DriverBillingMode = 'monthly' | 'daily';
export type SubscriptionOwnerType = 'self_employed_driver';

export type DriverSubscriptionPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type DriverPaymentProviderMode = 'demo' | 'live' | 'manual';

export type DriverPaymentProvider = {
  name: string;
  mode: DriverPaymentProviderMode;
  shopId?: string;
};

export const driverPartnerProPrice = 2490;
export const driverPartnerProPlanId = 'partner_pro';
export const driverDailyPrice = 100;
export const driverDailyPlanId = 'daily_line';
export const driverDailyAccessDays = 1;

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
    currency: '₽',
    description:
      'Один платеж в месяц — и все заказы полностью ваши. Без процентов с поездок. Без скрытых удержаний.',
    benefits: [
      'Заказы без удержаний',
      'Вся сумма поездки остается водителю',
      'Фиксированная оплата на месяц',
      'Без скрытых удержаний',
      'Чем больше поездок — тем выгоднее тариф',
    ],
    headline: '2 490 ₽ / месяц',
    id: 'monthly',
    monthlyPrice: monthlySubscriptionPlans.self_employed_driver.amount,
    name: 'Партнёр PRO',
    primaryAction: 'Подключить за 2 490 ₽',
    salesCopy: 'Фиксированная подписка: платформа не забирает процент с заказов.',
    shortName: 'Партнёр PRO',
    subscriptionPlan: driverPartnerProPlanId,
  },
  daily: {
    accessDays: driverDailyAccessDays,
    currency: '₽',
    description:
      'Доступ к заказам на 24 часа. Платите только в дни, когда выходите на линию.',
    benefits: [
      'Доступ на 24 часа',
      'Платите только за рабочие дни',
      'Заказы без процентов',
      'Вся сумма поездки остаётся водителю',
    ],
    headline: '100 ₽ / день',
    id: 'daily',
    monthlyPrice: driverDailyPrice,
    name: 'Дневной доступ',
    primaryAction: 'Открыть линию за 100 ₽',
    salesCopy: 'Гибкий вход: платите в день, без процентов и без месячного обязательства.',
    shortName: 'День',
    subscriptionPlan: driverDailyPlanId,
  },
};

export const driverSubscriptionPlan = driverAccessPlans.daily;

export const driverSubscriptionBenefits = [
  'Дневной доступ: 100 ₽ за 24 часа на линии.',
  'Партнёр PRO: 2 490 ₽ в месяц.',
  'Никаких процентов с заказов — вся сумма поездки остаётся водителю.',
  'Администратор может активировать доступ вручную.',
];

export const driverSubscriptionRules = [
  'Доступ к заказам открывается только после проверки документов.',
  'Сервис не становится работодателем водителя.',
  'Заказы распределяются по спросу, рейтингу, географии и доступности.',
  'Оплата за поездку идёт водителю напрямую — сервис не берёт процент с заказов.',
  'Доступ к линии открывается дневным пассом (100 ₽) или подпиской Партнёр PRO (2 490 ₽/мес).',
  'Возвраты, безопасность и спорные поездки остаются под правилами сервиса.',
];

export const driverSubscriptionEconomics = [
  {
    label: 'Доступ на линию',
    value: '100 ₽ / день',
    helper: 'Или 2 490 ₽ в месяц по подписке Партнёр PRO',
  },
  {
    label: 'Процент с заказа',
    value: 'Нет',
    helper: 'Сервис не берёт процент — вся сумма поездки остаётся водителю',
  },
  {
    label: 'Онлайн-оплата',
    value: 'Нет',
    helper: 'Клиент рассчитывается напрямую с водителем',
  },
];
