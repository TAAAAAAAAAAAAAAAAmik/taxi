#!/usr/bin/env node
// Совет Claude + Codex (project Kinetix / taxi-partner-app)
//
// Две дорожки (track): code и design. Каждая в две фазы (mode):
//   plan      — Claude и Codex обсуждают и согласуют ОДНО улучшение, план пишется в файл.
//   implement — через 2 часа: читаем план, реализуем -> typecheck -> кросс-ревью -> PR -> авто-merge.
//
// График (Планировщик Windows, локальное время Екатеринбург = МСК+2):
//   02:00 Екб (00:00 МСК)  node council.mjs plan code
//   04:00 Екб (02:00 МСК)  node council.mjs implement code
//   10:00 Екб (08:00 МСК)  node council.mjs plan design
//   12:00 Екб (10:00 МСК)  node council.mjs implement design
//
// Вручную:  node scripts/ai-council/council.mjs plan code [--dry-run]
//           node scripts/ai-council/council.mjs implement code [--dry-run]
// Конфиг:   scripts/ai-council/config.json

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

const ARGV = process.argv.slice(2);
const MODE = ARGV.includes("implement") ? "implement" : "plan";
const TRACK = ARGV.includes("design") ? "design" : "code";
const DRY_RUN = CONFIG.dryRun || ARGV.includes("--dry-run");

const REPO = CONFIG.repoDir;
const BASE = CONFIG.baseBranch;

const _now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const DATE = `${_now.getFullYear()}-${pad(_now.getMonth() + 1)}-${pad(_now.getDate())}`;
const STAMP = `${DATE}_${pad(_now.getHours())}-${pad(_now.getMinutes())}-${pad(_now.getSeconds())}`;

const PLAN_FILE = path.join(path.dirname(REPO), `.council-plan-${TRACK}.json`);

const transcript = [];
function log(section, body) {
  transcript.push(`\n## ${section}\n\n${body}\n`);
  process.stdout.write(`\n=== ${section} ===\n`);
}
function note(line) {
  transcript.push(`\n_${line}_\n`);
  process.stdout.write(line + "\n");
}

// ---------- низкоуровневые помощники ----------

function run(cmd, args, { input, cwd = REPO, timeout = CONFIG.callTimeoutMs } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, input, timeout, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status === null ? -1 : r.status,
    stdout: (r.stdout || "").toString(),
    stderr: (r.stderr || "").toString(),
    timedOut: r.error && r.error.code === "ETIMEDOUT",
  };
}
function git(args, opts = {}) {
  return run("git", ["-C", opts.cwd || REPO, ...args], { ...opts, cwd: opts.cwd || REPO });
}
function gitCommit(message, cwd) {
  const f = path.join(__dirname, `.commitmsg-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(f, message, "utf8");
  const r = git(["commit", "-F", f], { cwd });
  try { fs.unlinkSync(f); } catch {}
  return r;
}
function readCapped(rel, max = 3000) {
  try {
    const txt = fs.readFileSync(path.join(REPO, rel), "utf8");
    return txt.length > max ? txt.slice(0, max) + "\n…(обрезано)…" : txt;
  } catch { return ""; }
}

// ---------- вызовы агентов ----------

function callClaude(prompt, { cwd = REPO, timeout = CONFIG.callTimeoutMs } = {}) {
  const args = ["-p", "--output-format", "text", "--dangerously-skip-permissions"];
  if (CONFIG.claudeModel) args.push("--model", CONFIG.claudeModel);
  const r = run("claude", args, { input: prompt, cwd, timeout });
  const out = r.stdout.trim();
  if (!out) throw new Error(`claude вернул пусто (code ${r.code}): ${r.stderr.slice(0, 600)}`);
  return out;
}
function callCodex(prompt, { cwd = REPO, sandbox = "read-only", timeout = CONFIG.callTimeoutMs } = {}) {
  const outFile = path.join(__dirname, `.codex-out-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  const args = ["exec", "--sandbox", sandbox, "--skip-git-repo-check", "-o", outFile];
  if (CONFIG.codexModel) args.push("--model", CONFIG.codexModel);
  const r = run("codex", args, { input: prompt, cwd, timeout });
  let out = "";
  try { out = fs.readFileSync(outFile, "utf8").trim(); fs.unlinkSync(outFile); } catch { out = r.stdout.trim(); }
  if (!out) throw new Error(`codex вернул пусто (code ${r.code}): ${r.stderr.slice(0, 600)}`);
  return out;
}

// ---------- разбор ----------

function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { return null; }
}
function slugify(title) {
  const s = (title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return s || TRACK;
}
function recentTitles() {
  const dir = path.join(REPO, CONFIG.logDir);
  const out = [];
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().slice(-12);
    for (const f of files) {
      const m = fs.readFileSync(path.join(dir, f), "utf8").match(/COUNCIL_DECISION\s*(\{[\s\S]*?\})/);
      if (m) { try { const d = JSON.parse(m[1]); if (d.title) out.push(d.title); } catch {} }
    }
  } catch {}
  return out;
}

// ---------- GitHub ----------

function getGithubToken() {
  const r = git(["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n" });
  const p = r.stdout.match(/^password=(.*)$/m);
  if (!p) throw new Error("GitHub-токен не найден в credential store");
  return p[1].trim();
}
async function gh(method, endpoint, token, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `token ${token}`, Accept: "application/vnd.github+json",
      "User-Agent": "kinetix-ai-council", "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

// ---------- worktree ----------

function safeRemoveWorktree(wtPath) {
  if (!wtPath) return;
  const nm = path.join(wtPath, "node_modules");
  try {
    if (fs.lstatSync(nm).isSymbolicLink()) run("cmd", ["/c", "rmdir", `"${nm}"`]); // junction: убираем только ссылку
  } catch {}
  git(["worktree", "remove", "--force", wtPath]);
  try {
    if (fs.existsSync(wtPath)) {
      const linkStill = fs.existsSync(nm) && fs.lstatSync(nm).isSymbolicLink();
      if (!linkStill) run("cmd", ["/c", "rmdir", "/s", "/q", `"${wtPath}"`]);
    }
  } catch {}
  git(["worktree", "prune"]);
}

// ---------- лог ----------

function writeLog(name, decision) {
  const dir = path.join(REPO, CONFIG.logDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.md`);
  let body = `# Совет Claude + Codex — ${name}\n` + transcript.join("\n");
  if (decision) body += `\n\n<!-- COUNCIL_DECISION ${JSON.stringify(decision)} -->\n`;
  fs.writeFileSync(file, body, "utf8");
  return file;
}

// ---------- контекст по дорожке ----------

function buildContext() {
  const common = [
    `### project-brain/09_last_state.md\n${readCapped("project-brain/09_last_state.md", 3500)}`,
    `### project-brain/10_current_task.md\n${readCapped("project-brain/10_current_task.md", 1800)}`,
    `### Последние коммиты\n${git(["log", "--oneline", "-15", `origin/${BASE}`]).stdout}`,
  ];
  if (TRACK === "design") {
    return common.concat([
      `### project-brain/14_design_rules.md\n${readCapped("project-brain/14_design_rules.md", 2500)}`,
      `### project-brain/20_premium_local_identity.md\n${readCapped("project-brain/20_premium_local_identity.md", 2000)}`,
      `### project-brain/21_intro_animation_concept.md\n${readCapped("project-brain/21_intro_animation_concept.md", 1500)}`,
      `### CLAUDE.md (ориентир cinematic hero)\n${readCapped("CLAUDE.md", 2500)}`,
      `### design-learning/05_design_ideas_for_taxi_app.md\n${readCapped("project-brain/design-learning/05_design_ideas_for_taxi_app.md", 1500)}`,
    ]).join("\n\n");
  }
  return common.concat([
    `### TODO.md\n${readCapped("TODO.md", 3000)}`,
    `### project-brain/07_bugs.md\n${readCapped("project-brain/07_bugs.md", 2000)}`,
    `### project-brain/03_mvp_scenario.md\n${readCapped("project-brain/03_mvp_scenario.md", 1800)}`,
  ]).join("\n\n");
}

const TRACK_FOCUS = {
  code: "надёжность, бизнес-логику заказа (статусы, назначение, гонки, идемпотентность), реалтайм, биллинг и качество кода фронтенда. НЕ дизайн.",
  design: "UI/UX, визуал, типографику, цвет, motion/анимации состояний, премиальную локальную айдентику Kinetix (не копировать Uber/Yandex). Ориентир — cinematic product hero из CLAUDE.md.",
};

// ---------- фаза ПЛАН ----------

async function planPhase() {
  git(["fetch", "origin", "--prune"]);
  const ctx = buildContext();
  const recent = recentTitles();
  const avoid = recent.length ? `Недавно уже сделанные/предложенные (НЕ повторять): ${recent.join("; ")}.` : "Истории предложений пока нет.";

  const proposePrompt =
`Ты — Claude, ведущий по архитектуре и дизайну приложения такси Kinetix (Expo+React Native+TypeScript). Идёт совет с Codex по дорожке «${TRACK}». Фокус дорожки: ${TRACK_FOCUS[TRACK]}

Предложи РОВНО 3 небольших улучшения по этой дорожке, каждое реализуемо одним PR. Для каждого: заголовок, зачем для MVP, объём (экраны/файлы), критерии готовности. Конкретно и по реальному проекту. Только текст, файлы не менять.

${avoid}

КОНТЕКСТ:
${ctx}`;
  note("→ Claude: предложения…");
  const ideas = callClaude(proposePrompt);
  log("Раунд 1 — Claude предлагает", ideas);

  const codexPrompt =
`Совет двух агентов по приложению такси Kinetix, дорожка «${TRACK}» (фокус: ${TRACK_FOCUS[TRACK]}). Не сканируй весь проект.

Claude предложил:
---
${ideas}
---

Оцени каждое (ценность для MVP, риск, объём). Выбери РОВНО ОДНО к реализации, либо отклони все, если ничего не готово к безопасному PR. Уточни объём и подводные камни. По-русски, без кода.

В самой последней строке — машинный вердикт строго:
CODEX_VERDICT: PROCEED title="<точный заголовок>"
либо
CODEX_VERDICT: HOLD`;
  note("→ Codex: оценка и выбор…");
  const codexEval = callCodex(codexPrompt);
  log("Раунд 2 — Codex оценивает", codexEval);

  const codexProceed = /CODEX_VERDICT:\s*PROCEED/i.test(codexEval);
  const ctM = codexEval.match(/CODEX_VERDICT:\s*PROCEED\s*title="([^"]+)"/i);
  const codexTitle = ctM ? ctM[1].trim() : "";

  const synthPrompt =
`Совет продолжается, дорожка «${TRACK}». Codex ответил:
---
${codexEval}
---
Codex ${codexProceed ? `за реализацию: "${codexTitle}"` : "против действий сегодня (HOLD)"}.

Прими решение как синтез двух мнений (финальное слово за тобой). Согласие ТОЛЬКО если Codex выбрал PROCEED и ты тоже считаешь фичу безопасной и полезной одним PR.

Кратко обоснуй, затем в самом конце выведи строго:
\`\`\`json
{"consensus": true|false, "title": "<заголовок>", "type": "${TRACK === "design" ? "design" : "feature|reliability"}", "scope": "<что сделать>", "acceptance": ["критерий 1","критерий 2"], "files_hint": ["src/..."], "reason": "<почему>"}
\`\`\``;
  note("→ Claude: синтез…");
  const synth = callClaude(synthPrompt);
  log("Раунд 3 — Claude синтезирует", synth);

  const spec = extractJson(synth);
  const consensus = !!(codexProceed && spec && spec.consensus === true && spec.title);

  const planObj = { date: DATE, track: TRACK, consensus, spec: consensus ? spec : null, createdAt: STAMP };
  fs.writeFileSync(PLAN_FILE, JSON.stringify(planObj, null, 2), "utf8");

  const decision = consensus
    ? { date: DATE, track: TRACK, phase: "plan", consensus: true, title: spec.title }
    : { date: DATE, track: TRACK, phase: "plan", consensus: false, reason: spec ? spec.reason : "no consensus" };
  const file = writeLog(`${DATE}-${TRACK}-plan`, decision);
  note(consensus ? `КОНСЕНСУС: "${spec.title}". План сохранён, ждёт фазы реализации.` : "Консенсуса нет — реализации не будет.");
  note(`Лог: ${file}`);
}

// ---------- фаза РЕАЛИЗАЦИЯ ----------

async function implementPhase() {
  if (!fs.existsSync(PLAN_FILE)) {
    note("Плана нет — нечего реализовывать.");
    writeLog(`${DATE}-${TRACK}-implement`, { date: DATE, track: TRACK, phase: "implement", skipped: "no plan file" });
    return;
  }
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
  if (plan.date !== DATE) {
    note(`План устарел (${plan.date} ≠ ${DATE}) — пропуск.`);
    writeLog(`${DATE}-${TRACK}-implement`, { date: DATE, track: TRACK, phase: "implement", skipped: "stale plan" });
    return;
  }
  if (!plan.consensus || !plan.spec) {
    note("В плане нет консенсуса — реализация не нужна.");
    writeLog(`${DATE}-${TRACK}-implement`, { date: DATE, track: TRACK, phase: "implement", skipped: "no consensus" });
    return;
  }

  const spec = plan.spec;
  note(`Реализую согласованное: "${spec.title}" (${spec.type}).`);
  git(["fetch", "origin", "--prune"]);

  const branch = `ai-council/${DATE}-${TRACK}-${slugify(spec.title)}-${Math.random().toString(36).slice(2, 6)}`;
  const wt = path.join(path.dirname(REPO), `.council-wt-${STAMP}`);

  let pr = null, merged = false, typecheckOk = null, reviewOk = null;
  try {
    const add = git(["worktree", "add", "-b", branch, wt, `origin/${BASE}`]);
    if (add.code !== 0) throw new Error("worktree add: " + add.stderr);
    run("cmd", ["/c", "mklink", "/J", `"${path.join(wt, "node_modules")}"`, `"${path.join(REPO, "node_modules")}"`]);

    const designNote = TRACK === "design"
      ? "Это дизайнерская задача — держи планку премиального UI (app-design-craft, taxi-ui-ux, ориентир cinematic hero из CLAUDE.md)."
      : "Это задача по коду/надёжности — следуй rn-code-quality и taxi-backend-reliability.";
    const implPrompt =
`Реализуй согласованную советом задачу в этом репозитории (ты в изолированном worktree ветки ${branch}). Следуй CLAUDE.md и конвенциям src/. МИНИМАЛЬНОЕ изменение, не ломай typecheck, не трогай несвязанные файлы. НЕ выполняй git-команды (коммит сделает скрипт). ${designNote}

СПЕЦИФИКАЦИЯ:
${JSON.stringify(spec, null, 2)}

После изменений кратко обнови project-brain/09_last_state.md и допиши строку в ${TRACK === "design" ? "project-brain/design-learning/claude_learning_log.txt" : "project-brain/design-learning/claude_learning_log.txt"}. В конце перечисли изменённые файлы.`;
    note("→ Claude: реализация в worktree…");
    const implOut = callClaude(implPrompt, { cwd: wt, timeout: CONFIG.implementTimeoutMs });
    log("Реализация — Claude", implOut);

    git(["add", "-A"], { cwd: wt });
    const stat = git(["diff", "--cached", "--stat"], { cwd: wt }).stdout.trim();
    if (!stat) throw new Error("Claude не внёс изменений");
    log("Изменения", stat);

    gitCommit(
`${spec.type}: ${spec.title}

${spec.scope || ""}

Согласовано советом Claude + Codex (${DATE}, дорожка ${TRACK}).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Co-Authored-By: Codex <noreply@openai.com>`, wt);

    // typecheck
    if (CONFIG.requireTypecheck) {
      note("→ npm run typecheck…");
      let tc = run("npm", ["run", "typecheck"], { cwd: wt, timeout: CONFIG.implementTimeoutMs });
      typecheckOk = tc.code === 0;
      if (!typecheckOk) {
        log("typecheck упал — починка", (tc.stdout + tc.stderr).slice(-3000));
        const fix = callClaude(
          `npm run typecheck падает в этом worktree. Почини МИНИМАЛЬНО, не меняя смысл задачи. Вывод:\n\n${(tc.stdout + tc.stderr).slice(-6000)}`,
          { cwd: wt, timeout: CONFIG.implementTimeoutMs });
        log("Починка typecheck — Claude", fix);
        git(["add", "-A"], { cwd: wt });
        if (git(["diff", "--cached", "--stat"], { cwd: wt }).stdout.trim()) gitCommit("fix: typecheck (AI council)", wt);
        tc = run("npm", ["run", "typecheck"], { cwd: wt, timeout: CONFIG.implementTimeoutMs });
        typecheckOk = tc.code === 0;
      }
      note(`typecheck: ${typecheckOk ? "зелёный ✅" : "красный ❌"}`);
    } else typecheckOk = true;

    // кросс-ревью Codex
    if (CONFIG.requireCodexReview) {
      note("→ Codex: кросс-ревью…");
      const review = callCodex(
`Сделай код-ревью изменений ветки относительно origin/${BASE}. Только реальные блокеры: логические баги, падения, дыры безопасности, сломанные типы. Косметику не считай блокером. Кратко, по-русски.
В самой последней строке строго: REVIEW_VERDICT: OK либо REVIEW_VERDICT: BLOCK`,
        { cwd: wt });
      log("Кросс-ревью — Codex", review);
      reviewOk = !/REVIEW_VERDICT:\s*BLOCK/i.test(review) && /REVIEW_VERDICT:\s*OK/i.test(review);
      note(`ревью Codex: ${reviewOk ? "OK ✅" : "BLOCK ❌"}`);
    } else reviewOk = true;

    if (DRY_RUN) {
      note(`DRY RUN: ветка ${branch} в ${wt}; push/PR/merge пропущены, worktree оставлен.`);
      writeLog(`${DATE}-${TRACK}-implement`, { date: DATE, track: TRACK, phase: "implement", title: spec.title, branch, dryRun: true, typecheckOk, reviewOk });
      try { fs.unlinkSync(PLAN_FILE); } catch {}
      return;
    }

    note("→ git push…");
    const push = git(["push", "-u", "origin", branch], { cwd: wt });
    if (push.code !== 0) throw new Error("push: " + push.stderr.slice(0, 500));

    const token = getGithubToken();
    const gate = typecheckOk && reviewOk;
    const prRes = await gh("POST", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/pulls`, token, {
      title: `[AI council ${DATE} · ${TRACK}] ${spec.title}`,
      head: branch, base: BASE,
      body:
`Согласовано ночным советом **Claude + Codex** (${DATE}, дорожка ${TRACK}).

**Задача:** ${spec.title} (${spec.type})
**Объём:** ${spec.scope || "—"}
**Критерии:**${(spec.acceptance || []).map((a) => `\n- ${a}`).join("")}

**Проверки:** typecheck ${typecheckOk ? "✅" : "❌"}, кросс-ревью Codex ${reviewOk ? "✅" : "❌"}
${gate ? "Все проверки прошли — мерджится автоматически." : "⚠️ Проверки не прошли — оставлен на ручной просмотр."}

Диалог совета: \`${CONFIG.logDir}/${DATE}-${TRACK}-plan.md\`, \`${CONFIG.logDir}/${DATE}-${TRACK}-implement.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)`,
    });
    if (!prRes.ok) throw new Error("PR create: " + prRes.status + " " + prRes.text.slice(0, 400));
    pr = prRes.json.number;
    note(`PR #${pr}: ${prRes.json.html_url}`);

    if (gate && CONFIG.autoMerge) {
      const mr = await gh("PUT", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/pulls/${pr}/merge`, token,
        { merge_method: CONFIG.mergeMethod, commit_title: `${spec.type}: ${spec.title} (#${pr})` });
      merged = mr.ok;
      if (merged) {
        note(`PR #${pr} смерджен в ${BASE} ✅`);
        await gh("DELETE", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/git/refs/heads/${branch}`, token).catch(() => {});
      } else note(`merge не удался (${mr.status}): ${mr.text.slice(0, 300)}. PR оставлен.`);
    } else {
      const reasons = [!typecheckOk && "typecheck красный", !reviewOk && "Codex BLOCK"].filter(Boolean).join(", ");
      await gh("POST", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/issues/${pr}/comments`, token,
        { body: `⚠️ Авто-merge отменён: ${reasons || "проверки не прошли"}. Нужен ручной просмотр.` }).catch(() => {});
      note(`Авто-merge отменён (${reasons}). PR #${pr} ждёт человека.`);
    }

    writeLog(`${DATE}-${TRACK}-implement`, { date: DATE, track: TRACK, phase: "implement", title: spec.title, type: spec.type, branch, pr, merged, typecheckOk, reviewOk });
    try { fs.unlinkSync(PLAN_FILE); } catch {}
  } finally {
    if (!DRY_RUN) safeRemoveWorktree(wt);
  }
}

// ---------- запуск ----------

async function main() {
  if (CONFIG.paused) { console.log("Совет на паузе (config.paused=true)."); return; }
  note(`Старт ${STAMP} — режим: ${MODE}, дорожка: ${TRACK}${DRY_RUN ? " (DRY RUN)" : ""}`);
  if (MODE === "implement") await implementPhase();
  else await planPhase();
}

main().catch((e) => {
  log("ОШИБКА", String(e && e.stack ? e.stack : e));
  try { writeLog(`${DATE}-${TRACK}-${MODE}-error`, { date: DATE, track: TRACK, mode: MODE, error: String(e && e.message ? e.message : e) }); } catch {}
  process.exitCode = 1;
});
