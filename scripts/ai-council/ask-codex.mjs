// Передаёт сообщение Codex (read-only, без сканирования всего проекта) и печатает чистый ответ.
// Использование: node ask-codex.mjs <файл-с-сообщением>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, REPO, CONFIG } from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msgFile = process.argv[2];
if (!msgFile || !fs.existsSync(msgFile)) {
  console.error("Нужен путь к файлу с сообщением для Codex");
  process.exit(2);
}
const prompt = fs.readFileSync(msgFile, "utf8");
const outFile = path.join(__dirname, `.codex-out-${Date.now()}.txt`);
const args = ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "-o", outFile];
if (CONFIG.codexModel) args.push("--model", CONFIG.codexModel);
const r = run("codex", args, { input: prompt, cwd: REPO });
let out = "";
try { out = fs.readFileSync(outFile, "utf8").trim(); fs.unlinkSync(outFile); } catch { out = r.stdout.trim(); }
if (!out) { console.error(`Codex вернул пусто (code ${r.code}): ${r.stderr.slice(0, 400)}`); process.exit(1); }
console.log(out);
