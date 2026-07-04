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
        gap: 18px;
        inset: 0;
        justify-content: center;
        position: fixed;
        z-index: 9999;
      }
      #kinetix-boot .kb-glow {
        background: rgba(92, 230, 160, 0.10);
        border-radius: 50%;
        height: 260px;
        position: absolute;
        right: -70px;
        top: -60px;
        width: 260px;
      }
      #kinetix-boot .kb-pin {
        background: #B7F46A;
        border-radius: 50%;
        height: 14px;
        position: relative;
        width: 14px;
      }
      #kinetix-boot .kb-pin::after {
        animation: kb-pulse 1.4s cubic-bezier(0.33, 1, 0.68, 1) infinite;
        border: 1px solid rgba(183, 244, 106, 0.5);
        border-radius: 50%;
        content: '';
        inset: -4px;
        position: absolute;
      }
      #kinetix-boot .kb-brand {
        color: #F2FBF6;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      #kinetix-boot .kb-sub {
        color: #93BAA8;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 13px;
        font-weight: 600;
        margin-top: -12px;
      }
      @keyframes kb-pulse {
        0% { opacity: 0.9; transform: scale(1); }
        100% { opacity: 0; transform: scale(2.6); }
      }
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-pin::after { animation: none; opacity: 0.4; }
      }
    </style>`;

const bootMarkup = `
    <div id="kinetix-boot">
      <div class="kb-glow"></div>
      <div class="kb-pin"></div>
      <div class="kb-brand">Kinetix</div>
      <div class="kb-sub">Такси Партнёр</div>
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
