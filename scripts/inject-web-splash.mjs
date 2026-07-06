import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Пост-экспортный шаг web-сборки: вставляет в dist/index.html единственный
// экран загрузки — полную ночную сцену (градиент, карта, маршрут, огни,
// радар, значок, лого) на чистом HTML+CSS+inline SVG. Он виден с первого
// кадра и плавно гаснет, когда приложение готово (см. App.tsx, #kinetix-boot).
// На web React-сплэша поверх нет — поэтому переход только один и плавный.
const distIndexPath = resolve(process.cwd(), process.argv[2] || 'dist/index.html');
const bootMarker = 'id="kinetix-boot"';

// Ночная сцена в координатах 390x844 (растягивается slice под любой экран).
function buildSceneSvg() {
  const w = 390;
  const h = 844;
  const cx = w / 2;

  const streets = [
    [-40, h * 0.26, w + 40, h * 0.2, 0.06],
    [-40, h * 0.44, w + 40, h * 0.36, 0.05],
    [-40, h * 0.62, w + 40, h * 0.54, 0.06],
    [-40, h * 0.8, w + 40, h * 0.72, 0.05],
    [w * 0.24, -40, w * 0.16, h + 40, 0.04],
    [w * 0.72, -40, w * 0.8, h + 40, 0.04],
  ]
    .map(
      ([x1, y1, x2, y2, o]) =>
        `<line x1="${x1}" y1="${round(y1)}" x2="${x2}" y2="${round(y2)}" stroke="#008D49" stroke-opacity="${o}" stroke-width="1"/>`,
    )
    .join('');

  const ry = round(h * 0.72);
  const route =
    `<path d="M ${cx - 96} ${ry} L ${cx + 8} ${ry} L ${cx + 8} ${ry - 54} L ${cx + 92} ${ry - 54}" ` +
    `fill="none" stroke="#008D49" stroke-opacity="0.32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${cx - 96}" cy="${ry}" r="5" fill="#FFFFFF" stroke="#008D49" stroke-opacity="0.65" stroke-width="2"/>` +
    `<circle cx="${cx + 92}" cy="${ry - 54}" r="4" fill="#008D49" fill-opacity="0.75"/>`;

  const lightSeeds = [
    [0.14, 0.18], [0.86, 0.12], [0.32, 0.1], [0.68, 0.24], [0.08, 0.5],
    [0.92, 0.46], [0.2, 0.86], [0.8, 0.9], [0.5, 0.08], [0.4, 0.9],
    [0.12, 0.68], [0.9, 0.7], [0.6, 0.86], [0.26, 0.6],
  ];
  const lights = lightSeeds
    .map(([fx, fy], i) => {
      const r = i % 3 === 0 ? 1.6 : 1.1;
      const o = i % 4 === 0 ? 0.4 : 0.22;
      return `<circle cx="${round(fx * w)}" cy="${round(fy * h)}" r="${r}" fill="#008D49" fill-opacity="${o}"/>`;
    })
    .join('');

  return (
    `<svg class="kb-scene" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<radialGradient id="kbBg" cx="50%" cy="42%" r="80%">` +
    `<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#F3F7F2"/><stop offset="1" stop-color="#E4EEE7"/>` +
    `</radialGradient>` +
    `<radialGradient id="kbGlow" cx="50%" cy="42%" r="30%">` +
    `<stop offset="0" stop-color="#008D49" stop-opacity="0.12"/><stop offset="1" stop-color="#008D49" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#kbBg)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#kbGlow)"/>` +
    streets +
    route +
    lights +
    `</svg>`
  );
}

function round(n) {
  return Math.round(n);
}

const bootStyles = `
    <style id="kinetix-boot-style">
      body { background: #F3F7F2; }
      #kinetix-boot {
        align-items: center;
        background: #F3F7F2;
        display: flex;
        flex-direction: column;
        inset: 0;
        justify-content: center;
        overflow: hidden;
        position: fixed;
        z-index: 9999;
      }
      #kinetix-boot .kb-scene {
        height: 100%;
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
      }
      #kinetix-boot .kb-content {
        align-items: center;
        display: flex;
        flex-direction: column;
        position: relative;
        animation: kb-enter 640ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes kb-enter {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #kinetix-boot .kb-badge-wrap {
        align-items: center;
        display: flex;
        height: 82px;
        justify-content: center;
        margin-bottom: 26px;
        position: relative;
        width: 82px;
      }
      #kinetix-boot .kb-badge-wrap::before {
        background: rgba(0, 141, 73, 0.12);
        border-radius: 50%;
        content: '';
        height: 150px;
        position: absolute;
        width: 150px;
        z-index: -1;
        animation: kb-breathe 4s ease-in-out infinite;
      }
      @keyframes kb-breathe {
        0%, 100% { opacity: 0.7; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
      }
      #kinetix-boot .kb-radar {
        border: 1.5px solid rgba(0, 141, 73, 0.32);
        border-radius: 50%;
        height: 82px;
        position: absolute;
        width: 82px;
        animation: kb-radar 3.6s ease-in-out infinite;
      }
      #kinetix-boot .kb-radar.r2 { animation-delay: 1.2s; }
      #kinetix-boot .kb-radar.r3 { animation-delay: 2.4s; }
      @keyframes kb-radar {
        0% { opacity: 0; transform: scale(0.75); }
        20% { opacity: 0.32; }
        75% { opacity: 0.1; }
        100% { opacity: 0; transform: scale(3); }
      }
      #kinetix-boot .kb-badge {
        align-items: center;
        background: #008D49;
        border-radius: 22px;
        box-shadow: 0 10px 20px rgba(0, 111, 58, 0.34);
        display: flex;
        height: 74px;
        justify-content: center;
        overflow: hidden;
        position: relative;
        width: 74px;
      }
      #kinetix-boot .kb-badge::before {
        background: rgba(255, 255, 255, 0.22);
        border-radius: 50%;
        content: '';
        height: 60px;
        left: -6px;
        position: absolute;
        top: -34px;
        width: 86px;
      }
      #kinetix-boot .kb-brand {
        color: #12382C;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 33px;
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      #kinetix-boot .kb-sub {
        color: #6E8579;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 3.4px;
        margin-top: 9px;
      }
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-badge-wrap::before,
        #kinetix-boot .kb-radar { animation: none; }
        #kinetix-boot .kb-radar { opacity: 0; }
      }
    </style>`;

const bootMarkup = `
    <div id="kinetix-boot">
      ${buildSceneSvg()}
      <div class="kb-content">
        <div class="kb-badge-wrap">
          <div class="kb-radar r1"></div>
          <div class="kb-radar r2"></div>
          <div class="kb-radar r3"></div>
          <div class="kb-badge">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </div>
        </div>
        <div class="kb-brand">Kinetix</div>
        <div class="kb-sub">ТАКСИ · ПАРТНЁР</div>
      </div>
    </div>`;

const html = await readFile(distIndexPath, 'utf8');

if (html.includes(bootMarker)) {
  console.log('Boot splash already injected, skipping');
  process.exit(0);
}

const headAnchor = '</head>';
const rootAnchor = '<div id="root"></div>';

if (!html.includes(headAnchor) || !html.includes(rootAnchor)) {
  console.error('inject-web-splash: expected anchors not found in', distIndexPath);
  process.exit(1);
}

const patched = html
  .replace(headAnchor, `${bootStyles}\n${headAnchor}`)
  .replace(rootAnchor, `${rootAnchor}${bootMarkup}`);

await writeFile(distIndexPath, patched);
console.log('Boot splash injected into', distIndexPath);
