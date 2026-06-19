// Общие помощники для скриптов ночного совета (режим «открытый Claude Code»).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
export const REPO = CONFIG.repoDir;
export const BASE = CONFIG.baseBranch;
export const OUT = path.dirname(REPO); // куда кладём план/маркер (вне репозитория)

export function todayDate() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}
export function stamp() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${todayDate()}_${p(n.getHours())}-${p(n.getMinutes())}-${p(n.getSeconds())}`;
}

export function run(cmd, args, { input, cwd = REPO, timeout = CONFIG.callTimeoutMs } = {}) {
  const r = spawnSync(cmd, args, { cwd, input, timeout, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  return {
    code: r.status === null ? -1 : r.status,
    stdout: (r.stdout || "").toString(),
    stderr: (r.stderr || "").toString(),
    timedOut: r.error && r.error.code === "ETIMEDOUT",
  };
}
export function git(args, opts = {}) {
  return run("git", ["-C", opts.cwd || REPO, ...args], { ...opts, cwd: opts.cwd || REPO });
}
export function gitCommit(message, cwd) {
  const f = path.join(__dirname, `.commitmsg-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(f, message, "utf8");
  const r = git(["commit", "-F", f], { cwd });
  try { fs.unlinkSync(f); } catch {}
  return r;
}
export function readCapped(rel, max = 3000) {
  try {
    const txt = fs.readFileSync(path.join(REPO, rel), "utf8");
    return txt.length > max ? txt.slice(0, max) + "\n…(обрезано)…" : txt;
  } catch { return ""; }
}

export function planFile(track) { return path.join(OUT, `.council-plan-${track}.json`); }
export function activeFile(track) { return path.join(OUT, `.council-active-${track}.json`); }

export function writeLog(name, transcript, decision) {
  const dir = path.join(REPO, CONFIG.logDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.md`);
  let body = `# Совет Claude + Codex — ${name}\n\n${transcript}\n`;
  if (decision) body += `\n<!-- COUNCIL_DECISION ${JSON.stringify(decision)} -->\n`;
  fs.writeFileSync(file, body, "utf8");
  return file;
}

export function recentTitles() {
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

export function getGithubToken() {
  const r = git(["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n" });
  const p = r.stdout.match(/^password=(.*)$/m);
  if (!p) throw new Error("GitHub-токен не найден в credential store");
  return p[1].trim();
}
export async function gh(method, endpoint, token, body) {
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

// Создать junction node_modules внутри worktree (родными средствами Node, без cmd).
export function linkNodeModules(wtPath) {
  const link = path.join(wtPath, "node_modules");
  const target = path.join(REPO, "node_modules");
  try { if (fs.existsSync(link)) return; } catch {}
  fs.symlinkSync(target, link, "junction");
}

// Безопасно убрать worktree: сначала снять junction node_modules (rmdir удаляет ТОЛЬКО ссылку,
// реальный node_modules остаётся), и лишь потом удалять сам worktree.
export function safeRemoveWorktree(wtPath) {
  if (!wtPath) return;
  const nm = path.join(wtPath, "node_modules");
  try { if (fs.existsSync(nm) && fs.lstatSync(nm).isSymbolicLink()) fs.rmdirSync(nm); } catch {}
  git(["worktree", "remove", "--force", wtPath]);
  try {
    if (fs.existsSync(wtPath)) {
      const linkStill = fs.existsSync(nm) && fs.lstatSync(nm).isSymbolicLink();
      if (!linkStill) fs.rmSync(wtPath, { recursive: true, force: true });
    }
  } catch {}
  git(["worktree", "prune"]);
}
