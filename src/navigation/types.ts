import { AccountRole } from '../data/registration';

export type OrderStatusSummary = {
  id: string;
  pickup: string;
  destination: string;
  tariff: string;
  tariffId?: string;
  total: number;
  paymentMethod: string;
  options: string[];
  optionsTotal?: number;
  routeEstimate?: {
    confidence: 'draft' | 'estimated' | 'preset';
    calculatedAt?: string;
    currency?: 'RUB' | string;
    distanceKm: number;
    distancePrice: number;
    durationMin: number;
    eta?: string;
    note: string;
    surgeCoefficient?: number;
    tariffId?: string;
    total: number;
  };
  surgeCoefficient?: number;
};

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  PasswordReset: undefined;
  AdminPanel: undefined;
  Registration:
    | {
        referralCode?: string;
        role?: AccountRole;
      }
    | undefined;
  VerifyPhone: {
    email?: string;
    role: AccountRole;
    firstName?: string;
    phone?: string;
  };
  VerifyEmail: {
    role: AccountRole;
    firstName?: string;
    email?: string;
  };
  Dashboard: {
    role: AccountRole;
    firstName?: string;
  };
  OrderFlow: {
    role: AccountRole;
    firstName?: string;
  };
  OrderStatus: {
    role: AccountRole;
    firstName?: string;
    order: OrderStatusSummary;
  };
  Subscription: {
    role: AccountRole;
    firstName?: string;
  };
  DriverDocuments: {
    role: AccountRole;
    firstName?: string;
  };
  OrderHistory: {
    role: AccountRole;
    firstName?: string;
  };
  SavedPlace: {
    role: AccountRole;
    firstName?: string;
  };
  SupportChat: {
    role: AccountRole;
    firstName?: string;
    category?: string;
  };
  Referral: {
    role: AccountRole;
    firstName?: string;
  };
};
