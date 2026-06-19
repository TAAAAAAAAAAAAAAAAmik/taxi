// Печатает контекст для фазы ПЛАН по дорожке. Использование: node ctx.mjs <code|design>
import { git, readCapped, recentTitles, BASE } from "./lib.mjs";

const track = process.argv[2] === "design" ? "design" : "code";
git(["fetch", "origin", "--prune"]);

const common = [
  `### project-brain/09_last_state.md\n${readCapped("project-brain/09_last_state.md", 3500)}`,
  `### project-brain/10_current_task.md\n${readCapped("project-brain/10_current_task.md", 1800)}`,
  `### Последние коммиты origin/${BASE}\n${git(["log", "--oneline", "-15", `origin/${BASE}`]).stdout}`,
];
const byTrack = track === "design"
  ? [
      `### project-brain/14_design_rules.md\n${readCapped("project-brain/14_design_rules.md", 2500)}`,
      `### project-brain/20_premium_local_identity.md\n${readCapped("project-brain/20_premium_local_identity.md", 2000)}`,
      `### project-brain/21_intro_animation_concept.md\n${readCapped("project-brain/21_intro_animation_concept.md", 1500)}`,
      `### CLAUDE.md (ориентир cinematic hero)\n${readCapped("CLAUDE.md", 2500)}`,
      `### design-learning/05_design_ideas_for_taxi_app.md\n${readCapped("project-brain/design-learning/05_design_ideas_for_taxi_app.md", 1500)}`,
    ]
  : [
      `### TODO.md\n${readCapped("TODO.md", 3000)}`,
      `### project-brain/07_bugs.md\n${readCapped("project-brain/07_bugs.md", 2000)}`,
      `### project-brain/03_mvp_scenario.md\n${readCapped("project-brain/03_mvp_scenario.md", 1800)}`,
    ];

const recent = recentTitles();
console.log(`# Контекст совета — дорожка ${track} — ${new Date().toLocaleString("ru-RU")}\n`);
console.log(`НЕ повторять недавно сделанное/предложенное: ${recent.length ? recent.join("; ") : "(истории нет)"}\n`);
console.log(common.concat(byTrack).join("\n\n"));
