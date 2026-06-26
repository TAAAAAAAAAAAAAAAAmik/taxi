import { Platform } from 'react-native';

import { findSalavatAddressSuggestions, type GeoPoint } from '../data/salavatDistrict';

export type CarMode = 'hidden' | 'static' | 'moving';

type TripDriverMapProps = {
  pickup: string;
  destination: string;
  pickupPoint?: GeoPoint;
  destinationPoint?: GeoPoint;
  driverPoint?: GeoPoint;
  carMode?: CarMode;
  height?: number;
};

// Центр Салаватского района (с. Малояз) — фолбэк, если адрес не нашёлся.
const SALAVAT_CENTER: GeoPoint = { latitude: 55.155, longitude: 58.184 };

function resolveCoord(address: string | undefined): GeoPoint | undefined {
  const query = address?.trim();

  if (!query) {
    return undefined;
  }

  return findSalavatAddressSuggestions(query, 1)[0]?.coordinates;
}

function almostEqual(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.latitude - b.latitude) < 0.0006 && Math.abs(a.longitude - b.longitude) < 0.0006;
}

function buildHtml(
  pickup: GeoPoint,
  destination: GeoPoint | null,
  driver: GeoPoint | null,
  carMode: CarMode,
) {
  const P = [pickup.latitude, pickup.longitude];
  const D = destination ? [destination.latitude, destination.longitude] : null;
  const DR = driver ? [driver.latitude, driver.longitude] : null;
  const sameAB = destination ? almostEqual(pickup, destination) : true;

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;background:#DDECE3}
  #fb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;
      padding:0 24px;color:#557669;font:600 13px/1.4 system-ui;z-index:0}
  .pin{border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .pin-a{width:18px;height:18px;background:#008D49}
  .pin-b{width:18px;height:18px;background:#12382C}
  .car{width:34px;height:34px;background:#008D49;border-radius:11px;border:3px solid #fff;
       box-shadow:0 4px 10px rgba(0,111,58,.4);display:flex;align-items:center;justify-content:center}
  .car svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2.4}
</style></head><body>
<div id="map"><div id="fb">Карта недоступна — проверьте интернет</div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  if(typeof L==='undefined'){return;} // фолбэк-плейсхолдер остаётся
  try{
    var P=${JSON.stringify(P)},D=${D ? JSON.stringify(D) : 'null'},DR=${DR ? JSON.stringify(DR) : 'null'};
    var CAR=${JSON.stringify(carMode)},SAME=${sameAB ? 'true' : 'false'};
    var map=L.map('map',{zoomControl:false});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    function icon(cls){return L.divIcon({html:'<div class="'+cls+'"></div>',className:'',iconSize:[18,18],iconAnchor:[9,9]});}
    var carSvg='<svg viewBox="0 0 24 24"><path d="M5 13l1.5-4.5A2 2 0 018.4 7h7.2a2 2 0 011.9 1.5L19 13v5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1H6a1 1 0 01-1-1z"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>';
    L.marker(P,{icon:icon('pin pin-a')}).addTo(map);
    if(D){L.marker(D,{icon:icon('pin pin-b')}).addTo(map);}

    var ROUTE = D ? [P,D] : [P];
    var line = D ? L.polyline(ROUTE,{color:'#008D49',weight:4,opacity:.65}).addTo(map) : null;

    if(D && SAME){map.setView(P,14);}
    else if(!D){map.setView(P,15);}
    else{map.fitBounds(L.latLngBounds([P,D,DR||P]).pad(0.3));}

    var car=null;
    if(CAR!=='hidden'){
      var carIcon=L.divIcon({html:'<div class="car">'+carSvg+'</div>',className:'',iconSize:[34,34],iconAnchor:[17,17]});
      car=L.marker(DR||P,{icon:carIcon,zIndexOffset:1000}).addTo(map);
    }

    function ptAt(route,t){
      var n=route.length-1; if(n<=0){return route[0];}
      var x=t*n, i=Math.floor(x), f=x-i; if(i>=n){i=n-1;f=1;}
      var a=route[i], b=route[i+1];
      return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
    }

    function startSim(){
      if(!car || CAR!=='moving' || DR || ROUTE.length<2){return;}
      var dur=14000,start=null;
      function step(ts){if(!start){start=ts;}var k=((ts-start)%dur)/dur;var t=1-Math.abs(1-2*k);
        car.setLatLng(ptAt(ROUTE,t));requestAnimationFrame(step);}
      requestAnimationFrame(step);
    }

    // Маршрут по дорогам (OSRM), с фолбэком на прямую линию
    if(D && !SAME){
      fetch('https://router.project-osrm.org/route/v1/driving/'+P[1]+','+P[0]+';'+D[1]+','+D[0]+'?overview=full&geometries=geojson')
        .then(function(r){return r.json();})
        .then(function(j){
          var g=j&&j.routes&&j.routes[0]&&j.routes[0].geometry&&j.routes[0].geometry.coordinates;
          if(g&&g.length>1){
            ROUTE=g.map(function(c){return [c[1],c[0]];});
            if(line){line.setLatLngs(ROUTE);}
            map.fitBounds(L.latLngBounds(ROUTE.concat([DR||P])).pad(0.2));
          }
        })
        .catch(function(){})
        .then(startSim, startSim);
    } else { startSim(); }
  }catch(e){/* фолбэк-плейсхолдер остаётся */}
})();
</script></body></html>`;
}

export function TripDriverMap({
  pickup,
  destination,
  pickupPoint,
  destinationPoint,
  driverPoint,
  carMode = 'moving',
  height = 240,
}: TripDriverMapProps) {
  // Реальная карта только на web (деплой-цель). На native — caller показывает стилизованную сцену.
  if (Platform.OS !== 'web') {
    return null;
  }

  const pickupCoord = pickupPoint ?? resolveCoord(pickup) ?? SALAVAT_CENTER;
  const destinationCoord = destinationPoint ?? resolveCoord(destination) ?? null;
  const driverCoord = driverPoint ?? null;
  const html = buildHtml(pickupCoord, destinationCoord, driverCoord, carMode);

  const createElement = (require('react-native-web') as { unstable_createElement: Function })
    .unstable_createElement;

  return createElement('iframe', {
    title: 'Карта поездки',
    srcDoc: html,
    loading: 'lazy',
    style: { width: '100%', height, border: 0, borderRadius: 14, display: 'block' },
  });
}
