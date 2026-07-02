import { Platform } from 'react-native';

import { type GeoPoint } from '../data/salavatDistrict';

type NearbyCarsMapProps = {
  cars?: GeoPoint[];
  // Число (px) или '100%', когда карта растягивается флексом родителя.
  height?: number | string;
};

// Центр Салаватского района (с. Малояз).
const SALAVAT_CENTER: GeoPoint = { latitude: 55.155, longitude: 58.184 };

function buildHtml(center: GeoPoint, cars: GeoPoint[]) {
  const C = [center.latitude, center.longitude];
  const CARS = cars.map((c) => [c.latitude, c.longitude]);

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;background:#DDECE3}
  #fb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;
      padding:0 24px;color:#557669;font:600 13px/1.4 system-ui;z-index:0}
  .car{width:30px;height:30px;background:#0B6B4A;border-radius:10px;border:2px solid #fff;
       box-shadow:0 3px 7px rgba(0,80,40,.35);display:flex;align-items:center;justify-content:center}
  .car svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2.2}
  .leaflet-control-attribution{font-size:9px;opacity:.6}
</style></head><body>
<div id="map"><div id="fb">Карта района · проверьте интернет</div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  if(typeof L==='undefined'){return;}
  try{
    var C=${JSON.stringify(C)},CARS=${JSON.stringify(CARS)};
    var map=L.map('map',{zoomControl:false,attributionControl:true,dragging:false,scrollWheelZoom:false,
      doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,tap:false});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    var carSvg='<svg viewBox="0 0 24 24"><path d="M5 13l1.5-4.3A2 2 0 018.4 7.5h7.2a2 2 0 011.9 1.2L19 13v4h-2v-1.6H7V17H5z"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>';
    function carIcon(){return L.divIcon({html:'<div class="car">'+carSvg+'</div>',className:'',iconSize:[30,30],iconAnchor:[15,15]});}
    if(CARS.length>0){
      var pts=[];
      CARS.forEach(function(p){L.marker(p,{icon:carIcon()}).addTo(map);pts.push(p);});
      pts.push(C);
      map.fitBounds(L.latLngBounds(pts).pad(0.35),{maxZoom:14});
    } else {
      map.setView(C,12);
    }
  }catch(e){/* фолбэк-плейсхолдер остаётся */}
})();
</script></body></html>`;
}

// Превью живой карты района с метками доступных машин (Яндекс/Uber-приём,
// но в наших цветах и по нашему району). Только web — деплой-цель.
export function NearbyCarsMap({ cars = [], height = 206 }: NearbyCarsMapProps) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const html = buildHtml(SALAVAT_CENTER, cars);
  const createElement = (require('react-native-web') as { unstable_createElement: Function })
    .unstable_createElement;

  return createElement('iframe', {
    title: 'Машины рядом',
    srcDoc: html,
    loading: 'lazy',
    style: { width: '100%', height, border: 0, display: 'block', pointerEvents: 'none' },
  });
}
