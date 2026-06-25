import { Platform } from 'react-native';

import { findSalavatAddressSuggestions, type GeoPoint } from '../data/salavatDistrict';

type TripDriverMapProps = {
  pickup: string;
  destination: string;
  pickupPoint?: GeoPoint;
  destinationPoint?: GeoPoint;
  driverPoint?: GeoPoint;
  height?: number;
};

// Центр Салаватского района (с. Малояз) — фолбэк, если адрес не нашёлся.
const SALAVAT_CENTER: GeoPoint = { latitude: 55.155, longitude: 58.184 };

function resolveCoord(address: string | undefined, fallback: GeoPoint): GeoPoint {
  const query = address?.trim();

  if (!query) {
    return fallback;
  }

  const match = findSalavatAddressSuggestions(query, 1)[0]?.coordinates;
  return match ?? fallback;
}

function nudge(point: GeoPoint, dLat: number, dLng: number): GeoPoint {
  return { latitude: point.latitude + dLat, longitude: point.longitude + dLng };
}

function buildHtml(pickup: GeoPoint, destination: GeoPoint, driver: GeoPoint, hasRealDriver: boolean) {
  const p = [pickup.latitude, pickup.longitude];
  const d = [destination.latitude, destination.longitude];
  const dr = [driver.latitude, driver.longitude];

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;background:#DDECE3}
  .pin{display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font:700 11px system-ui;color:#fff}
  .pin-a{width:18px;height:18px;background:#008D49}
  .pin-b{width:18px;height:18px;background:#12382C}
  .car{width:34px;height:34px;background:#008D49;border-radius:11px;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,111,58,.4);display:flex;align-items:center;justify-content:center}
  .car svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2.4}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var P=${JSON.stringify(p)},D=${JSON.stringify(d)},DR=${JSON.stringify(dr)},REAL=${hasRealDriver ? 'true' : 'false'};
  var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  function icon(cls,inner){return L.divIcon({html:'<div class="'+cls+'">'+(inner||'')+'</div>',className:'',iconSize:[18,18],iconAnchor:[9,9]});}
  var carSvg='<svg viewBox="0 0 24 24"><path d="M5 13l1.5-4.5A2 2 0 018.4 7h7.2a2 2 0 011.9 1.5L19 13v5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1H6a1 1 0 01-1-1z"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>';
  L.marker(P,{icon:icon('pin pin-a')}).addTo(map);
  L.marker(D,{icon:icon('pin pin-b')}).addTo(map);
  L.polyline([P,D],{color:'#008D49',weight:4,opacity:.65}).addTo(map);
  var carIcon=L.divIcon({html:'<div class="car">'+carSvg+'</div>',className:'',iconSize:[34,34],iconAnchor:[17,17]});
  var car=L.marker(REAL?DR:P,{icon:carIcon,zIndexOffset:1000}).addTo(map);
  map.fitBounds(L.latLngBounds([P,D,REAL?DR:P]).pad(0.35));
  if(!REAL){
    var t=0,dur=14000,start=null;
    function step(ts){if(!start)start=ts;var k=((ts-start)%dur)/dur;var lat=P[0]+(D[0]-P[0])*k,lng=P[1]+(D[1]-P[1])*k;car.setLatLng([lat,lng]);requestAnimationFrame(step);}
    requestAnimationFrame(step);
  }
</script></body></html>`;
}

export function TripDriverMap({
  pickup,
  destination,
  pickupPoint,
  destinationPoint,
  driverPoint,
  height = 220,
}: TripDriverMapProps) {
  // Реальная карта только на web (деплой-цель). На native — caller показывает стилизованную сцену.
  if (Platform.OS !== 'web') {
    return null;
  }

  const pickupCoord = pickupPoint ?? resolveCoord(pickup, SALAVAT_CENTER);
  const destinationCoord =
    destinationPoint ?? resolveCoord(destination, nudge(pickupCoord, 0.012, 0.018));
  const driverCoord = driverPoint ?? pickupCoord;
  const html = buildHtml(pickupCoord, destinationCoord, driverCoord, Boolean(driverPoint));

  const createElement = (require('react-native-web') as { unstable_createElement: Function })
    .unstable_createElement;

  return createElement('iframe', {
    title: 'Карта поездки',
    srcDoc: html,
    loading: 'lazy',
    style: { width: '100%', height, border: 0, borderRadius: 14, display: 'block' },
  });
}
