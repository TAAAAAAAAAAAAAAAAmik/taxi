import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'src', 'data', 'salavatDistrictHouses.ts');
const summaryOutputPath = path.join(projectRoot, 'src', 'data', 'salavatDistrictHouseSourceSummary.ts');
const webAssetOutputPath = path.join(projectRoot, 'public', 'salavatDistrictHouses.json');

const FIAS_DISTRICT_URL = 'https://fias.nalog-udc.ru/Home/Index/41940';
const SALAVAT_AREA_ID = 3600398510;
const SALAVAT_RELATION_ID = 398510;
const SALAVAT_BBOX = {
  south: 54.85,
  west: 57.45,
  north: 55.55,
  east: 58.9,
};
const FIAS_REQUEST_RETRIES = 2;
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
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

const BOUNDARY_QUERY = `
[out:json][timeout:60];
relation(${SALAVAT_RELATION_ID});
out geom;
`;

const ADDRESS_BBOX_QUERIES = ['node', 'way', 'relation'].map((elementType) =>
  makeOverpassBboxQuery(elementType, '["addr:housenumber"]', 120),
);
const PLACE_BBOX_QUERIES = ['node', 'way', 'relation'].map((elementType) =>
  makeOverpassBboxQuery(elementType, '["place"]["name"]', 60),
);

const PLACE_RANK = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'locality',
  'isolated_dwelling',
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

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/\b(дом|д|двлд|здание|зд|сооружение|соор|строение|стр|корпус|к)\.?\b/g, '')
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

function cleanHouseNumber(value) {
  return cleanDisplayName(value)
    .replace(/^(?:д|дом|двлд|здание|зд|сооружение|соор|строение|стр)\.?\s*/i, '')
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

function makeOverpassBboxQuery(elementType, selector, timeout) {
  const { south, west, north, east } = SALAVAT_BBOX;

  return `
[out:json][timeout:${timeout}];
${elementType}(${south},${west},${north},${east})${selector};
out tags center;
`;
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

async function fetchOverpassElements(query) {
  const response = await fetchOverpass(query);
  return response.elements ?? [];
}

async function fetchOverpassBboxElements(label, bboxQueries, boundary) {
  const elementGroups = await mapLimit(bboxQueries, 1, fetchOverpassElements);
  const rawElements = elementGroups.flat();
  const elements = filterElementsByBoundary(rawElements, boundary);

  console.log(
    `${label}: ${elements.length} of ${rawElements.length} bbox elements are inside relation ${SALAVAT_RELATION_ID}`,
  );

  return {
    elements,
    mode: 'bbox',
    rawCount: rawElements.length,
  };
}

async function fetchBoundary() {
  const elements = await fetchOverpassElements(BOUNDARY_QUERY);
  const relation = elements.find((element) => element.type === 'relation' && element.id === SALAVAT_RELATION_ID);

  if (!relation?.members?.length) {
    throw new Error(`OSM boundary relation ${SALAVAT_RELATION_ID} not found`);
  }

  const outerRings = stitchBoundaryRings(relation.members, 'outer');
  const innerRings = stitchBoundaryRings(relation.members, 'inner');

  if (outerRings.length === 0) {
    throw new Error(`OSM boundary relation ${SALAVAT_RELATION_ID} has no outer rings`);
  }

  return { innerRings, outerRings };
}

function stitchBoundaryRings(members, role) {
  const segments = members
    .filter((member) => member.role === role && Array.isArray(member.geometry) && member.geometry.length > 1)
    .map((member) =>
      member.geometry.map((point) => ({
        latitude: point.lat,
        longitude: point.lon,
      })),
    );
  const rings = [];

  while (segments.length > 0) {
    const ring = segments.shift();
    let didJoin = true;

    while (didJoin && !isClosedRing(ring)) {
      didJoin = false;

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];

        if (samePoint(lastPoint(ring), firstPoint(segment))) {
          ring.push(...segment.slice(1));
        } else if (samePoint(lastPoint(ring), lastPoint(segment))) {
          ring.push(...segment.slice(0, -1).reverse());
        } else if (samePoint(firstPoint(ring), lastPoint(segment))) {
          ring.unshift(...segment.slice(0, -1));
        } else if (samePoint(firstPoint(ring), firstPoint(segment))) {
          ring.unshift(...segment.slice(1).reverse());
        } else {
          continue;
        }

        segments.splice(index, 1);
        didJoin = true;
        break;
      }
    }

    if (ring.length > 2) {
      rings.push(ring);
    }
  }

  return rings;
}

function firstPoint(points) {
  return points[0];
}

function lastPoint(points) {
  return points[points.length - 1];
}

function samePoint(left, right) {
  return (
    Math.abs(left.latitude - right.latitude) < 0.0000001 &&
    Math.abs(left.longitude - right.longitude) < 0.0000001
  );
}

function isClosedRing(points) {
  return points.length > 2 && samePoint(firstPoint(points), lastPoint(points));
}

function filterElementsByBoundary(elements, boundary) {
  return elements.filter((element) => {
    const point = pointOf(element);

    return point ? isPointInsideBoundary(point, boundary) : false;
  });
}

function isPointInsideBoundary(point, boundary) {
  const insideOuter = boundary.outerRings.some((ring) => isPointInsideRing(point, ring));
  const insideInner = boundary.innerRings.some((ring) => isPointInsideRing(point, ring));

  return insideOuter && !insideInner;
}

function isPointInsideRing(point, ring) {
  let inside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];
    const intersects =
      current.latitude > point.latitude !== previous.latitude > point.latitude &&
      point.longitude <
        ((previous.longitude - current.longitude) * (point.latitude - current.latitude)) /
          (previous.latitude - current.latitude) +
          current.longitude;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

async function fetchFiasPage(url) {
  let lastError;

  for (let attempt = 0; attempt <= FIAS_REQUEST_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,*/*',
        'user-agent': 'taxi-partner-app-address-import/1.0',
      },
    });

    if (response.ok) {
      return response.text();
    }

    lastError = new Error(`FIAS page ${url} returned ${response.status}`);

    if (attempt < FIAS_REQUEST_RETRIES) {
      await sleep(450 * (attempt + 1));
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

function extractFiasVersion(html) {
  const text = decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
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
  const normalizedName = normalize(entry.name);

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
    return ensureStreetType(entry.name);
  }

  if (streetType === 'улица') {
    return `${entry.name} улица`;
  }

  if (['территория', 'микрорайон'].includes(streetType)) {
    return `${streetType} ${entry.name}`;
  }

  return `${entry.name} ${streetType}`;
}

function parseFiasHouseRows(html, settlement, street) {
  const records = [];
  const rowPattern = /<tr[^>]*>(.*?)<\/tr>/gis;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html))) {
    const cells = Array.from(rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gis)).map((cell) =>
      cleanDisplayName(decodeHtml(cell[1].replace(/<[^>]+>/g, ' '))),
    );
    const house = cleanHouseNumber(cells[0]);
    const guid = cells[1];

    if (!house || !guid || !/^[0-9a-f-]{20,}$/i.test(guid)) {
      continue;
    }

    records.push({
      settlement,
      street,
      house,
      fullAddress: `${settlement}, ${street}, ${house}`,
      source: 'gar',
      aliases: makeAliases(settlement, street, house),
    });
  }

  return records;
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function importFiasHouseRecords() {
  const districtHtml = await fetchFiasPage(FIAS_DISTRICT_URL);
  const fiasVersion = extractFiasVersion(districtHtml);
  const districtEntries = parseFiasEntries(districtHtml).filter(isDistrictChildEntry);
  const settlementPages = await mapLimit(districtEntries, 8, async (entry) => {
    try {
      const html = await fetchFiasPage(entry.url);
      const streetEntries = parseFiasEntries(html).filter(isFiasStreetEntry);

      return {
        entry,
        html,
        streetEntries,
      };
    } catch (error) {
      console.warn(`FIAS settlement page skipped: ${entry.url} (${error.message})`);
      return {
        entry,
        html: '',
        streetEntries: [],
      };
    }
  });
  const streetJobs = [];
  const directRecords = [];

  for (const page of settlementPages) {
    if (page.streetEntries.length === 0) {
      directRecords.push(
        ...parseFiasHouseRows(page.html, stripSettlementPrefix(page.entry.name), ensureStreetType(page.entry.name)),
      );
      continue;
    }

    for (const streetEntry of page.streetEntries) {
      streetJobs.push({
        settlement: stripSettlementPrefix(page.entry.name),
        street: formatFiasStreet(streetEntry),
        url: streetEntry.url,
      });
    }
  }

  const streetRecords = await mapLimit(streetJobs, 8, async (job) => {
    try {
      const html = await fetchFiasPage(job.url);
      return parseFiasHouseRows(html, job.settlement, job.street);
    } catch (error) {
      console.warn(`FIAS street page skipped: ${job.url} (${error.message})`);
      return [];
    }
  });

  return {
    fiasVersion,
    records: [...directRecords, ...streetRecords.flat()],
  };
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

function extractOsmHouseRecords(elements, places) {
  const records = new Map();

  for (const element of elements) {
    const tags = element.tags ?? {};
    const house = cleanHouseNumber(tags['addr:housenumber']);
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

  return Array.from(records.values()).sort(compareHouseRecords);
}

function mergeHouseRecords(...recordGroups) {
  const records = new Map();

  for (const group of recordGroups) {
    for (const record of group) {
      const key = `${normalize(record.settlement)}|${normalize(record.street)}|${normalize(record.house)}`;
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
        aliases: unique([...current.aliases, ...record.aliases]),
        coordinates: current.coordinates ?? record.coordinates,
        source: current.source === record.source ? current.source : 'merged',
      });
    }
  }

  return Array.from(records.values()).sort(compareHouseRecords);
}

async function loadExistingHouseRecords() {
  try {
    const text = await readFile(outputPath, 'utf8');
    const marker = 'export const salavatDistrictHouses: SalavatHouseRecord[] = ';
    const markerIndex = text.indexOf(marker);
    const arrayStart = markerIndex >= 0 ? text.indexOf('[', markerIndex) : -1;
    const arrayEnd = text.lastIndexOf('];');

    if (arrayStart < 0 || arrayEnd < arrayStart) {
      return [];
    }

    const source = text.slice(arrayStart, arrayEnd + 1);
    const parsed = Function(`"use strict"; return (${source});`)();
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compareHouseRecords(left, right) {
  const settlementOrder = left.settlement.localeCompare(right.settlement, 'ru');
  const streetOrder = left.street.localeCompare(right.street, 'ru');
  return settlementOrder || streetOrder || left.house.localeCompare(right.house, 'ru', { numeric: true });
}

function serializeSummaryTs(records, sourceInfo) {
  const generatedAt = new Date().toISOString();
  const counts = records.reduce(
    (accumulator, record) => {
      accumulator[record.source] += 1;
      return accumulator;
    },
    { gar: 0, manual: 0, merged: 0, osm: 0 },
  );
  const settlementCount = new Set(records.map((record) => normalize(record.settlement))).size;
  const streetCount = new Set(
    records.map((record) => `${normalize(record.settlement)}|${normalize(record.street)}`),
  ).size;

  return `// This file is generated by scripts/import-salavat-addresses.mjs.
// Do not edit manually: rerun the import script after refreshing OSM/GAR source data.
//
// Лёгкие метаданные справочника домов вынесены отдельно от тяжёлого массива
// salavatDistrictHouses, чтобы статистику и типы можно было импортировать без
// затягивания ~8.7 МБ данных в стартовый бандл.

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
  fiasSourceUrl: '${FIAS_DISTRICT_URL}',
  fiasVersion: ${sourceInfo.fiasVersion ? `'${sourceInfo.fiasVersion}'` : 'null'},
  osmRelationId: ${SALAVAT_RELATION_ID},
  generatedAt: '${generatedAt}',
  note:
    'Дома собраны из онлайн-справочника ФИАС/ГАР ФНС по Салаватскому району и дополнены координатами из открытых адресных тегов OpenStreetMap. OSM импорт берет bbox вокруг района и фильтрует точки по relation 398510, чтобы не захватывать соседние города. Для продакшена импорт нужно перенести на сервер и регулярно сверять с официальной ГАР/ФИАС выгрузкой ФНС.',
  osmQueryMode: '${sourceInfo.osmQueryMode ?? 'none'}',
  osmRawHouses: ${sourceInfo.osmRawCount ?? sourceInfo.osmCount},
  osmHouses: ${sourceInfo.osmCount},
  garHouses: ${sourceInfo.garCount},
  manualHouses: ${counts.manual},
  mergedHouses: ${counts.merged},
  osmOnlyHouses: ${counts.osm},
  garOnlyHouses: ${counts.gar},
  settlements: ${settlementCount},
  streets: ${streetCount},
  poi: 0,
  houses: ${records.length},
} as const;
`;
}

function serializeHousesTs(records) {
  const json = JSON.stringify(records, null, 2).replace(/"([^"]+)":/g, '$1:');

  return `// This file is generated by scripts/import-salavat-addresses.mjs.
// Do not edit manually: rerun the import script after refreshing OSM/GAR source data.
//
// Тяжёлый массив домов вынесен отдельно от метаданных и типов
// (см. salavatDistrictHouseSourceSummary.ts) и подгружается лениво через houseLoader,
// поэтому ~8.7 МБ не попадают в стартовый бандл.

import type { SalavatHouseRecord } from './salavatDistrictHouseSourceSummary';

export const salavatDistrictHouses: SalavatHouseRecord[] = ${json};
`;
}

const existingRecords = await loadExistingHouseRecords();
let fiasImport = { fiasVersion: null, records: [] };
let osmRecords = [];
let osmQueryMode = 'none';
let osmRawCount = 0;

try {
  fiasImport = await importFiasHouseRecords();
} catch (error) {
  console.warn(`FIAS/GAR house import skipped: ${error.message}`);
}

try {
  const boundary = await fetchBoundary();
  const placesImport = await fetchOverpassBboxElements('OSM places', PLACE_BBOX_QUERIES, boundary);
  const addressImport = await fetchOverpassBboxElements('OSM houses', ADDRESS_BBOX_QUERIES, boundary);
  const places = extractPlaces(placesImport.elements);

  osmRecords = extractOsmHouseRecords(addressImport.elements, places);
  osmQueryMode = addressImport.mode;
  osmRawCount = addressImport.rawCount;
} catch (error) {
  console.warn(`OSM house import skipped: ${error.message}`);
}

const records = mergeHouseRecords(existingRecords, fiasImport.records, osmRecords);

await writeFile(
  summaryOutputPath,
  serializeSummaryTs(records, {
    fiasVersion: fiasImport.fiasVersion,
    garCount: fiasImport.records.length,
    existingCount: existingRecords.length,
    osmCount: osmRecords.length,
    osmQueryMode,
    osmRawCount,
  }),
  'utf8',
);
await writeFile(outputPath, serializeHousesTs(records), 'utf8');
// Web берёт справочник отдельным статическим JSON-ассетом, чтобы он не попадал в JS-бандл.
await mkdir(path.dirname(webAssetOutputPath), { recursive: true });
await writeFile(webAssetOutputPath, JSON.stringify(records), 'utf8');
console.log(`Generated ${records.length} house address records:`);
console.log(`  - ${summaryOutputPath}`);
console.log(`  - ${outputPath}`);
console.log(`  - ${webAssetOutputPath}`);
