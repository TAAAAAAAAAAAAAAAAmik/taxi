// Оценка маршрута и тарифа для OrderFlowScreen: расстояние, длительность, цена и
// сопоставление с популярными маршрутами района. Вынесено из OrderFlowScreen, чтобы
// держать чистую (без UI) логику отдельно от экрана. Поведение не менялось.
import { AccountRole, isDriverLikeRole } from '../data/registration';
import { OrderTariff } from '../data/orderFlow';
import { salavatPopularRoutes } from '../data/salavatDistrict';

export type OrderServiceType = 'delivery' | 'taxi';

export type RouteEstimate = {
  confidence: 'draft' | 'estimated' | 'preset';
  distanceKm: number;
  distancePrice: number;
  durationMin: number;
  note: string;
  surgeCoefficient?: number;
  total: number;
};

export function getGeoDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 10) / 10;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function buildRouteEstimate({
  destination,
  optionsTotal,
  pickup,
  role,
  serviceType,
  stopsCount,
  tariff,
}: {
  destination: string;
  optionsTotal: number;
  pickup: string;
  role: AccountRole;
  serviceType: OrderServiceType;
  stopsCount: number;
  tariff: OrderTariff;
}): RouteEstimate {
  const hasRoute = Boolean(pickup.trim()) && Boolean(destination.trim());

  if (!hasRoute) {
    return {
      confidence: 'draft',
      distanceKm: 0,
      distancePrice: 0,
      durationMin: 0,
      note: 'укажите маршрут',
      total: tariff.price + optionsTotal,
    };
  }

  const preset = findMatchingRoutePreset(pickup, destination);
  const baseDistanceKm = preset?.estimatedDistanceKm ?? estimateDistanceKm(pickup, destination);
  const distanceKm = Math.round((baseDistanceKm + stopsCount * 1.8) * 10) / 10;
  const durationMin =
    (preset?.estimatedTime ? parseRouteTime(preset.estimatedTime) : estimateDurationMin(baseDistanceKm)) +
    stopsCount * 6;

  if (!isDriverLikeRole(role) && tariff.id === 'economy') {
    const economyBase = serviceType === 'delivery' ? 160 : 120;
    return {
      confidence: preset ? 'preset' : 'estimated',
      distanceKm,
      distancePrice: economyBase + stopsCount * 40,
      durationMin,
      note: stopsCount ? `${serviceType === 'delivery' ? 'Доставка' : 'Фиксированная цена'} · ${stopsCount} ост.` : serviceType === 'delivery' ? 'Доставка по району' : 'Фиксированная цена',
      total: economyBase + stopsCount * 40 + optionsTotal,
    };
  }

  const rate = getFareRate(tariff.id, role);
  const distancePrice = roundToTen(distanceKm * rate.perKm + durationMin * rate.perMin);
  const calculatedTotal = rate.base + distancePrice + optionsTotal;
  const total = roundToTen(Math.max(tariff.price + optionsTotal, calculatedTotal));

  return {
    confidence: preset ? 'preset' : 'estimated',
    distanceKm,
    distancePrice,
    durationMin,
    note: stopsCount
      ? `${preset ? 'популярный маршрут' : 'предварительная оценка'} · ${stopsCount} ост.`
      : preset ? 'популярный маршрут' : 'предварительная оценка',
    total,
  };
}

function findMatchingRoutePreset(pickup: string, destination: string) {
  const normalizedPickup = normalizeRouteText(pickup);
  const normalizedDestination = normalizeRouteText(destination);

  return salavatPopularRoutes.find(
    (route) =>
      addressLooksSame(normalizedPickup, normalizeRouteText(route.pickup)) &&
      addressLooksSame(normalizedDestination, normalizeRouteText(route.destination)),
  );
}

function normalizeRouteText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressLooksSame(left: string, right: string) {
  return left === right || left.includes(right) || right.includes(left);
}

function estimateDistanceKm(pickup: string, destination: string) {
  const pickupPoint = getRouteAnchor(pickup);
  const destinationPoint = getRouteAnchor(destination);

  if (!pickupPoint || !destinationPoint) {
    return pickupPoint || destinationPoint ? 14 : 9;
  }

  const distance = Math.abs(pickupPoint.kmFromMaloyaz - destinationPoint.kmFromMaloyaz);
  return Math.max(distance, 3.2);
}

function getRouteAnchor(address: string) {
  const normalizedAddress = normalizeRouteText(address);
  const anchors = [
    { keys: ['малояз', 'црб', 'центральная районная больница'], kmFromMaloyaz: 0 },
    { keys: ['янгантау', 'санаторий'], kmFromMaloyaz: 17.5 },
    { keys: ['кургазак', 'комсомол'], kmFromMaloyaz: 19.5 },
    { keys: ['мурсалимкино'], kmFromMaloyaz: 31 },
    { keys: ['аркаулово'], kmFromMaloyaz: 22 },
    { keys: ['лаклы'], kmFromMaloyaz: 34 },
    { keys: ['идрисово'], kmFromMaloyaz: 24 },
  ];

  return anchors.find((anchor) => anchor.keys.some((key) => normalizedAddress.includes(key)));
}

function parseRouteTime(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];

  if (numbers.length >= 2) {
    return Math.round((numbers[0] + numbers[1]) / 2);
  }

  return numbers[0] ?? 12;
}

function estimateDurationMin(distanceKm: number) {
  return Math.max(8, Math.round(distanceKm * 1.35 + 6));
}

function getFareRate(tariffId: string, role: AccountRole) {
  if (isDriverLikeRole(role)) {
    return { base: 0, perKm: 22, perMin: 4 };
  }

  if (['business', 'airport'].includes(tariffId)) {
    return { base: 260, perKm: 42, perMin: 8 };
  }

  if (['comfort', 'current'].includes(tariffId)) {
    return { base: 160, perKm: 30, perMin: 5 };
  }

  return { base: 120, perKm: 24, perMin: 4 };
}

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

export function formatDistance(distanceKm: number) {
  if (!distanceKm) {
    return '0 км';
  }

  return `${distanceKm.toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: distanceKm % 1 === 0 ? 0 : 1,
  })} км`;
}

export function formatSurge(estimate: RouteEstimate) {
  const maybeEstimate = estimate as RouteEstimate & { surgeCoefficient?: number };
  return `${(maybeEstimate.surgeCoefficient ?? 1).toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}x`;
}
