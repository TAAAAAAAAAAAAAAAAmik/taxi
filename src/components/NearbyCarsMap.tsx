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
  html,body,#map{height:100%;margin:0;background:#E4EEE7}
  /* Брендовый статичный фолбэк: пока тайлы не загрузились, показываем
     стилизованную схему района, а не текст-ошибку. Leaflet рисует поверх. */
  #fb{position:absolute;inset:0;z-index:0;overflow:hidden}
  #fb svg{width:100%;height:100%;display:block}
  #fb .lbl{position:absolute;left:0;right:0;bottom:12px;text-align:center;
      color:#6E8579;font:700 11px/1.2 system-ui;letter-spacing:2px}
  .car{width:30px;height:30px;background:#0B6B4A;border-radius:10px;border:2px solid #fff;
       box-shadow:0 3px 7px rgba(0,80,40,.35);display:flex;align-items:center;justify-content:center}
  .car svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2.2}
  .leaflet-control-attribution{font-size:9px;opacity:.6}
</style></head><body>
<div id="map"><div id="fb">
  <svg viewBox="0 0 390 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="mfBg" cx="50%" cy="42%" r="82%">
        <stop offset="0" stop-color="#F3F7F2"/><stop offset="0.6" stop-color="#E4EEE7"/><stop offset="1" stop-color="#D6E7DC"/>
      </radialGradient>
    </defs>
    <rect width="390" height="300" fill="url(#mfBg)"/>
    <line x1="-40" y1="70" x2="430" y2="52" stroke="#008D49" stroke-opacity="0.08" stroke-width="1.5"/>
    <line x1="-40" y1="150" x2="430" y2="128" stroke="#008D49" stroke-opacity="0.08" stroke-width="1.5"/>
    <line x1="-40" y1="228" x2="430" y2="206" stroke="#008D49" stroke-opacity="0.08" stroke-width="1.5"/>
    <line x1="96" y1="-40" x2="70" y2="340" stroke="#008D49" stroke-opacity="0.06" stroke-width="1.5"/>
    <line x1="286" y1="-40" x2="312" y2="340" stroke="#008D49" stroke-opacity="0.06" stroke-width="1.5"/>
    <path d="M 120 196 L 214 196 L 214 128 L 300 128" fill="none" stroke="#008D49" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="120" cy="196" r="6" fill="#FFFFFF" stroke="#008D49" stroke-width="2.5"/>
    <circle cx="300" cy="128" r="5.5" fill="#008D49"/>
  </svg>
  <div class="lbl">САЛАВАТСКИЙ РАЙОН</div>
</div></div>
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
