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
        background: radial-gradient(circle at 50% 42%, #12271E 0%, #0A1411 55%, #050D09 100%);
        display: flex;
        flex-direction: column;
        inset: 0;
        justify-content: center;
        position: fixed;
        z-index: 9999;
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
        background: rgba(92, 230, 160, 0.14);
        border-radius: 50%;
        content: '';
        height: 190px;
        position: absolute;
        width: 190px;
        z-index: -1;
        animation: kb-breathe 4s ease-in-out infinite;
      }
      @keyframes kb-breathe {
        0%, 100% { opacity: 0.75; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
      }
      #kinetix-boot .kb-badge {
        align-items: center;
        background: rgba(183, 244, 106, 0.06);
        border: 1px solid rgba(183, 244, 106, 0.42);
        border-radius: 22px;
        box-shadow: 0 0 22px rgba(183, 244, 106, 0.24);
        display: flex;
        height: 74px;
        justify-content: center;
        overflow: hidden;
        position: relative;
        width: 74px;
      }
      #kinetix-boot .kb-badge::before {
        background: rgba(255, 255, 255, 0.10);
        border-radius: 50%;
        content: '';
        height: 60px;
        left: -6px;
        position: absolute;
        top: -34px;
        width: 86px;
      }
      #kinetix-boot .kb-brand {
        color: #F4FBF7;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 33px;
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      #kinetix-boot .kb-sub {
        color: rgba(159, 196, 178, 0.9);
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 3.4px;
        margin-top: 9px;
      }
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-badge-wrap::before { animation: none; }
      }
    </style>`;

// Ночная сцена: тёмно-стеклянный значок со свечением и лайм-стрелкой.
// Радар-кольца добавляет React-splash поверх — в boot их нет, чтобы при
// передаче эстафеты они не двоились.
const bootMarkup = `
    <div id="kinetix-boot">
      <div class="kb-badge-wrap">
        <div class="kb-badge">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#B7F46A" stroke="#B7F46A" stroke-width="2" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      </div>
      <div class="kb-brand">Kinetix</div>
      <div class="kb-sub">ТАКСИ · ПАРТНЁР</div>
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
