# Передача и развёртывание

Ветка сдачи: `delivery/nugzar-portable-plugin`:
https://github.com/SAGOMADGE/MCP-Testing/tree/delivery/nugzar-portable-plugin
`main` не изменяется; Deploy на Alpic и публикация в каталоге не выполняются.

Передайте `shopping-cart-handoff-1.0.2.zip` и `SHA256SUMS.txt`. Упаковка обращается
к уже существующему endpoint, сама по себе не требует redeploy.
Исходники — `shopping-cart-source-1.0.2.zip`.

Проверка суммы в PowerShell:

```powershell
Get-FileHash .\shopping-cart-handoff-1.0.2.zip -Algorithm SHA256
```

## Обновить существующий deployment после проверки diff

Следующие шаги относятся к будущему развёртыванию и требуют отдельного решения.

1. Просмотрите изменения ветки и `VALIDATION.md`. Персональный `.app.json`
   исключён из отслеживаемых файлов; локальная копия сохранена и игнорируется Git.
2. После разрешения на слияние создайте PR из ветки сдачи в `main`.
3. После слияния откройте существующий Alpic проект: ветка `main`, Root Directory
   `./`, Node.js 24, build `npm run build`, Streamable HTTP. Новый проект не нужен.
4. Если автодеплой не сработал, redeploy существующего проекта из нового коммита.
   Сохраните серверные `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DEMO_CART_ID`.
   Не копируйте значения ключей в чат или plugin ZIP.
5. После Deployed: `npm run test:remote`, Playground, затем **Refresh** MCP в
   ChatGPT и новый чат. [Официальный refresh](https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata).

Новые descriptions/annotations и сообщения React появятся в production после
этого deploy. Удалённые проверки сдачи относятся к прежнему рабочему deployment.

Записи live не проверялись: нужен отдельно разрешённый сценарий и тестовая
корзина/окружение. Не запускайте add/update/remove на общей корзине ради теста.
Данные и схема Supabase в этой работе не изменялись.
