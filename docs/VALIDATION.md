# Отчёт о проверках

Проверки выполнены 19–20 ноября 2026, Europe/Moscow.

Повторная проверка для независимого ревью 20 ноября: 11/11 тестов и обе
TypeScript-проверки прошли в отдельной копии исходников. Production-сборка
прошла после повтора вне ограничений песочницы: первый запуск завершился
ошибкой файлового доступа esbuild на этапе Vercel packaging. Оба лога
сохранены в переданном отдельно `codex-review.zip`. Проверки манифестов,
Skill и шести клиентских assets также прошли. Реальный `.env` не использовался;
сборка получила фиктивные значения, тесты использовали mock Supabase.
Перед финальной сдачей менялись только исключения Git и сведения в документации;
прикладные исходники сохранены из проверенного снимка.

| Проверка | Результат |
|---|---|
| TypeScript приложения, тестов и eval | PASS — `npm run typecheck` |
| MCP contract tests | PASS — все 6 tools, add/increment/update/remove в памяти, неверные количества, отсутствующие записи, ошибки backend |
| Scenario Modeler | PASS — суммы, пустой выбор, каталог не изменяется |
| Автономные тесты | PASS — 11, сеть и реальный Supabase запрещены |
| Production build | PASS — финальный `npm run build`, Node 24.22.2, Skybridge 2.1.0 |
| Клиентский bundle | PASS — entry/manifest и 6 файлов assets; server-only config и фактический Supabase key отсутствуют |
| Manifests и Skill | PASS — plugin:check, оригинальный Skill сохранён |
| ZIP | PASS — allowlist из 5 файлов, повторная распаковка и побайтовая сверка, скрытые manifests включены |
| Переносимость | PASS — App ID, .app.json, .env и node_modules исключены |
| Чистая установка в Codex | PASS — marketplace add, plugin add/list, enabled=true в отдельном профиле |
| Skill в Codex | PASS — runtime skills/list и побайтовая сверка файла из installed cache |
| MCP в Codex | PASS — все 6 tools обнаружены runtime Codex |
| Вызов в Codex | PASS — get-products через app-server, 20 товаров, без model inference |
| Установка ZIP на втором аккаунте | НЕ ПРОВЕРЕНО в этой сессии |
| Production initialize + tools/list | PASS — ровно 6 инструментов |
| Production get-products | PASS — 20 товаров; также вызван через TEST |
| Production get-product-details | PASS — ID из каталога, 3 связанных товара |
| Production get-cart | PASS — только чтение |
| MCP Apps resource | PASS — text/html;profile=mcp-app, CSP и удалённый JS |
| React визуально в этой сессии | НЕ ПРОВЕРЕНО: Computer Use остановлен, URL Chrome не определён надёжно |
| React и Skill в ChatGPT автора ранее | Подтверждены исходным отчётом пользователя |
| Skill установленного TEST | PASS — прочитан через Plugin Creator и installed cache без read_skill |
| Production add/update/remove | НЕ ВЫПОЛНЯЛИСЬ, корзину изменять запрещено |
| Платный model eval | НЕ ЗАПУСКАЛСЯ; прежний start eval заменён catalog eval |
| Mobile и Claude | НЕ ПРОВЕРЕНО |

Прямая проверка: `npm run test:remote`, результат `artifacts/remote-check.json`.
Отчёт не содержит Supabase-ключей или содержимого корзины.

Codex: `0.169.0-alpha.11.1`. Проверка запускалась скриптом `scripts/check-codex.mjs`
в отдельной папке `.delivery-work/`; реальные настройки и аккаунт пользователя не
изменялись. Для повтора после package:delivery используйте `npm run test:codex`
или `node scripts/check-codex.mjs <полный путь к codex.exe>`.
Это проверка установки/runtime, не тест выбора инструментов языковой моделью.

Первый эксперимент выявил отказ Codex читать необязательное поле `extensions`
в переносимом `mcp.json`. Поле удалено: endpoint не требует аутентификации.
После исправления повторная чистая установка и вызов прошли. Запись ошибки доступа
Windows при одной установке cache не воспроизвелась в последующих чистых профилях.

## Зависимости

Совместимо обновлены `hono` 4.13.14 → 4.13.19 и `@hono/node-server` 2.1.5 → 2.1.9.
`npm audit --omit=dev`: 0 high, 0 critical, 4 moderate в цепочке
`minimatch` → `@oclif/core`/`nodemon`/`skybridge`. Это не четыре независимых
дефекта приложения. Принудительный fix предлагает несовместимую замену Skybridge;
он не применялся. Отчёт не означает отсутствие всех уязвимостей.

Машинные результаты: `artifacts/codex-check.json`, `artifacts/remote-check.json`,
`artifacts/audit-production.json`; краткая версия включена в `evidence/acceptance.json`.

Получателю: выполнить запросы и действия чтения из INSTALL-CHATGPT.md и
INSTALL-CODEX.md. Отдельно подтвердить импорт, установку, MCP connection,
фактический tool call, чтение installed Skill и render React.
«Не проверено» означает отсутствие подтверждения, а не доказанную неисправность.
