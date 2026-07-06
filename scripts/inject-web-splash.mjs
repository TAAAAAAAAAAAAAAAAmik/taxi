import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Пост-экспортный шаг web-сборки: вставляет в dist/index.html единственный
// экран загрузки — современный минимал: чистый светлый фон с мягким
// свечением, крупный wordmark с бегущим бликом (shimmer) и тонкий
// индикатор. Виден с первого кадра, плавно гаснет, когда приложение готово.
const distIndexPath = resolve(process.cwd(), process.argv[2] || 'dist/index.html');
const bootMarker = 'id="kinetix-boot"';

const bootStyles = `
    <style id="kinetix-boot-style">
      body { background: #F7FAF7; }
      #kinetix-boot {
        align-items: center;
        background:
          radial-gradient(120% 80% at 50% 38%, rgba(0, 141, 73, 0.06) 0%, rgba(0, 141, 73, 0) 60%),
          #F7FAF7;
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
        animation: kb-enter 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes kb-enter {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #kinetix-boot .kb-mark {
        align-items: center;
        display: flex;
        justify-content: center;
        height: 30px;
        margin-bottom: 18px;
      }
      #kinetix-boot .kb-mark svg { display: block; }
      /* Wordmark с бегущим бликом: базовый тёмно-зелёный, сквозь него
         проходит светлая полоса — современный, сдержанный приём. */
      #kinetix-boot .kb-brand {
        background: linear-gradient(100deg,
          #12382C 0%, #12382C 38%, #4FC07E 48%, #A9EE8B 52%, #4FC07E 56%, #12382C 66%, #12382C 100%);
        background-size: 260% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 40px;
        font-weight: 800;
        letter-spacing: -0.8px;
        animation: kb-shine 2.4s linear infinite;
      }
      @keyframes kb-shine {
        0% { background-position: 130% 0; }
        100% { background-position: -30% 0; }
      }
      #kinetix-boot .kb-sub {
        color: #7C948A;
        font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 4px;
        margin-top: 12px;
      }
      /* Тонкий индикатор: сегмент скользит по дорожке. */
      #kinetix-boot .kb-track {
        background: rgba(0, 141, 73, 0.12);
        border-radius: 999px;
        bottom: 78px;
        height: 2px;
        overflow: hidden;
        position: absolute;
        width: 116px;
      }
      #kinetix-boot .kb-track::after {
        animation: kb-load 1.25s cubic-bezier(0.65, 0, 0.35, 1) infinite;
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
        #kinetix-boot .kb-brand { animation: none; color: #12382C; }
        #kinetix-boot .kb-track::after {
          animation: kb-blink 1.6s ease-in-out infinite;
          transform: none;
          width: 100%;
        }
      }
      @keyframes kb-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    </style>`;

// Небольшой лаконичный знак-стрелка над wordmark (лайм-акцент).
const bootMarkup = `
    <div id="kinetix-boot">
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
