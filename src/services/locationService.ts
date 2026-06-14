import { Platform } from 'react-native';
import * as Location from 'expo-location';

import type { GeoPoint } from '../data/salavatDistrict';
import {
  getPublicEnv,
  isExamplePublicValue,
  isLocalPublicValue,
  isProductionApp,
} from '../utils/runtimeFlags';
import { reverseGeocodeAddress } from './apiClient';

type BrowserGeolocationPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
};

type BrowserGeolocationError = {
  code?: number;
  message?: string;
};

type BrowserNavigator = {
  geolocation?: {
    getCurrentPosition: (
      onSuccess: (position: BrowserGeolocationPosition) => void,
      onError: (error: BrowserGeolocationError) => void,
      options?: { enableHighAccuracy?: boolean; maximumAge?: number; timeout?: number },
    ) => void;
  };
};

export type UserLocationResult =
  | {
      status: 'granted';
      point: GeoPoint;
      accuracy?: number;
    }
  | {
      status: 'denied' | 'unavailable' | 'timeout';
      message: string;
    };

export type ReverseGeocodedAddress = {
  displayAddress: string;
  region?: string;
  district?: string;
  settlement?: string;
  street?: string;
  house?: string;
  latitude: number;
  longitude: number;
};

export type ReverseGeocodeResult =
  | {
      status: 'resolved';
      address: ReverseGeocodedAddress;
    }
  | {
      status: 'unavailable';
      message: string;
      point: GeoPoint;
    };

export async function requestUserLocation(): Promise<UserLocationResult> {
  if (Platform.OS !== 'web') {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        return {
          message: 'Доступ к геолокации отклонен. Можно продолжить без точного ближайшего заказа.',
          status: 'denied',
        };
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        accuracy: position.coords.accuracy ?? undefined,
        point: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        status: 'granted',
      };
    } catch {
      return {
        message: 'Не удалось получить геолокацию. Можно продолжить без точного ближайшего заказа.',
        status: 'unavailable',
      };
    }
  }

  const maybeNavigator = globalThis as typeof globalThis & { navigator?: BrowserNavigator };

  if (!maybeNavigator.navigator?.geolocation) {
    return {
      message: 'Геолокация недоступна в этой среде. Можно ввести адрес вручную.',
      status: 'unavailable',
    };
  }

  return new Promise((resolve) => {
    maybeNavigator.navigator?.geolocation?.getCurrentPosition(
      (position) => {
        resolve({
          accuracy: position.coords.accuracy,
          point: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          status: 'granted',
        });
      },
      (error) => {
        resolve({
          message:
            error.code === 1
              ? 'Доступ к геолокации отклонен. Можно ввести адрес вручную.'
              : 'Не удалось получить геолокацию. Попробуйте еще раз или введите адрес вручную.',
          status: error.code === 3 ? 'timeout' : 'denied',
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 8000,
      },
    );
  });
}

export async function reverseGeocodePoint(point: GeoPoint): Promise<ReverseGeocodeResult> {
  const endpoint = String(getPublicEnv('EXPO_PUBLIC_REVERSE_GEOCODE_URL') || '').trim();
  const hasProviderEndpoint =
    Boolean(endpoint) && !isExamplePublicValue(endpoint) && (!isProductionApp() || !isLocalPublicValue(endpoint));

  if (!hasProviderEndpoint) {
    try {
      const address = await reverseGeocodeAddress(point);

      return {
        address: {
          displayAddress: address.displayAddress,
          district: address.settlement,
          latitude: address.latitude,
          longitude: address.longitude,
          region: address.region,
          settlement: address.settlement,
        },
        status: 'resolved',
      };
    } catch {
      return makeReverseGeocodeUnavailable(point);
    }
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set('latitude', String(point.latitude));
    url.searchParams.set('longitude', String(point.longitude));
    url.searchParams.set('lat', String(point.latitude));
    url.searchParams.set('lon', String(point.longitude));

    const response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return makeReverseGeocodeUnavailable(point);
    }

    const payload = await response.json();
    const address = normalizeReverseGeocodePayload(payload, point);

    if (!address?.displayAddress) {
      return makeReverseGeocodeUnavailable(point);
    }

    return {
      address,
      status: 'resolved',
    };
  } catch {
    return makeReverseGeocodeUnavailable(point);
  }
}

function normalizeReverseGeocodePayload(payload: unknown, point: GeoPoint): ReverseGeocodedAddress | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const nestedAddress =
    data.address && typeof data.address === 'object' ? (data.address as Record<string, unknown>) : {};
  const source = { ...nestedAddress, ...data };
  const street = readString(source.street) ?? readString(source.road);
  const house = readString(source.house) ?? readString(source.houseNumber);
  const settlement =
    readString(source.settlement) ??
    readString(source.village) ??
    readString(source.town) ??
    readString(source.city);
  const district = readString(source.district) ?? readString(source.county);
  const region = readString(source.region) ?? readString(source.state);
  const displayAddress =
    readString(source.displayAddress) ??
    readString(source.formatted) ??
    readString(source.name) ??
    [street && house ? `${street}, ${house}` : street, settlement, district, region]
      .filter(Boolean)
      .join(', ');

  if (!displayAddress) {
    return null;
  }

  return {
    displayAddress,
    district,
    house,
    latitude: point.latitude,
    longitude: point.longitude,
    region,
    settlement,
    street,
  };
}

function makeReverseGeocodeUnavailable(point: GeoPoint): ReverseGeocodeResult {
  return {
    message: 'Не удалось определить адрес, введите вручную.',
    point,
    status: 'unavailable',
  };
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
