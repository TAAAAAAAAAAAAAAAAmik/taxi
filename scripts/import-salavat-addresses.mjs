import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'src', 'data', 'salavatDistrictHouses.ts');

const SALAVAT_AREA_ID = 3600398510;
const SALAVAT_RELATION_ID = 398510;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const ADDRESS_QUERY = `
[out:json][timeout:180];
area(${SALAVAT_AREA_ID})->.a;
(
  node(area.a)["addr:housenumber"];
  way(area.a)["addr:housenumber"];
  relation(area.a)["addr:housenumber"];
);
out tags center;
`;

const PLACE_QUERY = `
[out:json][timeout:120];
area(${SALAVAT_AREA_ID})->.a;
(
  node(area.a)["place"]["name"];
  way(area.a)["place"]["name"];
  relation(area.a)["place"]["name"];
);
out tags center;
`;

const PLACE_RANK = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'locality',
  'isolated_dwelling',
]);

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return normalize(value).replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '');
}

function cleanDisplayName(value) {
  return String(value ?? '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function stripSettlementPrefix(value) {
  return cleanDisplayName(value)
    .replace(/^(?:с|д|п|рп|деревня|село|поселок|посёлок)\.?\s+/i, '')
    .trim();
}

function ensureStreetType(rawName) {
  const name = cleanDisplayName(rawName)
    .replace(/^(?:ул\.?|улица)\s+/i, '')
    .replace(/\s+улица$/i, '')
    .trim();

  if (!name) {
    return cleanDisplayName(rawName);
  }

  if (/\b(улица|переулок|пер\.|проспект|пр-т|тракт|шоссе|дорога|проезд|площадь|бульвар|микрорайон|территория)\b/i.test(name)) {
    return name.replace(/\bпер\.\b/i, 'переулок').replace(/\bпр-т\b/i, 'проспект');
  }

  return `${name} улица`;
}

function pointOf(element) {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { latitude: element.lat, longitude: element.lon };
  }

  if (element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }

  return undefined;
}

function distanceMeters(a, b) {
  const radius = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearestSettlement(point, places) {
  if (!point || places.length === 0) {
    return 'Салаватский район';
  }

  return places
    .map((place) => ({ place, distance: distanceMeters(point, place.coordinates) }))
    .sort((left, right) => left.distance - right.distance)[0].place.name;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function makeAliases(settlement, street, house) {
  const streetWithoutType = street.replace(/\s+улица$/i, '').trim();
  return unique([
    `${street} ${house}`,
    `${street}, ${house}`,
    `${streetWithoutType} ${house}`,
    `${settlement} ${street} ${house}`,
    `${settlement} ${streetWithoutType} ${house}`,
    normalize(`${street} ${house}`),
    normalize(`${settlement} ${street} ${house}`),
  ]).filter((alias) => alias.length > 1);
}

async function fetchOverpass(query) {
  const body = new URLSearchParams({ data: query }).toString();
  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json,text/plain,*/*',
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'taxi-partner-app-address-import/1.0',
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`${endpoint} returned ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed: ${endpoint} (${error.message})`);
    }
  }

  throw lastError;
}

function extractPlaces(elements) {
  const seen = new Map();

  for (const element of elements) {
    const name = element.tags?.name;
    const placeType = element.tags?.place;
    const coordinates = pointOf(element);

    if (!name || !coordinates || !PLACE_RANK.has(placeType)) {
      continue;
    }

    const cleanName = stripSettlementPrefix(name);
    const key = normalize(cleanName);
    const current = seen.get(key);

    if (!current || placeType !== 'locality') {
      seen.set(key, {
        coordinates,
        name: cleanName,
        placeType,
      });
    }
  }

  return Array.from(seen.values()).sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

function extractHouseRecords(elements, places) {
  const records = new Map();

  for (const element of elements) {
    const tags = element.tags ?? {};
    const house = cleanDisplayName(tags['addr:housenumber']);
    const rawStreet = tags['addr:street'] || tags['addr:place'];
    const coordinates = pointOf(element);
    const settlement = stripSettlementPrefix(
      tags['addr:city'] || tags['addr:suburb'] || tags['addr:place'] || nearestSettlement(coordinates, places),
    );
    const street = ensureStreetType(rawStreet || settlement);

    if (!house || !street || !settlement) {
      continue;
    }

    const fullAddress = `${settlement}, ${street}, ${house}`;
    const key = `${normalize(settlement)}|${normalize(street)}|${normalize(house)}`;

    records.set(key, {
      aliases: makeAliases(settlement, street, house),
      coordinates,
      fullAddress,
      house,
      settlement,
      source: 'osm',
      street,
    });
  }

  return Array.from(records.values()).sort((left, right) => {
    const settlementOrder = left.settlement.localeCompare(right.settlement, 'ru');
    const streetOrder = left.street.localeCompare(right.street, 'ru');
    return settlementOrder || streetOrder || left.house.localeCompare(right.house, 'ru', { numeric: true });
  });
}

function serializeTs(records) {
  const generatedAt = new Date().toISOString();
  const json = JSON.stringify(records, null, 2).replace(/"([^"]+)":/g, '$1:');

  return `// This file is generated by scripts/import-salavat-addresses.mjs.
// Do not edit manually: rerun the import script after refreshing OSM/GAR source data.

export type SalavatHouseSource = 'gar' | 'osm' | 'manual' | 'merged';

export type SalavatHouseRecord = {
  settlement: string;
  street: string;
  house: string;
  fullAddress: string;
  source: SalavatHouseSource;
  aliases: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
};

export const salavatDistrictHouseSourceSummary = {
  district: 'Салаватский район, Республика Башкортостан',
  osmRelationId: ${SALAVAT_RELATION_ID},
  generatedAt: '${generatedAt}',
  note:
    'Точечные дома собраны из открытых адресных тегов OpenStreetMap внутри relation 398510. Для продакшена дополнительно подключите официальный ГАР/ФИАС на сервере и регулярно сверяйте слой домов.',
  osmHouses: ${records.length},
  garHouses: 0,
  manualHouses: 0,
  houses: ${records.length},
} as const;

export const salavatDistrictHouses: SalavatHouseRecord[] = ${json};
`;
}

const placesResponse = await fetchOverpass(PLACE_QUERY);
const addressResponse = await fetchOverpass(ADDRESS_QUERY);
const places = extractPlaces(placesResponse.elements ?? []);
const records = extractHouseRecords(addressResponse.elements ?? [], places);

await writeFile(outputPath, serializeTs(records), 'utf8');
console.log(`Generated ${records.length} house address records: ${outputPath}`);
