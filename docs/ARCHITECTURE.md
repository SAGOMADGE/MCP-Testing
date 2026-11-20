# Архитектура доставки

`ChatGPT / Codex → HTTPS Streamable HTTP → существующий Skybridge на Alpic → Supabase`.
`get-products` связан с React view `products`; MCP Apps хост получает HTML/JS
с сервера. Skill устанавливается из пакета. Серверное `skills: true` сохранено,
но не заменяет установленный Skill.

```text
shopping-cart/
  plugin.json
  mcp.json
  .codex-plugin/plugin.json
  .mcp.json
  skills/shopping-assistant/SKILL.md
```

Основной формат — Agent Plugins 1.0. `mcp.json`: `streamable-http`, URL Alpic,
без credentials и необязательного auth extension. Codex overlay: `./skills/`, `./.mcp.json`,
совместимый транспорт `http`. Дубликаты генерируются и сверяются. Не предполагается
слияние форматов. Marketplace не находится внутри plugin ZIP.

Эксперимент с Codex 0.169.0-alpha.11.1 выявил: поле `extensions` внутри сервера
в переносимом mcp.json отвергается (`unknown field extensions`), хотя описано
документацией OpenAI. Для этого публичного no-auth endpoint оно не требуется.
Оставлена минимальная конфигурация type + url; compatibility overlay сохранён.

Рабочий TEST 1.0.1 прочитан через Plugin Creator: Skill и привязка к приложению
автора подтверждены. Локальный `.app.json` относится к другому прежнему экземпляру.
Обе привязки не являются универсальным адресом сервера. Пользовательская правка
сохранена, ссылки на неё и сами ID исключены из поставки.

Импорт `mcp.json` не доказывает активацию MCP в ChatGPT. Поэтому есть маршрут ZIP
и дополнительная регистрация в аккаунте получателя с добавлением Skill в тот же
плагин. Результат проверяется фактическими вызовами. Публичной публикации нет.

## Ограничения демо

- Один серверный `DEMO_CART_ID`, без OAuth и изоляции пользователей.
- Add использует read + upsert; одновременные добавления разных клиентов не
  гарантируют атомарное суммирование. Промышленное решение потребует SQL/RPC;
  схема БД и данные в этой работе не менялись.
- Нет оплаты и checkout. Scenario Modeler только сравнивает варианты в React.
- Claude вне приёмки; ресурс MCP Apps есть, фактический запуск не проверен.

## Источники, проверенные 19 ноября 2026

- [OpenAI: упаковка и marketplace](https://developers.openai.com/plugins/build/plugins)
- [OpenAI: custom MCP](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [OpenAI: подключение и тесты](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [OpenAI: личная регистрация](https://developers.openai.com/plugins/quickstart)
- [OpenAI Help: ZIP и права](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt)
- [ChatGPT Learn: клиенты](https://learn.chatgpt.com/docs/plugins)
- [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps)
- [Skybridge: chatgpt-app-builder](https://github.com/alpic-ai/skybridge/blob/main/skills/chatgpt-app-builder/SKILL.md)
- [Skybridge: tools/views](https://github.com/alpic-ai/skybridge/blob/main/skills/chatgpt-app-builder/references/fetch-and-render-data.md)

Также использованы установленные инструкции Plugin Creator `plugin-packages.md`,
`zip-requirements.md`, `account-updates.md` и исходники Skybridge 2.1.0/MCP SDK 2.4.0.
При расхождении примеров ID в документации используется фактически прочитанная
привязка аккаунта, без ручного преобразования префиксов.
