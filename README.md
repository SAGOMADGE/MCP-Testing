# Shopping Cart MCP

Shopping Cart MCP App для Нугзара: Skybridge 2, React, TypeScript, Supabase.
Один удалённый сервер обслуживает ChatGPT и совместимые MCP-клиенты.

**Начните с [короткой инструкции для Нугзара](docs/README-NUGZAR.md).**

- [Установка в ChatGPT](docs/INSTALL-CHATGPT.md)
- [Установка в Codex и резервное подключение](docs/INSTALL-CODEX.md)
- [Архитектура и официальные источники](docs/ARCHITECTURE.md)
- [Фактические проверки](docs/VALIDATION.md)
- [Передача исходников и обновление Alpic](docs/RELEASE.md)

MCP: https://mcp-testing-5679d679.alpic.live/mcp

Playground: https://mcp-testing-5679d679.alpic.live/try

Компьютер разработчика и локальный dev-сервер для использования не нужны.
Нужны доступность существующего Alpic deployment, Supabase и интернет.
Корзина общая для всех пользователей; оплаты, checkout и изоляции пользователей нет.

## Разработка

Node.js 24+, `npm ci`. В PowerShell при блокировке `npm.ps1` используйте `npm.cmd`.
Для запуска сервера создайте `.env` с `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`DEMO_CART_ID` из существующего окружения. Не включайте значения в плагин или Git.

```sh
npm run build
npm run typecheck
npm test
npm run build:check
npm run plugin:check
npm run test:remote
npm run package:delivery
# Optional: requires an installed Codex CLI
npm run test:codex
```

`test` не использует `.env`, сеть или платные API: Supabase заменён моделью в памяти.
Всего 14 тестов; 3 React-теста проверяют загрузку добавления по `productId`,
конкурентные запросы, повторные клики и восстановление кнопок после ошибок.
На чистой копии build сначала генерирует типы `.skybridge/views.d.ts` для typecheck.
`test:remote` вызывает только инструменты чтения и читает React-ресурс.
`evals` — отдельная проверка платной моделью, требует `RUN_MODEL_EVALS=1` и
`ANTHROPIC_API_KEY`; записи блокируются middleware. Она не входит в обычные тесты.

`plugin:sync` обновляет Codex-манифесты и копию оригинального Skill из
`src/skills/shopping-assistant/SKILL.md`. `plugin:check` выявляет рассинхронизацию.

## Поставка

`package:delivery` создаёт в `artifacts/`:

- `shopping-cart-1.0.2.zip` — один переносимый плагин, пять файлов;
- `shopping-cart-handoff-1.0.2.zip` — документация, плагин, отдельный Skill ZIP,
  Codex marketplace и резервный TOML;
- `shopping-cart-source-1.0.2.zip` — исходники без секретов и персональной привязки;
- `SHA256SUMS.txt` и `package-report.json`.

Передайте Нугзару handoff ZIP. Для импорта как плагина выбирайте вложенный
shopping-cart ZIP, а не весь комплект. React загружается с Alpic.
Существующий локально изменённый `.app.json` сохранён, но больше не используется
переносимым manifest и исключён из архивов. Личный TEST 1.0.1 не изменялся.
