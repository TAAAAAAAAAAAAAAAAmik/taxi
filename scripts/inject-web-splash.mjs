import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Пост-экспортный шаг web-сборки: вставляет в dist/index.html единственный
// экран загрузки — современная aurora-сцена: мягкие размытые зелёные
// свечения плавно дрейфуют за чистым wordmark с бегущим бликом. Виден с
// первого кадра, плавно гаснет, когда приложение готово (App.tsx).
const distIndexPath = resolve(process.cwd(), process.argv[2] || 'dist/index.html');
const bootMarker = 'id="kinetix-boot"';

const bootStyles = `
    <style id="kinetix-boot-style">
      body { background: #F5F9F6; }
      #kinetix-boot {
        align-items: center;
        background: #F5F9F6;
        display: flex;
        flex-direction: column;
        inset: 0;
        justify-content: center;
        overflow: hidden;
        position: fixed;
        z-index: 9999;
      }
      /* Aurora: крупные размытые пятна цвета медленно дрейфуют и пульсируют. */
      #kinetix-boot .kb-blob {
        border-radius: 50%;
        filter: blur(64px);
        position: absolute;
        will-change: transform;
      }
      #kinetix-boot .kb-b1 {
        background: rgba(0, 166, 90, 0.5);
        height: 300px; width: 300px;
        top: 16%; left: 8%;
        animation: kb-drift1 17s ease-in-out infinite;
      }
      #kinetix-boot .kb-b2 {
        background: rgba(183, 244, 106, 0.45);
        height: 260px; width: 260px;
        top: 40%; right: 6%;
        animation: kb-drift2 21s ease-in-out infinite;
      }
      #kinetix-boot .kb-b3 {
        background: rgba(92, 230, 160, 0.4);
        height: 280px; width: 280px;
        bottom: 12%; left: 26%;
        animation: kb-drift3 25s ease-in-out infinite;
      }
      @keyframes kb-drift1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(46px, 34px) scale(1.16); }
        66% { transform: translate(-28px, 18px) scale(0.92); }
      }
      @keyframes kb-drift2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(-40px, 28px) scale(0.9); }
        66% { transform: translate(24px, -32px) scale(1.18); }
      }
      @keyframes kb-drift3 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(30px, -40px) scale(1.12); }
      }
      /* Лёгкая вуаль, чтобы свечения не были слишком плотными под текстом. */
      #kinetix-boot .kb-veil {
        background: radial-gradient(80% 60% at 50% 46%, rgba(245, 249, 246, 0.55) 0%, rgba(245, 249, 246, 0) 70%);
        inset: 0;
        position: absolute;
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
      #kinetix-boot .kb-mark {
        align-items: center;
        display: flex;
        height: 30px;
        justify-content: center;
        margin-bottom: 18px;
      }
      #kinetix-boot .kb-mark svg { display: block; }
      #kinetix-boot .kb-brand {
        background: linear-gradient(100deg,
          #0F3226 0%, #0F3226 40%, #3FB873 49%, #A9EE8B 52%, #3FB873 55%, #0F3226 64%, #0F3226 100%);
        background-size: 260% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 42px;
        font-weight: 800;
        letter-spacing: -0.8px;
        animation: kb-shine 2.6s linear infinite;
      }
      @keyframes kb-shine {
        0% { background-position: 130% 0; }
        100% { background-position: -30% 0; }
      }
      #kinetix-boot .kb-sub {
        color: #6E8C7F;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 4px;
        margin-top: 12px;
      }
      #kinetix-boot .kb-track {
        background: rgba(0, 141, 73, 0.14);
        border-radius: 999px;
        bottom: 78px;
        height: 2px;
        overflow: hidden;
        position: absolute;
        width: 116px;
      }
      #kinetix-boot .kb-track::after {
        animation: kb-load 1.3s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        background: #008D49;
        border-radius: 999px;
        content: '';
        display: block;
        height: 2px;
        width: 40%;
      }
      @keyframes kb-load {
        0% { transform: translateX(-130%); }
        100% { transform: translateX(360%); }
      }
      /* Декоративное движение (aurora, блик) выключаем при reduced-motion,
         а бегущую полосу-индикатор оставляем: это функциональный статус
         загрузки, а не декор. */
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-blob { animation: none; }
        #kinetix-boot .kb-brand { animation: none; color: #0F3226; }
      }
    </style>`;

const bootMarkup = `
    <div id="kinetix-boot">
      <div class="kb-blob kb-b1"></div>
      <div class="kb-blob kb-b2"></div>
      <div class="kb-blob kb-b3"></div>
      <div class="kb-veil"></div>
      <div class="kb-content">
        <div class="kb-mark">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#008D49" stroke="#008D49" stroke-width="2" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
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
