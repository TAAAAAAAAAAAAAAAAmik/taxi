import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Пост-экспортный шаг web-сборки: вставляет в dist/index.html единственный
// экран загрузки в стиле Яндекс Go — полноэкранная фирменная зелёная заливка,
// крупный белый значок с пульсом, белые радар-кольца и бегущая полоса. Виден
// с первого кадра и плавно гаснет, когда приложение готово (App.tsx).
const distIndexPath = resolve(process.cwd(), process.argv[2] || 'dist/index.html');
const bootMarker = 'id="kinetix-boot"';

const bootStyles = `
    <style id="kinetix-boot-style">
      body { background: #008D49; }
      #kinetix-boot {
        align-items: center;
        background: linear-gradient(158deg, #00A65A 0%, #008D49 55%, #027A3F 100%);
        display: flex;
        flex-direction: column;
        inset: 0;
        justify-content: center;
        overflow: hidden;
        position: fixed;
        z-index: 9999;
      }
      #kinetix-boot .kb-content {
        align-items: center;
        display: flex;
        flex-direction: column;
        position: relative;
        animation: kb-enter 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes kb-enter {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #kinetix-boot .kb-badge-wrap {
        align-items: center;
        display: flex;
        height: 108px;
        justify-content: center;
        margin-bottom: 30px;
        position: relative;
        width: 108px;
      }
      /* Белые радар-кольца расходятся на зелёном — контрастно и заметно. */
      #kinetix-boot .kb-radar {
        border: 2px solid rgba(255, 255, 255, 0.55);
        border-radius: 50%;
        height: 96px;
        position: absolute;
        width: 96px;
        animation: kb-radar 2s ease-out infinite;
      }
      #kinetix-boot .kb-radar.r2 { animation-delay: 0.66s; }
      #kinetix-boot .kb-radar.r3 { animation-delay: 1.33s; }
      @keyframes kb-radar {
        0% { opacity: 0; transform: scale(0.65); }
        16% { opacity: 0.6; }
        70% { opacity: 0.15; }
        100% { opacity: 0; transform: scale(2.7); }
      }
      /* Крупный белый значок «бьётся» — заметная пульсация. */
      #kinetix-boot .kb-badge {
        align-items: center;
        background: #FFFFFF;
        border-radius: 28px;
        box-shadow: 0 14px 34px rgba(0, 60, 30, 0.35);
        display: flex;
        height: 96px;
        justify-content: center;
        position: relative;
        width: 96px;
        animation: kb-pop 620ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
                   kb-pulse 1.5s ease-in-out 620ms infinite;
      }
      @keyframes kb-pop {
        from { opacity: 0; transform: scale(0.6); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes kb-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      #kinetix-boot .kb-brand {
        color: #FFFFFF;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 38px;
        font-weight: 800;
        letter-spacing: -0.6px;
      }
      #kinetix-boot .kb-sub {
        color: rgba(255, 255, 255, 0.78);
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 3.6px;
        margin-top: 10px;
      }
      /* Бегущая полоса загрузки внизу. */
      #kinetix-boot .kb-track {
        background: rgba(255, 255, 255, 0.22);
        border-radius: 999px;
        bottom: 74px;
        height: 4px;
        overflow: hidden;
        position: absolute;
        width: 150px;
      }
      #kinetix-boot .kb-track::after {
        animation: kb-load 1.15s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        background: #FFFFFF;
        border-radius: 999px;
        content: '';
        display: block;
        height: 4px;
        width: 45%;
      }
      @keyframes kb-load {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(370%); }
      }
      /* Reduced-motion: без «полёта», но оставляем мягкое мигание значка и
         полосы — это допустимая opacity-анимация и не мёртвая статика. */
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-radar { animation: none; opacity: 0; }
        #kinetix-boot .kb-badge {
          animation: kb-blink 1.6s ease-in-out infinite;
        }
        #kinetix-boot .kb-track::after {
          animation: kb-blink 1.6s ease-in-out infinite;
          transform: none;
          width: 100%;
        }
      }
      @keyframes kb-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.55; }
      }
    </style>`;

// Значок: белый с зелёной стрелкой навигации (инверсия на зелёном фоне).
const bootMarkup = `
    <div id="kinetix-boot">
      <div class="kb-content">
        <div class="kb-badge-wrap">
          <div class="kb-radar r1"></div>
          <div class="kb-radar r2"></div>
          <div class="kb-radar r3"></div>
          <div class="kb-badge">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#008D49" stroke="#008D49" stroke-width="2" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </div>
        </div>
        <div class="kb-brand">Kinetix</div>
        <div class="kb-sub">ТАКСИ · ПАРТНЁР</div>
      </div>
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
