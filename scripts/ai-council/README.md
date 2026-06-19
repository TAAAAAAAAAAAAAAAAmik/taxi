# Ночной совет Claude + Codex

Автоматический ежедневный «совет» двух ИИ: они обсуждают, что улучшить в приложении Kinetix, и при согласии сами реализуют это (ветка → PR → авто-merge).

## Почему так устроено

Прямой headless-вход `claude` в этом регионе недоступен: `claude.ai` отдаёт **403**, поэтому `claude setup-token` не проходит. Но `api.anthropic.com` доступен, и **открытое приложение Claude Code уже авторизовано** (хост обновляет OAuth). Поэтому совет работает не через отдельный headless-процесс, а через **внутренний планировщик Claude Code**: в нужный час просыпается уже авторизованный Claude, через `codex exec` советуется с Codex и сам вносит правки.

➡️ **Условие: в часы запуска приложение Claude Code должно быть открыто.** Если закрыто — задача выполнится при следующем запуске.

## Расписание (локальное время Екб = МСК+2)

| Задача (планировщик Claude Code) | Екб | МСК | Что делает |
|---|---|---|---|
| `council-plan-code` | 02:01 | 00:01 | план по коду |
| `council-implement-code` | 04:03 | 02:03 | реализация кода |
| `council-plan-design` | 10:03 | 08:03 | план по дизайну |
| `council-implement-design` | 12:06 | 10:06 | реализация дизайна |

Управление — в боковой панели **«Scheduled»** (включить/выключить/Run now). Промпты задач: `C:\Users\TamikFutboler\.claude\scheduled-tasks\<id>\SKILL.md`.

## Поток

1. **План:** `ctx.mjs` собирает контекст → Claude предлагает 3 идеи → `ask-codex.mjs` спрашивает Codex (PROCEED/HOLD) → синтез → `save-plan.mjs` пишет `..\.council-plan-<track>.json` и лог.
2. **Реализация (через 2 ч):** `wt-create.mjs` делает изолированный git-worktree от `origin/main` (+ junction `node_modules`) → Claude правит код в worktree, гонит typecheck до зелёного → `wt-finish.mjs` коммитит, делает авторитетный typecheck, кросс-ревью Codex, push, PR и **авто-merge только если typecheck зелёный и Codex без блокеров**; иначе PR остаётся открытым с пометкой.

Логи: `project-brain/ai-council/<дата>-<track>-<phase>.md`.

## Скрипты

- `lib.mjs` — общие помощники (git, github API, worktree, junction).
- `ctx.mjs <code|design>` — контекст для фазы плана.
- `ask-codex.mjs <msgfile>` — спросить Codex (read-only).
- `save-plan.mjs <track> <decision.json> <log.md>` — сохранить план + лог.
- `wt-create.mjs <track>` — создать worktree под реализацию.
- `wt-finish.mjs <track> [--dry-run]` — коммит → проверки → PR → merge → очистка.
- `config.json` — настройки.
- `council.mjs` — **альтернативный** полностью headless-режим (нужен `ANTHROPIC_API_KEY` или `CLAUDE_CODE_OAUTH_TOKEN`; работает даже с закрытым приложением через Планировщик Windows). Сейчас НЕ используется.

## Настройки (`config.json`)

- `dryRun: true` — обсуждать и готовить ветку, но **не пушить/не мерджить** (мягкий стоп для кода).
- `autoMerge` — авто-merge при зелёных проверках.
- `requireTypecheck`, `requireCodexReview` — гейты перед merge.
- `mergeMethod` — `squash` | `merge` | `rebase`.
- `claudeModel`, `codexModel` — переопределить модели (для headless-режима).

## Как поставить на паузу

- Быстро: выключить задачи в панели **«Scheduled»**.
- Мягко: `dryRun: true` в `config.json` (советы идут, код не уезжает).

## Откат плохого merge

`git revert <sha>` или откатить PR в GitHub. Каждая правка идёт отдельным PR с логом совета.
