// Финал фазы РЕАЛИЗАЦИИ: коммит -> typecheck -> кросс-ревью Codex -> push -> PR -> авто-merge -> очистка.
// Перед вызовом Claude должен сам сделать правки в worktree и добиться зелёного typecheck.
// Использование: node wt-finish.mjs <code|design> [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG, BASE, git, gitCommit, run, getGithubToken, gh, safeRemoveWorktree,
  planFile, activeFile, writeLog, todayDate,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const track = process.argv[2] === "design" ? "design" : "code";
const DRY = CONFIG.dryRun || process.argv.includes("--dry-run");
const T = [];
const note = (s) => { T.push(s); console.log(s); };

const af = activeFile(track);
const pf = planFile(track);
if (!fs.existsSync(af)) { console.error(`Нет активного worktree (${af})`); process.exit(3); }
const active = JSON.parse(fs.readFileSync(af, "utf8"));
const plan = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : { spec: { title: "(без плана)", type: track, scope: "", acceptance: [] } };
const spec = plan.spec || {};
const wt = active.worktree;
const branch = active.branch;

let pr = null, merged = false, typecheckOk = null, reviewOk = null;
(async () => {
  try {
    git(["add", "-A"], { cwd: wt });
    const stat = git(["diff", "--cached", "--stat"], { cwd: wt }).stdout.trim();
    if (!stat) throw new Error("В worktree нет изменений — нечего коммитить");
    note("### Изменения\n" + stat);

    gitCommit(
`${spec.type || track}: ${spec.title || "AI council"}

${spec.scope || ""}

Согласовано советом Claude + Codex (${todayDate()}, дорожка ${track}).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Co-Authored-By: Codex <noreply@openai.com>`, wt);

    // typecheck (авторитетная проверка)
    if (CONFIG.requireTypecheck) {
      note("→ npm run typecheck…");
      const tc = run("npm", ["run", "typecheck"], { cwd: wt, timeout: CONFIG.implementTimeoutMs });
      typecheckOk = tc.code === 0;
      if (!typecheckOk) note("typecheck КРАСНЫЙ:\n" + (tc.stdout + tc.stderr).slice(-2500));
      note(`typecheck: ${typecheckOk ? "зелёный ✅" : "красный ❌"}`);
    } else typecheckOk = true;

    // кросс-ревью Codex в worktree
    if (CONFIG.requireCodexReview) {
      note("→ Codex: кросс-ревью…");
      const outFile = path.join(__dirname, `.codex-rev-${Date.now()}.txt`);
      const rv = run("codex", ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "-o", outFile], {
        cwd: wt,
        input: `Сделай код-ревью изменений этой ветки относительно origin/${BASE}. Только реальные блокеры: логические баги, падения, дыры безопасности, сломанные типы. Косметику не считай блокером. Кратко, по-русски.\nВ самой последней строке строго: REVIEW_VERDICT: OK либо REVIEW_VERDICT: BLOCK`,
      });
      let review = ""; try { review = fs.readFileSync(outFile, "utf8"); fs.unlinkSync(outFile); } catch { review = rv.stdout; }
      note("### Ревью Codex\n" + review.trim());
      reviewOk = !/REVIEW_VERDICT:\s*BLOCK/i.test(review) && /REVIEW_VERDICT:\s*OK/i.test(review);
      note(`ревью Codex: ${reviewOk ? "OK ✅" : "BLOCK ❌"}`);
    } else reviewOk = true;

    const gate = typecheckOk && reviewOk;

    if (DRY) {
      note(`DRY RUN: ветка ${branch}, push/PR/merge пропущены. Worktree оставлен: ${wt}`);
      writeLog(`${todayDate()}-${track}-implement`, T.join("\n\n"), { date: todayDate(), track, phase: "implement", title: spec.title, branch, dryRun: true, typecheckOk, reviewOk });
      return;
    }

    note("→ git push…");
    const push = git(["push", "-u", "origin", branch], { cwd: wt });
    if (push.code !== 0) throw new Error("push: " + push.stderr.slice(0, 400));

    const token = getGithubToken();
    const prRes = await gh("POST", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/pulls`, token, {
      title: `[AI council ${todayDate()} · ${track}] ${spec.title || "improvement"}`,
      head: branch, base: BASE,
      body:
`Согласовано ночным советом **Claude + Codex** (${todayDate()}, дорожка ${track}).

**Задача:** ${spec.title || "—"} (${spec.type || track})
**Объём:** ${spec.scope || "—"}
**Критерии:**${(spec.acceptance || []).map((a) => `\n- ${a}`).join("") || " —"}

**Проверки:** typecheck ${typecheckOk ? "✅" : "❌"}, кросс-ревью Codex ${reviewOk ? "✅" : "❌"}
${gate ? "Все проверки прошли — мерджится автоматически." : "⚠️ Проверки не прошли — оставлен на ручной просмотр."}

🤖 Generated with [Claude Code](https://claude.com/claude-code)`,
    });
    if (!prRes.ok) throw new Error("PR create: " + prRes.status + " " + prRes.text.slice(0, 300));
    pr = prRes.json.number;
    note(`PR #${pr}: ${prRes.json.html_url}`);

    if (gate && CONFIG.autoMerge) {
      const mr = await gh("PUT", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/pulls/${pr}/merge`, token,
        { merge_method: CONFIG.mergeMethod, commit_title: `${spec.type || track}: ${spec.title} (#${pr})` });
      merged = mr.ok;
      if (merged) {
        note(`PR #${pr} смерджен в ${BASE} ✅`);
        await gh("DELETE", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/git/refs/heads/${branch}`, token).catch(() => {});
      } else note(`merge не удался (${mr.status}): ${mr.text.slice(0, 200)}. PR оставлен.`);
    } else {
      const reasons = [!typecheckOk && "typecheck красный", !reviewOk && "Codex BLOCK"].filter(Boolean).join(", ");
      await gh("POST", `/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/issues/${pr}/comments`, token,
        { body: `⚠️ Авто-merge отменён: ${reasons || "проверки не прошли"}. Нужен ручной просмотр.` }).catch(() => {});
      note(`Авто-merge отменён (${reasons}). PR #${pr} ждёт человека.`);
    }

    writeLog(`${todayDate()}-${track}-implement`, T.join("\n\n"), { date: todayDate(), track, phase: "implement", title: spec.title, type: spec.type, branch, pr, merged, typecheckOk, reviewOk });
  } catch (e) {
    note("ОШИБКА: " + (e && e.message ? e.message : e));
    writeLog(`${todayDate()}-${track}-implement-error`, T.join("\n\n"), { date: todayDate(), track, phase: "implement", error: String(e && e.message ? e.message : e) });
    process.exitCode = 1;
  } finally {
    if (!DRY) {
      safeRemoveWorktree(wt);
      try { fs.unlinkSync(af); } catch {}
      try { fs.unlinkSync(pf); } catch {}
    }
    console.log(`\n[RESULT] track=${track} pr=${pr} merged=${merged} typecheck=${typecheckOk} review=${reviewOk}`);
  }
})();
