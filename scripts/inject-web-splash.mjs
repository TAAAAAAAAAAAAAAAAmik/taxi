import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Пост-экспортный шаг web-сборки: вставляет в dist/index.html статичный
// тёмный boot-splash, который виден с первого кадра, пока грузится JS-бандл
// (вместо белого экрана). React-сплэш рисует ту же ночную сцену и гасит
// boot-слой сразу после монтирования (см. App.tsx, #kinetix-boot).
const distIndexPath = resolve(process.cwd(), process.argv[2] || 'dist/index.html');
const bootMarker = 'id="kinetix-boot"';

const bootStyles = `
    <style id="kinetix-boot-style">
      body { background: #0A1411; }
      #kinetix-boot {
        align-items: center;
        background: #0A1411;
        display: flex;
        flex-direction: column;
        inset: 0;
        justify-content: center;
        position: fixed;
        z-index: 9999;
      }
      #kinetix-boot .kb-badge {
        align-items: center;
        background: #B7F46A;
        border-radius: 22px;
        display: flex;
        height: 72px;
        justify-content: center;
        margin-bottom: 24px;
        position: relative;
        width: 72px;
      }
      #kinetix-boot .kb-badge::before {
        background: rgba(92, 230, 160, 0.12);
        border-radius: 50%;
        content: '';
        height: 150px;
        position: absolute;
        width: 150px;
        z-index: -1;
      }
      #kinetix-boot .kb-brand {
        color: #F2FBF6;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 32px;
        font-weight: 800;
        letter-spacing: -0.6px;
      }
      #kinetix-boot .kb-sub {
        color: #93BAA8;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.2px;
        margin-top: 6px;
      }
      #kinetix-boot .kb-track {
        background: rgba(183, 244, 106, 0.16);
        border-radius: 999px;
        bottom: 72px;
        height: 3px;
        overflow: hidden;
        position: absolute;
        width: 128px;
      }
      #kinetix-boot .kb-track::after {
        animation: kb-load 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        background: #B7F46A;
        border-radius: 999px;
        content: '';
        display: block;
        height: 3px;
        width: 100%;
      }
      @keyframes kb-load {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-track::after { animation: none; }
      }
    </style>`;

// SVG-стрелка навигации (lucide navigation) графитом на лайм-значке.
const bootMarkup = `
    <div id="kinetix-boot">
      <div class="kb-badge">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#0A1411" stroke="#0A1411" stroke-width="2" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
      </div>
      <div class="kb-brand">Kinetix</div>
      <div class="kb-sub">Такси Партнёр</div>
      <div class="kb-track"></div>
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
