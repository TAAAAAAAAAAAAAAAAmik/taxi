// Готовит изолированный worktree от origin/<base> для фазы РЕАЛИЗАЦИИ.
// Использование: node wt-create.mjs <code|design>
// Печатает JSON {worktree, branch} и пишет маркер .council-active-<track>.json
import fs from "node:fs";
import path from "node:path";
import { git, linkNodeModules, REPO, BASE, OUT, planFile, activeFile, todayDate, stamp } from "./lib.mjs";

const track = process.argv[2] === "design" ? "design" : "code";

// проверяем план
const pf = planFile(track);
if (!fs.existsSync(pf)) { console.error(`Нет плана ${pf}`); process.exit(3); }
const plan = JSON.parse(fs.readFileSync(pf, "utf8"));
if (plan.date !== todayDate()) { console.error(`План устарел (${plan.date})`); process.exit(4); }
if (!plan.consensus || !plan.spec) { console.error("В плане нет консенсуса"); process.exit(5); }

git(["fetch", "origin", "--prune"]);
const slug = (plan.spec.title || track).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || track;
const branch = `ai-council/${todayDate()}-${track}-${slug}-${Math.random().toString(36).slice(2, 6)}`;
const wt = path.join(OUT, `.council-wt-${track}-${stamp()}`);

const add = git(["worktree", "add", "-b", branch, wt, `origin/${BASE}`]);
if (add.code !== 0) { console.error("worktree add: " + add.stderr); process.exit(1); }
// junction node_modules для typecheck (родными средствами Node, без admin)
linkNodeModules(wt);

fs.writeFileSync(activeFile(track), JSON.stringify({ worktree: wt, branch, track, date: todayDate() }, null, 2), "utf8");
console.log(JSON.stringify({ worktree: wt, branch, spec: plan.spec }, null, 2));
