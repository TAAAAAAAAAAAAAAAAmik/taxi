import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'src', 'data', 'salavatDistrictStreets.ts');

const FIAS_DISTRICT_URL = 'https://fias.nalog-udc.ru/Home/Index/41940';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const SALAVAT_AREA_ID = 3600398510;
const SALAVAT_RELATION_ID = 398510;

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

const STREET_QUERY = `
[out:json][timeout:120];
area(${SALAVAT_AREA_ID})->.a;
(
  way(area.a)["highway"]["name"];
  relation(area.a)["highway"]["name"];
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

const HIGHWAY_TYPES_TO_SKIP = new Set([
  'bus_stop',
  'construction',
  'corridor',
  'elevator',
  'escape',
  'footway',
  'path',
  'platform',
  'raceway',
  'steps',
]);

const FIAS_STREET_TYPE_LABELS = new Map([
  ['аллея', 'аллея'],
  ['б-р', 'бульвар'],
  ['бульвар', 'бульвар'],
  ['дор', 'дорога'],
  ['дорога', 'дорога'],
  ['линия', 'линия'],
  ['мкр', 'микрорайон'],
  ['пер', 'переулок'],
  ['переулок', 'переулок'],
  ['пл', 'площадь'],
  ['площадь', 'площадь'],
  ['проезд', 'проезд'],
  ['пр-кт', 'проспект'],
  ['проспект', 'проспект'],
  ['тер', 'территория'],
  ['тракт', 'тракт'],
  ['ул', 'улица'],
  ['ш', 'шоссе'],
  ['шоссе', 'шоссе'],
]);

function normalizeForSearch(value) {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/\b(улица|ул\.?|проспект|пр-т|переулок|пер\.?|дорога|тракт)\b/g, '')
    .replace(/[.,;:()/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDisplayName(value) {
  return value
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function stripSettlementPrefix(value) {
  return value
    .replace(/^(?:с|д|п|рп|деревня|село|поселок|посёлок)\.?\s+/i, '')
    .trim();
}

function parseEmbeddedSettlementAndStreet(rawName) {
  const name = cleanDisplayName(rawName);
  const match = name.match(
    /^(?:с|д|п|рп|деревня|село|поселок|посёлок)?\.?\s*([^,.]+)[,.]\s*(?:ул\.?\.?|улица)\s+(.+)$/i,
  );

  if (!match) {
    return null;
  }

  return {
    settlement: stripSettlementPrefix(match[1]),
    street: ensureStreetType(match[2]),
  };
}

function ensureStreetType(rawName) {
  const name = cleanDisplayName(rawName)
    .replace(/^(?:ул\.?\.?|улица)\s+/i, '')
    .replace(/\s+улица$/i, '')
    .trim();

  if (!name) {
    return cleanDisplayName(rawName);
  }

  if (/\b(переулок|пер\.|проспект|пр-т|тракт|шоссе|дорога|проезд|площадь|бульвар)\b/i.test(name)) {
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

function makeAliases(settlement, street) {
  const withoutStreetType = street.replace(/\s+улица$/i, '').trim();
  return unique([
    street,
    withoutStreetType,
    `${settlement} ${street}`,
    `${settlement} ${withoutStreetType}`,
    normalizeForSearch(street),
    normalizeForSearch(`${settlement} ${street}`),
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
          'user-agent': 'taxi-partner-app-import/1.0',
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

async function fetchFiasPage(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,*/*',
      'user-agent': 'taxi-partner-app-import/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`FIAS page ${url} returned ${response.status}`);
  }

  return response.text();
}

async function importFiasRecords() {
  const districtHtml = await fetchFiasPage(FIAS_DISTRICT_URL);
  const version = extractFiasVersion(districtHtml);
  const districtEntries = parseFiasEntries(districtHtml).filter(isDistrictChildEntry);
  const records = [];

  for (const entry of districtEntries) {
    const html = await fetchFiasPage(entry.url);
    const streetEntries = parseFiasEntries(html).filter(isFiasStreetEntry);

    for (const streetEntry of streetEntries) {
      const street = formatFiasStreet(streetEntry);

      records.push({
        settlement: entry.name,
        street,
        source: 'gar',
        aliases: makeAliases(entry.name, street),
      });
    }
  }

  return {
    records,
    version,
  };
}

function extractFiasVersion(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return text.match(/БД ФИАС от\s+(\d{2}\.\d{2}\.\d{4})/)?.[1];
}

function parseFiasEntries(html) {
  const entries = [];
  const anchorPattern = /<a\s+href="([^"]*\/Home\/Index\/(\d+))"[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const label = decodeHtml(match[3]).trim();
    const parsed = parseFiasLabel(label);

    if (!parsed) {
      continue;
    }

    entries.push({
      id: match[2],
      label,
      name: parsed.name,
      type: parsed.type,
      url: new URL(match[1], FIAS_DISTRICT_URL).toString(),
    });
  }

  return entries;
}

function parseFiasLabel(label) {
  const match = label.match(/^(.+),\s*([^,]+)$/);

  if (!match) {
    return null;
  }

  return {
    name: cleanDisplayName(match[1]),
    type: normalizeFiasType(match[2]),
  };
}

function normalizeFiasType(value) {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/\.+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDistrictChildEntry(entry) {
  const normalizedName = normalizeForSearch(entry.name);

  return (
    entry.id !== '41940' &&
    !['российская федерация', 'башкортостан', 'салаватский'].some((value) =>
      normalizedName.includes(value),
    )
  );
}

function isFiasStreetEntry(entry) {
  return FIAS_STREET_TYPE_LABELS.has(entry.type);
}

function formatFiasStreet(entry) {
  const streetType = FIAS_STREET_TYPE_LABELS.get(entry.type);

  if (!streetType) {
    return entry.name;
  }

  if (streetType === 'улица') {
    return `${entry.name} улица`;
  }

  if (['территория', 'микрорайон'].includes(streetType)) {
    return `${streetType} ${entry.name}`;
  }

  return `${entry.name} ${streetType}`;
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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

    const cleanName = stripSettlementPrefix(cleanDisplayName(name));
    const key = normalizeForSearch(cleanName);
    const current = seen.get(key);

    if (!current || placeType !== 'locality') {
      seen.set(key, {
        name: cleanName,
        placeType,
        coordinates,
      });
    }
  }

  return Array.from(seen.values()).sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

function extractStreetRecords(elements, places) {
  const records = new Map();

  for (const element of elements) {
    const name = element.tags?.name;
    const highway = element.tags?.highway;

    if (!name || HIGHWAY_TYPES_TO_SKIP.has(highway)) {
      continue;
    }

    const coordinates = pointOf(element);
    const embedded = parseEmbeddedSettlementAndStreet(name);
    const settlement = embedded?.settlement ?? nearestSettlement(coordinates, places);
    const street = embedded?.street ?? ensureStreetType(name);

    if (!settlement || !street || normalizeForSearch(street).length < 2) {
      continue;
    }

    const key = `${normalizeForSearch(settlement)}|${normalizeForSearch(street)}`;
    const current = records.get(key);

    records.set(key, {
      settlement,
      street,
      source: 'osm',
      aliases: makeAliases(settlement, street),
      coordinates: current?.coordinates ?? coordinates,
    });
  }

  return Array.from(records.values()).sort((left, right) => {
    const settlementOrder = left.settlement.localeCompare(right.settlement, 'ru');
    return settlementOrder || left.street.localeCompare(right.street, 'ru');
  });
}

function mergeStreetRecords(...recordGroups) {
  const records = new Map();

  for (const group of recordGroups) {
    for (const record of group) {
      const key = `${normalizeForSearch(record.settlement)}|${normalizeForSearch(record.street)}`;
      const current = records.get(key);

      if (!current) {
        records.set(key, {
          ...record,
          aliases: unique(record.aliases),
        });
        continue;
      }

      records.set(key, {
        ...current,
        source: current.source === record.source ? current.source : 'merged',
        aliases: unique([...current.aliases, ...record.aliases]),
        coordinates: current.coordinates ?? record.coordinates,
      });
    }
  }

  return Array.from(records.values()).sort((left, right) => {
    const settlementOrder = left.settlement.localeCompare(right.settlement, 'ru');
    return settlementOrder || left.street.localeCompare(right.street, 'ru');
  });
}

function serializeTs(records, settlements, sourceInfo) {
  const generatedAt = new Date().toISOString();
  const json = JSON.stringify(records, null, 2).replace(/"([^"]+)":/g, '$1:');
  const settlementJson = JSON.stringify(settlements, null, 2);
  const counts = records.reduce(
    (accumulator, record) => {
      accumulator[record.source] += 1;
      return accumulator;
    },
    { gar: 0, merged: 0, osm: 0 },
  );

  return `// This file is generated by scripts/import-salavat-streets.mjs.
// Do not edit manually: rerun the import script after refreshing OSM/GAR source data.

export type SalavatStreetSource = 'gar' | 'osm' | 'merged';

export type SalavatStreetRecord = {
  settlement: string;
  street: string;
  source: SalavatStreetSource;
  aliases: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
};

export const salavatDistrictStreetSourceSummary = {
  district: 'Салаватский район, Республика Башкортостан',
  fiasSourceUrl: '${FIAS_DISTRICT_URL}',
  fiasVersion: ${sourceInfo.fiasVersion ? `'${sourceInfo.fiasVersion}'` : 'null'},
  osmRelationId: ${SALAVAT_RELATION_ID},
  generatedAt: '${generatedAt}',
  note:
    'Справочник собран из открытого ФИАС-справочника и OpenStreetMap named highways по relation 398510. Для продакшена этот импорт нужно перенести на сервер и сверять с официальной ГАР/ФИАС выгрузкой ФНС.',
  garStreets: ${sourceInfo.garCount},
  osmStreets: ${sourceInfo.osmCount},
  mergedStreets: ${counts.merged},
  osmOnlyStreets: ${counts.osm},
  garOnlyStreets: ${counts.gar},
  settlements: ${settlements.length},
  streets: ${records.length},
} as const;

export const salavatDistrictSettlements = ${settlementJson} as const;

export const salavatDistrictStreets: SalavatStreetRecord[] = ${json};
`;
}

const fiasImport = await importFiasRecords();
let places = [];
let osmRecords = [];

try {
  const placesResponse = await fetchOverpass(PLACE_QUERY);
  const streetsResponse = await fetchOverpass(STREET_QUERY);

  places = extractPlaces(placesResponse.elements ?? []);
  osmRecords = extractStreetRecords(streetsResponse.elements ?? [], places);
} catch (error) {
  console.warn(`OSM import skipped: ${error.message}`);
}

const records = mergeStreetRecords(fiasImport.records, osmRecords);
const settlementNames = unique([
  ...places.map((place) => place.name),
  ...records.map((record) => record.settlement),
]).sort((left, right) => left.localeCompare(right, 'ru'));

await writeFile(
  outputPath,
  serializeTs(records, settlementNames, {
    fiasVersion: fiasImport.version,
    garCount: fiasImport.records.length,
    osmCount: osmRecords.length,
  }),
  'utf8',
);

console.log(
  `Generated ${records.length} street records across ${settlementNames.length} settlements: ${outputPath}`,
);
