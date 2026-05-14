import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

import { AccountRole } from '../data/registration';
import { driverSubscriptionPlan } from '../data/subscription';
import { OrderStatusSummary } from '../navigation/types';

export type SavedPlace = {
  id: 'home';
  title: string;
  address: string;
  entrance?: string;
  comment?: string;
  updatedAt: string;
};

export type DriverSubscription = {
  status: 'inactive' | 'active';
  planName: string;
  monthlyPrice: number;
  ordersCommission: number;
  expiresAt?: string;
};

export type OrderParticipant = {
  id: string;
  name: string;
  vehicle?: string;
  rating?: number;
  plate?: string;
};

export type TripReceipt = {
  id: string;
  orderId: string;
  issuedAt: string;
  total: number;
  paymentMethod: string;
  fiscalStatus: 'demo' | 'server';
};

export type TripReview = {
  orderId: string;
  rating: number;
  mood: string;
  facets: string[];
  comment: string;
  driverId: string;
  driverName: string;
  routeSignature: string;
  createdAt: string;
};

export type FavoriteDriver = OrderParticipant & {
  addedAt: string;
  lastOrderId: string;
  reason: string;
};

export type AppOrder = OrderStatusSummary & {
  role: AccountRole;
  status: string;
  createdAt: string;
  driver?: OrderParticipant;
  receipt?: TripReceipt;
  review?: TripReview;
};

export type SupportMessage = {
  id: string;
  author: 'support' | 'system' | 'user';
  text: string;
  createdAt: string;
};

export type SupportThread = {
  id: string;
  role: AccountRole;
  category: string;
  title: string;
  status: 'open' | 'waiting' | 'closed';
  updatedAt: string;
  messages: SupportMessage[];
};

type AppStateValue = {
  orders: AppOrder[];
  driverSubscription: DriverSubscription;
  favoriteDrivers: FavoriteDriver[];
  savedHomeAddress?: SavedPlace;
  supportThreads: SupportThread[];
  addOrder: (order: OrderStatusSummary, role: AccountRole) => void;
  addFavoriteDriver: (driver: FavoriteDriver) => void;
  addOrderReview: (orderId: string, review: Omit<TripReview, 'createdAt' | 'routeSignature'>) => void;
  saveHomeAddress: (place: Omit<SavedPlace, 'id' | 'title' | 'updatedAt'>) => void;
  sendSupportMessage: (params: {
    role: AccountRole;
    category: string;
    text: string;
    title?: string;
  }) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
  activateDriverSubscription: () => void;
};

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

const initialDriverSubscription: DriverSubscription = {
  monthlyPrice: driverSubscriptionPlan.monthlyPrice,
  ordersCommission: driverSubscriptionPlan.commissionPercent,
  planName: driverSubscriptionPlan.name,
  status: 'inactive',
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [savedHomeAddress, setSavedHomeAddress] = useState<SavedPlace | undefined>();
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [driverSubscription, setDriverSubscription] =
    useState<DriverSubscription>(initialDriverSubscription);

  const value = useMemo<AppStateValue>(
    () => ({
      activateDriverSubscription: () => {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + driverSubscriptionPlan.accessDays);

        setDriverSubscription({
          ...initialDriverSubscription,
          expiresAt: expiresAt.toISOString(),
          status: 'active',
        });
      },
      addOrder: (order, role) => {
        setOrders((current) => {
          const nextOrder: AppOrder = {
            ...order,
            createdAt: new Date().toISOString(),
            driver: role === 'client' ? defaultDriver : undefined,
            role,
            status: role === 'client' ? 'searching' : role === 'driver' ? 'accepted' : 'created',
          };

          return [nextOrder, ...current.filter((item) => item.id !== order.id)];
        });
      },
      addFavoriteDriver: (driver) => {
        setFavoriteDrivers((current) => [
          driver,
          ...current.filter((item) => item.id !== driver.id),
        ]);
      },
      addOrderReview: (orderId, review) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  review: {
                    ...review,
                    createdAt: new Date().toISOString(),
                    routeSignature: createRouteSignature(order),
                  },
                }
              : order,
          ),
        );
      },
      driverSubscription,
      favoriteDrivers,
      orders,
      saveHomeAddress: (place) => {
        setSavedHomeAddress({
          ...place,
          id: 'home',
          title: 'Дом',
          updatedAt: new Date().toISOString(),
        });
      },
      savedHomeAddress,
      sendSupportMessage: ({ category, role, text, title }) => {
        const now = new Date().toISOString();
        const normalizedCategory = category.trim() || 'Общий вопрос';
        const threadId = `${role}-${normalizeThreadKey(normalizedCategory)}`;
        const userMessage: SupportMessage = {
          author: 'user',
          createdAt: now,
          id: `MSG-${Date.now()}`,
          text: text.trim(),
        };
        const supportMessage: SupportMessage = {
          author: 'support',
          createdAt: now,
          id: `MSG-${Date.now()}-support`,
          text:
            'Мы получили сообщение. Специалист увидит категорию, поездку и историю переписки в сервере сообщений.',
        };

        setSupportThreads((current) => {
          const existing = current.find((thread) => thread.id === threadId);

          if (existing) {
            return [
              {
                ...existing,
                messages: [...existing.messages, userMessage, supportMessage],
                status: 'waiting',
                updatedAt: now,
              },
              ...current.filter((thread) => thread.id !== threadId),
            ];
          }

          const systemMessage: SupportMessage = {
            author: 'system',
            createdAt: now,
            id: `MSG-${Date.now()}-system`,
            text: `Категория: ${normalizedCategory}. Канал готов к подключению WebSocket/API.`,
          };

          return [
            {
              category: normalizedCategory,
              id: threadId,
              messages: [systemMessage, userMessage, supportMessage],
              role,
              status: 'waiting',
              title: title?.trim() || normalizedCategory,
              updatedAt: now,
            },
            ...current,
          ];
        });
      },
      supportThreads,
      updateOrderStatus: (orderId, status) => {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  receipt:
                    ['closed', 'completed'].includes(status) && !order.receipt
                      ? createReceipt(order)
                      : order.receipt,
                  status,
                }
              : order,
          ),
        );
      },
    }),
    [driverSubscription, favoriteDrivers, orders, savedHomeAddress, supportThreads],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }

  return value;
}

const defaultDriver: OrderParticipant = {
  id: 'driver-alexey-solaris',
  name: 'Алексей',
  plate: 'А123ВС 96',
  rating: 4.92,
  vehicle: 'Hyundai Solaris',
};

function createReceipt(order: OrderStatusSummary): TripReceipt {
  return {
    fiscalStatus: 'demo',
    id: `RC-${Date.now().toString().slice(-7)}`,
    issuedAt: new Date().toISOString(),
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    total: order.total,
  };
}

function createRouteSignature(order: OrderStatusSummary) {
  return `${order.pickup} -> ${order.destination}`;
}

function normalizeThreadKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
