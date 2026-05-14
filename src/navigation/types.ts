import { AccountRole } from '../data/registration';

export type OrderStatusSummary = {
  id: string;
  pickup: string;
  destination: string;
  tariff: string;
  total: number;
  paymentMethod: string;
  options: string[];
};

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Registration: undefined;
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
};
