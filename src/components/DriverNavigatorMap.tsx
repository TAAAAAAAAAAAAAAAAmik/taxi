import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import type { GeoPoint } from '../data/salavatDistrict';

export type NavigatorPhase = 'pickup' | 'trip';

// Состояние навигации, которое iframe отправляет наружу через postMessage.
export type NavigatorLiveState = {
  arrived: boolean;
  distToManeuverM: number;
  maneuverModifier: string;
  maneuverType: string;
  offRoute: boolean;
  remainingKm: number;
  remainingMin: number;
  simulated: boolean;
  streetName: string;
};

type DriverNavigatorMapProps = {
  height: number;
  iframeRef: MutableRefObject<{ contentWindow?: Window } | null>;
  simStart: GeoPoint;
  target: GeoPoint;
};

// Самодостаточный навигатор внутри iframe: Leaflet-карта, маршрут по дорогам
// (OSRM), живой GPS (watchPosition) с фолбэком на симуляцию движения по
// маршруту — чтобы навигатор жил и в демо без геолокации. Весь продуктовый UI
// (баннер манёвра, ETA, кнопки) рисует RN-слой поверх; сюда приходит только
// команда recenter, наружу уходит state.
function buildNavigatorHtml(target: GeoPoint, simStart: GeoPoint) {
  const T = JSON.stringify([target.latitude, target.longitude]);
  const S = JSON.stringify([simStart.latitude, simStart.longitude]);

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;background:#DDECE3}
  .pin{width:18px;height:18px;border-radius:5px;background:#12382C;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)}
  #car{width:40px;height:40px;background:#008D49;border-radius:999px;border:3px solid #fff;
       box-shadow:0 6px 14px rgba(0,111,58,.45);display:flex;align-items:center;justify-content:center;
       transition:transform .5s linear}
  #car svg{width:20px;height:20px;display:block}
  #nomap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
         color:#7FA08F;font:600 13px/1.4 system-ui;text-align:center;padding:0 40px;
         background:linear-gradient(rgba(0,141,73,.05) 1px,transparent 1px) 0 0/100% 44px,
                    linear-gradient(90deg,rgba(0,141,73,.05) 1px,transparent 1px) 0 0/44px 100%}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  // Навигация живёт и без Leaflet/тайлов (слабый интернет): маршрут, GPS,
  // манёвры и ETA считаются всегда, карта — если библиотека загрузилась.
  var HAS_MAP=typeof L!=='undefined';
  var T=${T}, S=${S};
  var map=null,casing=null,line=null,car=null;

  if(HAS_MAP){
    map=L.map('map',{zoomControl:false,attributionControl:false});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    map.setView(S,15);
    casing=L.polyline([],{color:'#FFFFFF',weight:11,opacity:.9}).addTo(map);
    line=L.polyline([],{color:'#008D49',weight:6,opacity:.95}).addTo(map);
    L.marker(T,{icon:L.divIcon({html:'<div class="pin"></div>',className:'',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map);
    car=L.marker(S,{icon:L.divIcon({html:'<div id="car"><svg viewBox="0 0 24 24"><path d="M12 3.2 18.6 20 12 15.4 5.4 20z" fill="#fff"/></svg></div>',className:'',iconSize:[40,40],iconAnchor:[20,20]}),zIndexOffset:1000}).addTo(map);
  }

  if(!HAS_MAP){
    var nm=document.createElement('div');
    nm.id='nomap';
    nm.textContent='Карта появится при подключении к интернету';
    document.body.appendChild(nm);
  }

  var R={pts:[],cum:[],total:0,dur:1,mans:[]};
  var FOLLOW=true,gotFix=false,offCnt=0,simTimer=null,fetching=false,fitted=false;
  var lastP=null,lastHd=null,lastSim=false;

  if(map){map.on('dragstart',function(){FOLLOW=false;});}
  window.addEventListener('message',function(e){
    var d=e.data||{};
    if(d.type==='kinetix-nav'&&d.kind==='recenter'){FOLLOW=true;}
  });

  function post(o){o.type='kinetix-nav';o.kind='state';parent.postMessage(o,'*');}
  function rad(x){return x*Math.PI/180;}
  function hav(a,b){
    var dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);
    var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 12742000*Math.asin(Math.sqrt(s));
  }
  function bearing(a,b){
    var y=Math.sin(rad(b[1]-a[1]))*Math.cos(rad(b[0]));
    var x=Math.cos(rad(a[0]))*Math.sin(rad(b[0]))-Math.sin(rad(a[0]))*Math.cos(rad(b[0]))*Math.cos(rad(b[1]-a[1]));
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  function nearest(p){
    var bi=0,bd=1e18;
    for(var i=0;i<R.pts.length;i++){var d=hav(p,R.pts[i]);if(d<bd){bd=d;bi=i;}}
    return {i:bi,d:bd};
  }
  function useRoute(pts,dur,steps){
    var cum=[0];
    for(var i=1;i<pts.length;i++){cum.push(cum[i-1]+hav(pts[i-1],pts[i]));}
    var mans=[];
    for(var s=0;s<steps.length;s++){
      var st=steps[s],mv=st.maneuver||{};
      if(mv.type==='depart'){continue;}
      var loc=[(mv.location||[0,0])[1],(mv.location||[0,0])[0]];
      var bi=0,bd=1e18;
      for(var k=0;k<pts.length;k++){var dd=hav(loc,pts[k]);if(dd<bd){bd=dd;bi=k;}}
      mans.push({i:bi,t:String(mv.type||'turn'),m:String(mv.modifier||''),n:String(st.name||'')});
    }
    mans.sort(function(a,b){return a.i-b.i;});
    R={pts:pts,cum:cum,total:cum[cum.length-1]||1,dur:Math.max(dur,1),mans:mans};
    if(line){line.setLatLngs(pts);}
    if(casing){casing.setLatLngs(pts);}
    if(map&&!fitted){fitted=true;map.fitBounds(L.latLngBounds(pts).pad(0.25));}
  }
  function fallbackRoute(from){
    useRoute([from,T],hav(from,T)/8.3,[{maneuver:{type:'arrive',modifier:'',location:[T[1],T[0]]},name:''}]);
  }
  function fetchRoute(from){
    if(fetching){return;}
    fetching=true;
    fetch('https://router.project-osrm.org/route/v1/driving/'+from[1]+','+from[0]+';'+T[1]+','+T[0]+'?overview=full&geometries=geojson&steps=true')
      .then(function(r){return r.json();})
      .then(function(j){
        var rt=j&&j.routes&&j.routes[0];
        if(!rt||!rt.geometry){throw new Error('no route');}
        var pts=rt.geometry.coordinates.map(function(c){return [c[1],c[0]];});
        useRoute(pts,rt.duration||1,(rt.legs&&rt.legs[0]&&rt.legs[0].steps)||[]);
      })
      .catch(function(){fallbackRoute(from);})
      .then(function(){fetching=false;});
  }
  function onPos(lat,lng,hd,sim){
    var p=[lat,lng];
    lastP=p;lastHd=hd;lastSim=!!sim;
    if(car){car.setLatLng(p);}
    if(!R.pts.length){return;}
    var n=nearest(p);
    if(!sim){
      if(n.d>60){offCnt++;}else{offCnt=0;}
      if(offCnt>=3){offCnt=0;fetchRoute(p);}
    }
    var rem=Math.max(0,R.total-R.cum[n.i]);
    var man=null;
    for(var i=0;i<R.mans.length;i++){if(R.mans[i].i>n.i){man=R.mans[i];break;}}
    if(!man){man={i:R.pts.length-1,t:'arrive',m:'',n:''};}
    var dm=man.t==='arrive'?rem:Math.max(0,R.cum[man.i]-R.cum[n.i]);
    var deg=(hd!==null&&hd!==undefined&&!isNaN(hd))?hd:(n.i<R.pts.length-1?bearing(R.pts[n.i],R.pts[n.i+1]):0);
    var el=document.getElementById('car');
    if(el){el.style.transform='rotate('+deg+'deg)';}
    if(map&&FOLLOW){map.setView(p,Math.max(map.getZoom(),16),{animate:true});}
    var spd=R.total/R.dur;
    post({
      arrived:rem<30,
      distToManeuverM:Math.round(dm),
      maneuverType:man.t,
      maneuverModifier:man.m,
      streetName:man.n,
      remainingKm:rem/1000,
      remainingMin:Math.max(1,Math.round(rem/Math.max(spd,3)/60)),
      simulated:!!sim,
      offRoute:offCnt>0
    });
  }
  function ptAt(dist){
    var pts=R.pts,cum=R.cum;
    if(dist<=0){return {p:pts[0],b:bearing(pts[0],pts[Math.min(1,pts.length-1)])};}
    for(var i=1;i<pts.length;i++){
      if(cum[i]>=dist){
        var f=(dist-cum[i-1])/Math.max(cum[i]-cum[i-1],0.01);
        var a=pts[i-1],b=pts[i];
        return {p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],b:bearing(a,b)};
      }
    }
    return {p:pts[pts.length-1],b:0};
  }
  function startSim(){
    if(simTimer||gotFix){return;}
    var d=0;
    simTimer=setInterval(function(){
      if(!R.pts.length){return;}
      d+=11*0.7;
      if(d>=R.total){d=R.total;clearInterval(simTimer);}
      var at=ptAt(d);
      onPos(at.p[0],at.p[1],at.b,true);
    },700);
  }

  // Ретик: единичный GPS-фикс или подоспевший маршрут не должны оставлять
  // баннер в состоянии «строим путь» — пересчитываем от последней позиции.
  setInterval(function(){
    if(lastP&&R.pts.length&&!simTimer){onPos(lastP[0],lastP[1],lastHd,lastSim);}
  },1500);

  fetchRoute(S);
  if(navigator.geolocation){
    navigator.geolocation.watchPosition(function(pos){
      if(!gotFix){gotFix=true;if(simTimer){clearInterval(simTimer);simTimer=null;}fetchRoute([pos.coords.latitude,pos.coords.longitude]);}
      onPos(pos.coords.latitude,pos.coords.longitude,pos.coords.heading,false);
    },function(){startSim();},{enableHighAccuracy:true,maximumAge:2000,timeout:8000});
  }else{startSim();}
  setTimeout(function(){if(!gotFix){startSim();}},7000);
})();
</script></body></html>`;
}

export function DriverNavigatorMap({ height, iframeRef, simStart, target }: DriverNavigatorMapProps) {
  // Навигатор работает на web (деплой-цель). Для APK позже — тот же HTML в WebView.
  if (Platform.OS !== 'web') {
    return null;
  }

  const createElement = (require('react-native-web') as { unstable_createElement: Function })
    .unstable_createElement;

  return createElement('iframe', {
    title: 'Навигатор',
    ref: iframeRef,
    allow: 'geolocation',
    srcDoc: buildNavigatorHtml(target, simStart),
    style: { width: '100%', height, border: 0, display: 'block' },
  });
}
