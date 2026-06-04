# Инструкция для Codex

## Проект

Это мобильное приложение локального такси и доставки.

Название проекта:
- текущее: Такси Партнер
- рабочий бренд: Kinetix

Проект уже начат. Нельзя создавать новый проект с нуля.

## Главная идея

Клиент создает заказ.
Водитель видит заказ.
Водитель принимает заказ.
Статус заказа меняется.
Заказ завершается.

Главная бизнес-модель:
- водитель может платить подписку;
- либо работать по проценту с заказа.

## Что обязательно читать перед работой

Перед любыми изменениями Codex должен прочитать:

- README.md
- AGENTS.md
- TODO.md
- DEVELOPMENT_PLAN.md
- project-brain/00_main.md
- project-brain/01_project_idea.md
- project-brain/02_roles.md
- project-brain/03_mvp_scenario.md
- project-brain/04_monetization.md
- project-brain/05_tech_map.md
- project-brain/06_project_decisions.md
- project-brain/07_bugs.md
- project-brain/08_codex_prompts.md

## Главные правила

- Не переписывать проект с нуля.
- Не удалять рабочие экраны без объяснения.
- Делать изменения маленькими шагами.
- Сначала анализировать, потом менять код.
- После изменений объяснять, какие файлы изменены.
- Не подключать реальные платежи до стабильного MVP.
- Не подключать сложные карты до стабильного MVP.
- Не ломать сборку.
- Интерфейс должен быть удобным для телефона.
- Текст должен быть читабельным.

## Главный приоритет

Сначала довести главный MVP-сценарий:

клиент создает заказ → водитель видит заказ → водитель принимает заказ → статус меняется → заказ завершается.

Потом уже:
1. дизайн;
2. кабинет водителя;
3. админка;
4. монетизация;
5. сервер;
6. APK;
7. запуск.

---

## Language and communication rules

- Always communicate with the user in Russian.
- All explanations, plans, summaries, and questions must be in Russian.
- If the prompt is written in English, still answer in Russian.
- Keep technical names, file names, commands, code identifiers, and error messages in their original language.
- Do not switch to English unless the user explicitly asks for it.

---

## равила экономии лимитов Codex

- е читать всю папку project-brain без необходимости.
- ля обычной задачи сначала читать:
  - AGENTS.md
  - TODO.md
  - DEVELOPMENT_PLAN.md
  - project-brain/09_last_state.md
  - project-brain/10_current_task.md
- стальные файлы project-brain читать только если они нужны для задачи.
- сли задача про MVP, читать project-brain/03_mvp_scenario.md.
- сли задача про монетизацию, читать project-brain/04_monetization.md.
- сли задача про роли, читать project-brain/02_roles.md.
- сли задача про баги, читать project-brain/07_bugs.md.
- елать одну маленькую задачу за раз.
- е анализировать весь проект повторно, если достаточно прочитать последнее состояние.
- осле выполненной задачи предложить обновление project-brain/09_last_state.md.

---

## Премиальная локальность

Проект должен иметь собственную изюминку, но она не должна быть колхозной.

Codex должен делать приложение как современный локальный сервис, а не как дешевую копию такси-приложения.

Если задача касается дизайна, интерфейса, текстов или позиционирования, учитывать:

- project-brain/20_premium_local_identity.md

Главное правило:
локальность показывать через удобство, маршруты, доверие и честные условия, а не через деревенские клише.
