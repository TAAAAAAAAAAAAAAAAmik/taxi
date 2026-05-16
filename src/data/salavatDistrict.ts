import {
  salavatDistrictHouses,
  salavatDistrictHouseSourceSummary,
  type SalavatHouseRecord,
  type SalavatHouseSource,
} from './salavatDistrictHouses';
import {
  salavatDistrictSettlements,
  salavatDistrictStreetSourceSummary,
  salavatDistrictStreets,
  type SalavatStreetRecord,
  type SalavatStreetSource,
} from './salavatDistrictStreets';

export {
  salavatDistrictHouses,
  salavatDistrictHouseSourceSummary,
  salavatDistrictSettlements,
  salavatDistrictStreetSourceSummary,
};

export type SalavatAddressCategory =
  | 'address'
  | 'admin'
  | 'education'
  | 'health'
  | 'landmark'
  | 'market'
  | 'settlement'
  | 'street'
  | 'transport';

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type SalavatAddressSource = SalavatStreetSource | SalavatHouseSource | 'manual';

export type SalavatAddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  settlement: string;
  category: SalavatAddressCategory;
  aliases: string[];
  source: SalavatAddressSource;
  coordinates?: GeoPoint;
};

export type SalavatRoutePreset = {
  id: string;
  title: string;
  pickup: string;
  destination: string;
  subtitle: string;
  estimatedTime: string;
};

export const russiaRouteCoverage = {
  mode: 'server-first',
  addressSearchEnv: 'EXPO_PUBLIC_ADDRESS_SEARCH_URL',
  reverseGeocodeEnv: 'EXPO_PUBLIC_REVERSE_GEOCODE_URL',
  routeSearchEnv: 'EXPO_PUBLIC_ROUTE_SEARCH_URL',
  description:
    'Для всей России приложение должно брать адреса, дома, подъезды, точки и маршруты с серверного геокодера. Локальный пакет Салаватского района нужен для быстрых подсказок MVP-зоны и офлайн-поиска.',
};

export const salavatDistrictInfo = {
  center: 'с. Малояз',
  region: 'Салаватский район, Республика Башкортостан',
  serviceArea: `${salavatDistrictSettlements.length} населенных пунктов, ${salavatDistrictStreetSourceSummary.streets} улиц/дорог и ${salavatDistrictHouseSourceSummary.houses} точных домов из открытых адресных слоев. Ручные POI оставлены отдельным слоем.`,
};

const salavatBounds = {
  maxLatitude: 55.55,
  maxLongitude: 58.9,
  minLatitude: 54.85,
  minLongitude: 57.45,
};

const fixedDistrictPoints: SalavatAddressSuggestion[] = [
  {
    id: 'maloyaz-admin',
    title: 'Администрация Салаватского района',
    subtitle: 'с. Малояз, Советская улица, 64',
    settlement: 'Малояз',
    category: 'admin',
    aliases: ['администрация', 'советская 64', 'районная администрация'],
    source: 'manual',
  },
  {
    id: 'maloyaz-center',
    title: 'Центр Малояза',
    subtitle: 'с. Малояз, центральная площадь',
    settlement: 'Малояз',
    category: 'settlement',
    aliases: ['малояз центр', 'центр', 'площадь'],
    source: 'manual',
  },
  {
    id: 'maloyaz-bus',
    title: 'Автостанция Малояз',
    subtitle: 'с. Малояз, остановка междугородних автобусов',
    settlement: 'Малояз',
    category: 'transport',
    aliases: ['автостанция', 'автобус', 'остановка'],
    source: 'manual',
  },
  {
    id: 'maloyaz-hospital',
    title: 'Салаватская центральная районная больница',
    subtitle: 'с. Малояз, районная больница',
    settlement: 'Малояз',
    category: 'health',
    aliases: ['црб', 'больница', 'поликлиника'],
    source: 'manual',
  },
  {
    id: 'maloyaz-museum',
    title: 'Музей Салавата Юлаева',
    subtitle: 'с. Малояз, культурная точка района',
    settlement: 'Малояз',
    category: 'landmark',
    aliases: ['музей', 'салават юлаев'],
    source: 'manual',
  },
  {
    id: 'maloyaz-school',
    title: 'Малоязовская школа',
    subtitle: 'с. Малояз, школьная зона',
    settlement: 'Малояз',
    category: 'education',
    aliases: ['школа', 'малояз школа', 'школьная'],
    source: 'manual',
  },
  {
    id: 'maloyaz-market',
    title: 'Рынок Малояза',
    subtitle: 'с. Малояз, торговая зона у центра',
    settlement: 'Малояз',
    category: 'market',
    aliases: ['рынок', 'магазины', 'торговый ряд'],
    source: 'manual',
  },
  {
    id: 'yangantau-sanatorium',
    title: 'Санаторий Янгантау',
    subtitle: 'с. Янгантау, курортная зона',
    settlement: 'Янгантау',
    category: 'landmark',
    aliases: ['янгантау', 'санаторий', 'курорт', 'горячая гора'],
    source: 'manual',
  },
  {
    id: 'yangantau-center',
    title: 'Центр Янгантау',
    subtitle: 'с. Янгантау, центр села',
    settlement: 'Янгантау',
    category: 'settlement',
    aliases: ['янгантау центр', 'село янгантау'],
    source: 'manual',
  },
  {
    id: 'kurgazak',
    title: 'Источник Кургазак',
    subtitle: 'рядом с д. Комсомол и курортом Янгантау',
    settlement: 'Комсомол',
    category: 'landmark',
    aliases: ['кургазак', 'источник', 'родник'],
    source: 'manual',
  },
  {
    id: 'komsomol',
    title: 'д. Комсомол',
    subtitle: 'Салаватский район, рядом с источником Кургазак',
    settlement: 'Комсомол',
    category: 'settlement',
    aliases: ['комсомол', 'деревня комсомол'],
    source: 'manual',
  },
  {
    id: 'mursalimkino-station',
    title: 'Мурсалимкино, железнодорожная станция',
    subtitle: 'с. Мурсалимкино, станция и центр села',
    settlement: 'Мурсалимкино',
    category: 'transport',
    aliases: ['мурсалимкино', 'станция', 'жд'],
    source: 'manual',
  },
  {
    id: 'lakly-cave',
    title: 'Лаклинская пещера',
    subtitle: 'район с. Лаклы, туристическая точка',
    settlement: 'Лаклы',
    category: 'landmark',
    aliases: ['пещера', 'лаклинская пещера'],
    source: 'manual',
  },
  {
    id: 'idrisovo-cave',
    title: 'Идрисовская пещера',
    subtitle: 'д. Идрисово, природная точка района',
    settlement: 'Идрисово',
    category: 'landmark',
    aliases: ['идрисовская пещера', 'пещера идрисово'],
    source: 'manual',
  },
  {
    id: 'mesyagutovo-route',
    title: 'Выезд на Месягутово',
    subtitle: 'направление Малояз - Месягутово',
    settlement: 'Малояз',
    category: 'transport',
    aliases: ['месягутово', 'трасса', 'выезд'],
    source: 'manual',
  },
  {
    id: 'kropachevo-route',
    title: 'Выезд на Кропачево',
    subtitle: 'направление к ж/д станции Кропачево',
    settlement: 'Малояз',
    category: 'transport',
    aliases: ['кропачево', 'трасса', 'жд станция'],
    source: 'manual',
  },
];

const generatedHouseSuggestions = salavatDistrictHouses.map(houseRecordToSuggestion);
const generatedStreetSuggestions = salavatDistrictStreets.map(streetRecordToSuggestion);

export const salavatAddressSuggestions: SalavatAddressSuggestion[] = [
  ...fixedDistrictPoints,
  ...generatedHouseSuggestions,
  ...generatedStreetSuggestions,
];

export const salavatPopularRoutes: SalavatRoutePreset[] = [
  {
    id: 'maloyaz-yangantau',
    title: 'Малояз -> Янгантау',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Санаторий Янгантау, с. Янгантау',
    subtitle: 'Самый понятный курортный маршрут района',
    estimatedTime: '25-35 мин',
  },
  {
    id: 'yangantau-kurgazak',
    title: 'Янгантау -> Кургазак',
    pickup: 'Санаторий Янгантау, с. Янгантау',
    destination: 'Источник Кургазак, д. Комсомол',
    subtitle: 'Короткая поездка к источнику',
    estimatedTime: '10-15 мин',
  },
  {
    id: 'maloyaz-kurgazak',
    title: 'Малояз -> Кургазак',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Источник Кургазак, д. Комсомол',
    subtitle: 'Маршрут для гостей района',
    estimatedTime: '25-35 мин',
  },
  {
    id: 'maloyaz-mursalimkino',
    title: 'Малояз -> Мурсалимкино',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Мурсалимкино, железнодорожная станция',
    subtitle: 'Связь с железнодорожной точкой',
    estimatedTime: '35-50 мин',
  },
  {
    id: 'maloyaz-arkaulovo',
    title: 'Малояз -> Аркаулово',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Центр Аркаулово, с. Аркаулово',
    subtitle: 'Сельский маршрут внутри района',
    estimatedTime: '25-40 мин',
  },
  {
    id: 'maloyaz-lakly',
    title: 'Малояз -> Лаклы',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'Центр Лаклы, с. Лаклы',
    subtitle: 'Маршрут к южной части района',
    estimatedTime: '35-55 мин',
  },
  {
    id: 'maloyaz-idrisovo',
    title: 'Малояз -> Идрисово',
    pickup: 'Центр Малояза, с. Малояз',
    destination: 'д. Идрисово',
    subtitle: 'Направление к природным точкам Юрюзани',
    estimatedTime: '25-40 мин',
  },
  {
    id: 'hospital-yangantau',
    title: 'ЦРБ -> Янгантау',
    pickup: 'Салаватская центральная районная больница, с. Малояз',
    destination: 'Санаторий Янгантау, с. Янгантау',
    subtitle: 'Медицинский и курортный маршрут',
    estimatedTime: '25-35 мин',
  },
];

export function formatSalavatAddress(address: SalavatAddressSuggestion) {
  return `${address.title}, ${address.subtitle}`;
}

export function findSalavatAddressSuggestions(query: string, limit = 8) {
  const normalizedQuery = normalize(query);
  const exactHouseSuggestion = createExactHouseSuggestion(query);
  const baseSuggestions = exactHouseSuggestion ? [exactHouseSuggestion] : [];

  if (!normalizedQuery) {
    return [...baseSuggestions, ...salavatAddressSuggestions].slice(0, limit);
  }

  const found = salavatAddressSuggestions
    .map((address) => ({
      address,
      score: getAddressScore(address, normalizedQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.address);

  return mergeSuggestions([...baseSuggestions, ...found]).slice(0, limit);
}

export function getCoverageTitle(point?: GeoPoint) {
  if (!point) {
    return 'Адреса рядом с вами';
  }

  if (isInsideSalavatDistrict(point)) {
    return 'Салаватский район рядом с вами';
  }

  return 'Адреса России по геолокации';
}

export function getCoverageText(point?: GeoPoint) {
  if (!point) {
    return 'Разрешите геолокацию, чтобы приложение запросило адрес по вашему местоположению и подняло ближайший адресный пакет.';
  }

  if (isInsideSalavatDistrict(point)) {
    return 'Геолокация получена. Для района загружен детальный слой улиц и домов; конкретный адрес показывается после серверного reverse geocode или выбора подсказки.';
  }

  return 'Геолокация получена. Для полного покрытия РФ нужен серверный reverse geocoder из EXPO_PUBLIC_REVERSE_GEOCODE_URL, пользователь видит только адрес.';
}

export function isInsideSalavatDistrict(point: GeoPoint) {
  return (
    point.latitude >= salavatBounds.minLatitude &&
    point.latitude <= salavatBounds.maxLatitude &&
    point.longitude >= salavatBounds.minLongitude &&
    point.longitude <= salavatBounds.maxLongitude
  );
}

function houseRecordToSuggestion(record: SalavatHouseRecord): SalavatAddressSuggestion {
  return {
    id: `house-${slug(record.settlement)}-${slug(record.street)}-${slug(record.house)}`,
    title: `${record.street}, дом ${record.house}`,
    subtitle: record.fullAddress,
    settlement: record.settlement,
    category: 'address',
    aliases: record.aliases,
    source: record.source,
    coordinates: record.coordinates,
  };
}

function streetRecordToSuggestion(record: SalavatStreetRecord): SalavatAddressSuggestion {
  return {
    id: `street-${slug(record.settlement)}-${slug(record.street)}`,
    title: record.street,
    subtitle: `${record.settlement}, ${record.street}`,
    settlement: record.settlement,
    category: 'street',
    aliases: record.aliases,
    source: record.source,
    coordinates: record.coordinates,
  };
}

function createExactHouseSuggestion(query: string): SalavatAddressSuggestion | null {
  const normalizedQuery = normalize(query);
  const houseMatch = normalizedQuery.match(/(\d+[а-яa-z]?(?:[/-]\d+[а-яa-z]?)?)$/i);

  if (!houseMatch) {
    return null;
  }

  const house = houseMatch[1];
  const streetQuery = normalizedQuery.replace(houseMatch[0], '').trim();

  if (streetQuery.length < 4) {
    return null;
  }

  const exactHouse = salavatDistrictHouses
    .map((record) => ({
      record,
      score: getHouseRecordScore(record, streetQuery, house),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.record;

  if (exactHouse) {
    return houseRecordToSuggestion(exactHouse);
  }

  const bestRecord = salavatDistrictStreets
    .map((record) => ({
      record,
      score: getStreetRecordScore(record, streetQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.record;

  if (!bestRecord) {
    return null;
  }

  return {
    id: `address-${slug(bestRecord.settlement)}-${slug(bestRecord.street)}-${slug(house)}-exact`,
    title: `${bestRecord.street}, дом ${house}`,
    subtitle: `${bestRecord.settlement}, ${bestRecord.street}, ${house}`,
    settlement: bestRecord.settlement,
    category: 'address',
    aliases: [
      `${bestRecord.street} ${house}`,
      `${bestRecord.settlement} ${bestRecord.street} ${house}`,
      ...bestRecord.aliases.map((alias) => `${alias} ${house}`),
    ],
    source: bestRecord.source,
    coordinates: bestRecord.coordinates,
  };
}

function getAddressScore(address: SalavatAddressSuggestion, query: string) {
  const searchable = [
    address.title,
    address.subtitle,
    address.settlement,
    address.category,
    ...address.aliases,
  ].map(normalize);

  if (searchable.some((value) => value === query)) {
    return 6;
  }

  if (searchable.some((value) => value.startsWith(query))) {
    return 5;
  }

  if (searchable.some((value) => value.includes(query))) {
    return 4;
  }

  const queryParts = query.split(' ').filter(Boolean);

  if (
    queryParts.length > 1 &&
    queryParts.every((part) => searchable.some((value) => value.includes(part)))
  ) {
    return 3;
  }

  return 0;
}

function getHouseRecordScore(record: SalavatHouseRecord, streetQuery: string, house: string) {
  if (normalize(record.house) !== normalize(house)) {
    return 0;
  }

  const searchable = [record.settlement, record.street, record.fullAddress, ...record.aliases].map(normalize);
  const queryParts = streetQuery.split(' ').filter(Boolean);

  if (searchable.some((value) => value === streetQuery)) {
    return 8;
  }

  if (searchable.some((value) => value.includes(streetQuery))) {
    return 7;
  }

  if (
    queryParts.length > 1 &&
    queryParts.every((part) => searchable.some((value) => value.includes(part)))
  ) {
    return 6;
  }

  return 0;
}

function getStreetRecordScore(record: SalavatStreetRecord, query: string) {
  const searchable = [record.settlement, record.street, ...record.aliases].map(normalize);
  const queryParts = query.split(' ').filter(Boolean);

  if (searchable.some((value) => value === query)) {
    return 6;
  }

  if (searchable.some((value) => value.includes(query))) {
    return 5;
  }

  if (
    queryParts.length > 1 &&
    queryParts.every((part) => searchable.some((value) => value.includes(part)))
  ) {
    return 4;
  }

  return 0;
}

function mergeSuggestions(items: SalavatAddressSuggestion[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value: string) {
  return normalize(value).replace(/[^a-zа-я0-9]+/g, '-').replace(/^-|-$/g, '');
}
