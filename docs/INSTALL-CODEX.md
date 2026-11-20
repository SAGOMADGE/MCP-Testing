# Установка в Codex

## Полноценный плагин

Используйте актуальный Codex CLI или Codex в настольном ChatGPT.
Команды сверены с CLI `0.169.0-alpha.11.1`; проверьте `codex plugin --help`.

1. Распакуйте handoff ZIP в постоянную папку. Не удаляйте её после установки.
2. Из папки с `codex-marketplace` выполните:

   ```sh
   codex plugin marketplace add ./codex-marketplace
   codex plugin list --available --marketplace shopping-cart-local
   codex plugin add shopping-cart@shopping-cart-local
   ```

3. Начните новую сессию. CLI: `/plugins` для плагина, `/mcp` для соединения.
   В настольном клиенте перезапустите приложение, откройте Plugins, источник
   **Shopping Cart Local**, установите/включите **Shopping Cart MCP**, если требуется.
4. Выполните четыре запроса чтения из `INSTALL-CHATGPT.md`. Skill должен читаться
   из установленного пакета, а не из исходников проекта.

Это плагин с MCP и Skill. Он обращается прямо к Alpic; App ID автора, Supabase-ключи,
Node-сервер или `npm install` у Нугзара не нужны. **Терминальный CLI не обещает React**:
UI зависит от поддержки MCP Apps конкретным графическим клиентом.

Репозиторий тоже содержит `.agents/plugins/marketplace.json`: после получения
обновлённой ветки можно зарегистрировать его корень через
`codex plugin marketplace add .`. Не подключайте несколько копий одного marketplace.
Для установки из GitHub используйте ветку `delivery/nugzar-portable-plugin`
репозитория `SAGOMADGE/MCP-Testing`; `main` не содержит эту сдачу.
[Формат и marketplace](https://developers.openai.com/plugins/build/plugins).

## Резерв: отдельные MCP + Skill

Для клиента без установки плагинов (например, IDE extension согласно текущей
документации) это минимальный обход, **не полноценная установка плагина**.
[Поддерживаемые клиенты](https://learn.chatgpt.com/docs/plugins).

```sh
codex mcp add shopping-cart --url https://mcp-testing-5679d679.alpic.live/mcp
codex mcp get shopping-cart
```

Или добавьте секцию `fallback/codex-mcp.toml` в `~/.codex/config.toml`, сохранив
остальные настройки. Не добавляйте ручное соединение поверх уже включённого
плагина. [Настройка MCP](https://developers.openai.com/codex/mcp).

Скопируйте папку `shopping-assistant` из
`codex-marketplace/plugins/shopping-cart/skills/` в `~/.agents/skills/`.
Итог: `~/.agents/skills/shopping-assistant/SKILL.md`. Для одного проекта используйте
`<project>/.agents/skills/shopping-assistant/SKILL.md`. При совпадении имени сравните
файлы перед заменой. Перезапустите сессию и вызовите `$shopping-assistant`.

## Диагностика

- Плагин не найден: `codex plugin marketplace list`, путь к распакованной папке,
  скрытый `.agents/plugins/marketplace.json`.
- Skill есть, tools нет: `/mcp`, доступ по HTTPS, ошибки соединения, дубликаты.
- Tools есть, React нет: проверьте возможности графического клиента.
- Обновление: замените исходную папку, используйте доступный reinstall/update,
  затем новую сессию. Не редактируйте installed cache вручную.
