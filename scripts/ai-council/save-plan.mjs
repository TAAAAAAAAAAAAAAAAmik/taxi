// Сохраняет согласованный план фазы ПЛАН (с правильной локальной датой и путём) и пишет лог.
// Использование: node save-plan.mjs <code|design> <decision.json> <log.md>
//   decision.json: {"consensus": true|false, "spec": {...}|null}
//   log.md: текст обсуждения (markdown)
import fs from "node:fs";
import { planFile, writeLog, todayDate } from "./lib.mjs";

const track = process.argv[2] === "design" ? "design" : "code";
const decisionPath = process.argv[3];
const logPath = process.argv[4];
if (!decisionPath || !fs.existsSync(decisionPath)) { console.error("Нужен путь к decision.json"); process.exit(2); }

let dec;
try { dec = JSON.parse(fs.readFileSync(decisionPath, "utf8")); }
catch (e) { console.error("decision.json не парсится: " + e.message); process.exit(2); }

const consensus = dec.consensus === true && dec.spec && dec.spec.title;
const plan = { date: todayDate(), track, consensus: !!consensus, spec: consensus ? dec.spec : null, createdAt: new Date().toISOString() };
fs.writeFileSync(planFile(track), JSON.stringify(plan, null, 2), "utf8");

const transcript = logPath && fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "(лог не передан)";
const decision = consensus
  ? { date: todayDate(), track, phase: "plan", consensus: true, title: dec.spec.title }
  : { date: todayDate(), track, phase: "plan", consensus: false, reason: (dec.spec && dec.spec.reason) || "no consensus" };
const logFile = writeLog(`${todayDate()}-${track}-plan`, transcript, decision);

console.log(`[PLAN SAVED] track=${track} consensus=${plan.consensus} title=${consensus ? dec.spec.title : "—"}`);
console.log(`plan: ${planFile(track)}`);
console.log(`log:  ${logFile}`);
