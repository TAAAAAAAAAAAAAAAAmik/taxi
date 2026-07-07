import { AccountRole } from '../data/registration';

export type OrderServiceType = 'delivery' | 'taxi';
export type DeliveryHandoffType = 'door_to_door' | 'leave_at_door' | 'meet_outside';
export type DeliveryPackageType = 'documents' | 'food' | 'fragile' | 'other' | 'parcel';

export type OrderStatusSummary = {
  id: string;
  pickup: string;
  destination: string;
  serviceType?: OrderServiceType;
  deliveryHandoff?: DeliveryHandoffType | string;
  deliveryPackageType?: DeliveryPackageType | string;
  packageDescription?: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryComment?: string;
  tariff: string;
  tariffId?: string;
  total: number;
  paymentMethod: string;
  options: string[];
  optionsTotal?: number;
  scheduledAt?: string;
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
  stops?: string[];
  surgeCoefficient?: number;
};

export type RootStackParamList = {
  Welcome: undefined;
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
    presetDestination?: string;
    presetPickup?: string;
    serviceType?: OrderServiceType;
  };
  OrderStatus: {
    role: AccountRole;
    firstName?: string;
    order: OrderStatusSummary;
  };
  Subscription: {
    role: AccountRole;
    firstName?: string;
    context?: 'trial-ended';
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
  Navigator: {
    role: AccountRole;
    firstName?: string;
    pickup: string;
    destination: string;
    phase?: 'pickup' | 'trip';
  };
};
