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
    amount: 0,
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
    accessDays: 0,
    commissionPercent: 0,
    currency: '₽',
    description:
      'Legacy-режим ручного допуска без онлайн-оплаты. Для нового пилота используется дневная доля сервиса.',
    headline: 'Legacy-доступ без онлайн-оплаты',
    id: 'monthly',
    monthlyPrice: monthlySubscriptionPlans.self_employed_driver.amount,
    name: 'Ручной legacy-доступ',
    primaryAction: 'Зафиксировать вручную',
    shortName: 'Legacy',
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
    primaryAction: 'Подключить ручную сверку',
    shortName: 'Доля сервиса',
  },
};

export const driverSubscriptionPlan = driverAccessPlans.commission;

export const driverSubscriptionBenefits = [
  'Платежных систем в пилоте нет: клиент платит водителю напрямую.',
  `Доля сервиса: ${driverCommissionPercent}% с каждой завершенной поездки без ежемесячной оплаты.`,
  'Клиентская оплата поступает водителю, а приложение считает сумму к вечернему переводу сервису.',
  'Водитель сам получает оплату за поездку и закрывает дневную сверку.',
  'Администратор подтверждает перевод доли сервиса вручную.',
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
