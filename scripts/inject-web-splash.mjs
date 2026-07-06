import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Пост-экспортный шаг web-сборки: вставляет в dist/index.html единственный
// экран загрузки в стиле Яндекс Go — крупный wordmark «Kinetix» почти во
// весь экран, который плавно растёт (и «раскрывается» зумом в приложение на
// выходе — см. App.tsx), с бегущим бликом и мягким свечением за буквами.
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
      /* Мягкие свечения за буквами — деликатная глубина, не отвлекают. */
      #kinetix-boot .kb-blob {
        border-radius: 50%;
        filter: blur(70px);
        opacity: 0.6;
        position: absolute;
        will-change: transform;
      }
      #kinetix-boot .kb-b1 {
        background: rgba(0, 166, 90, 0.4);
        height: 320px; width: 320px;
        top: 18%; left: 6%;
        animation: kb-drift1 18s ease-in-out infinite;
      }
      #kinetix-boot .kb-b2 {
        background: rgba(183, 244, 106, 0.38);
        height: 300px; width: 300px;
        bottom: 16%; right: 4%;
        animation: kb-drift2 22s ease-in-out infinite;
      }
      @keyframes kb-drift1 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(40px, 30px) scale(1.15); }
      }
      @keyframes kb-drift2 {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-34px, -26px) scale(1.12); }
      }
      /* Буквы плавно растут всё время показа — ощущение «раскрытия». */
      #kinetix-boot .kb-hero {
        position: relative;
        animation: kb-grow 6s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes kb-grow {
        0% { opacity: 0; transform: scale(0.86); }
        14% { opacity: 1; }
        100% { transform: scale(1.08); }
      }
      /* Крупный wordmark почти во всю ширину, с бегущим бликом. */
      #kinetix-boot .kb-brand {
        background: linear-gradient(100deg,
          #0F3226 0%, #0F3226 40%, #3FB873 49%, #A9EE8B 52%, #3FB873 55%, #0F3226 64%, #0F3226 100%);
        background-size: 260% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: min(21vw, 128px);
        font-weight: 800;
        letter-spacing: -0.04em;
        line-height: 1;
        margin: 0;
        animation: kb-shine 2.8s linear infinite;
      }
      @keyframes kb-shine {
        0% { background-position: 130% 0; }
        100% { background-position: -30% 0; }
      }
      #kinetix-boot .kb-sub {
        color: #6E8C7F;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 4px;
        margin-top: 16px;
        text-align: center;
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
      @media (prefers-reduced-motion: reduce) {
        #kinetix-boot .kb-blob { animation: none; }
        #kinetix-boot .kb-hero { animation: none; }
        #kinetix-boot .kb-brand { animation: none; color: #0F3226; }
      }
    </style>`;

const bootMarkup = `
    <div id="kinetix-boot">
      <div class="kb-blob kb-b1"></div>
      <div class="kb-blob kb-b2"></div>
      <div class="kb-hero">
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
