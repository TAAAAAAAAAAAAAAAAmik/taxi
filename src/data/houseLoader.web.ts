import type { SalavatHouseRecord } from './salavatDistrictHouseSourceSummary';

const HOUSES_ASSET_FILE = 'salavatDistrictHouses.json';

// На web справочник домов хранится отдельным статическим JSON-ассетом (public/),
// чтобы ~8.7 МБ не попадали в стартовый JS-бандл. Загрузка ленивая и отказоустойчивая:
// при недоступности ассета поиск просто работает без домов (улицы и POI остаются).
export async function loadHouseRecords(): Promise<SalavatHouseRecord[]> {
  try {
    const response = await fetch(resolveHousesAssetUrl());

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as SalavatHouseRecord[];

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function resolveHousesAssetUrl(): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return `/${HOUSES_ASSET_FILE}`;
  }

  const basePath = normalizeBasePath(
    process.env.EXPO_PUBLIC_WEB_BASE_PATH || inferHostedBasePath(),
  );

  return `${window.location.origin}${basePath}/${HOUSES_ASSET_FILE}`;
}

function normalizeBasePath(value: string | undefined): string {
  const rawPath = String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');

  return rawPath ? `/${rawPath}` : '';
}

// Тот же приём, что в AppNavigator: при хостинге на *.github.io берём первый сегмент
// пути (например, /taxi) как базовый префикс для ассетов.
function inferHostedBasePath(): string {
  if (typeof window === 'undefined' || !window.location?.hostname || !window.location?.pathname) {
    return '';
  }

  if (!window.location.hostname.toLowerCase().endsWith('.github.io')) {
    return '';
  }

  return (
    window.location.pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean)[0] ?? ''
  );
}
