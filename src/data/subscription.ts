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
    amount: 3000,
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
    primaryAction: string;
  }
> = {
  monthly: {
    accessDays: 30,
    commissionPercent: 0,
    currency: '₽',
    description:
      'Водитель платит 3000 ₽ в месяц и работает без комиссии с поездок до конца расчетного периода.',
    headline: '3000 ₽/мес, без комиссии',
    id: 'monthly',
    monthlyPrice: monthlySubscriptionPlans.self_employed_driver.amount,
    name: 'Ежемесячная подписка',
    primaryAction: 'Оплатить подписку',
    shortName: 'Подписка',
  },
  commission: {
    commissionPercent: driverCommissionPercent,
    currency: '₽',
    description:
      'Клиент платит водителю напрямую. Сервис считает 7% с завершенной поездки как долю к переводу в конце рабочего дня.',
    headline: `0 ₽/мес, ${driverCommissionPercent}% к переводу`,
    id: 'commission',
    monthlyPrice: 0,
    name: 'Доля сервиса с поездки',
    primaryAction: 'Подключить долю сервиса',
    shortName: 'Доля сервиса',
  },
};

export const driverSubscriptionPlan = driverAccessPlans.monthly;

export const driverSubscriptionBenefits = [
  'Подписка: 3000 ₽ в месяц без комиссии с поездок.',
  `Доля сервиса: ${driverCommissionPercent}% с каждой завершенной поездки без ежемесячной оплаты.`,
  'Клиентская оплата поступает водителю, а приложение считает сумму к вечернему переводу сервису.',
  'Водитель может поменять модель, изменение применяется со следующего расчетного периода.',
  'Водитель сам получает оплату за поездку и подтверждает перевод доли сервиса.',
];

export const driverSubscriptionRules = [
  'Доступ к заказам открывается только после проверки документов.',
  'Сервис не становится работодателем водителя.',
  'Заказы распределяются по спросу, рейтингу, географии и доступности.',
  `Доля сервиса начисляется только в режиме комиссии: ${driverCommissionPercent}% с поездки.`,
  'В конце рабочего дня водитель переводит начисленную долю сервиса и администратор подтверждает сверку.',
  'Возвраты, безопасность и спорные поездки остаются под правилами сервиса.',
];

export const driverSubscriptionEconomics = [
  {
    label: 'Подписка',
    value: `${monthlySubscriptionPlans.self_employed_driver.amount} ${monthlySubscriptionPlans.self_employed_driver.currency}/мес`,
    helper: 'Без комиссии с поездок',
  },
  {
    label: 'Доля сервиса',
    value: `${driverCommissionPercent}%`,
    helper: 'Водитель переводит ее в конце рабочего дня',
  },
  {
    label: 'Главная задача',
    value: 'Трафик',
    helper: 'Сервис должен приводить клиентов и держать плотность заказов.',
  },
];
