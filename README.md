# Jivo-like Multichannel Chat (Supabase MVP+)

Проект доведен до расширенного MVP с критичными блоками: auth операторов, единый inbox, операторские ответы в каналы, realtime-обновления в виджете и панели.

## Что теперь реализовано

### 1) Критичное для прод
- ✅ Авторизация операторов через **Supabase Auth** (`operator.html` + `operator.js`, `signInWithPassword`).
- ✅ Роли `admin/operator` проверяются перед доступом к dashboard.
- ✅ Сообщения строго привязаны к `conversation_id` + `user_id`.
- ✅ В `conversations` есть `status` (`new/in_progress/closed`) и `assigned_operator`.
- ✅ Оператор может отвечать пользователю: `operatorSend.ts` (+ отправка в Telegram/Viber при необходимости).
- ✅ Виджет получает ответы оператора (через `widgetSync.ts`, частый sync/polling).

### 2) Удобство
- ✅ Сохранение `user_id` и `conversation_id` в localStorage.
- ✅ Подгрузка истории сообщений при открытии виджета.
- ✅ Typing indicator (user/operator) через `typing_events`.
- ✅ Статус online/offline оператора через `operator_presence`.
- ✅ Автоответ в виджете (fallback-сообщение).

### 3) Мультиканал
- ✅ Telegram webhook (`telegramWebhook.ts`) с mapping user ↔ conversation.
- ✅ Viber webhook (`viberWebhook.ts`) с mapping user ↔ conversation.
- ✅ Router операторского ответа в Telegram/Viber (`operatorSend.ts`).
- ✅ Единый inbox: все каналы пишут в `messages`.

### 4) Dashboard
- ✅ Полный split-UI: список чатов слева, чат справа.
- ✅ Назначение оператора в диалог (`assigned_operator`).
- ✅ Фильтры по статусу (`all/new/in_progress/closed`).
- ✅ Быстрые ответы (`quick_replies`).
- ✅ Поиск по тексту/телефону/имени.

### 5) Технические доработки
- ✅ Базовый rate-limit в `sendMessage.ts` (20 сообщений/мин на user).
- ✅ Базовая валидация и фильтрация `< >` от XSS-инъекций.
- ✅ Подготовка под pagination (лимиты в запросах).
- ✅ Разделение API на функции: `sendMessage`, `widgetSync`, `operatorSend`, `telegramWebhook`, `viberWebhook`.

---

## Быстрый запуск

### Шаг 1. Supabase
1. Создайте проект Supabase.
2. Выполните `schema.sql` в SQL Editor.
3. Создайте оператора в Auth (email/password).
4. Для оператора в `user_metadata` проставьте `role: operator` (или `admin`).

### Шаг 2. Secrets для Edge Functions
Добавьте secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` (опционально)
- `VIBER_BOT_TOKEN` (опционально)

### Шаг 3. Deploy функций
Разверните 5 функций:
- `sendMessage.ts`  → `sendMessage`
- `widgetSync.ts`   → `widgetSync`
- `operatorSend.ts` → `operatorSend`
- `telegramWebhook.ts` → `telegramWebhook`
- `viberWebhook.ts` → `viberWebhook`

### Шаг 4. Подключение фронта
- В `widget.js` задайте `API_URL`.
- На сайт добавьте `<script src="/path/to/widget.js"></script>`.
- В `operator.js` задайте `SUPABASE_URL` и `SUPABASE_ANON_KEY`.
- Откройте `operator.html`, авторизуйтесь оператором.

### Шаг 5. Webhook каналы
Telegram:
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<PROJECT-REF>.supabase.co/functions/v1/telegramWebhook"}'
```

Viber:
```bash
curl -X POST "https://chatapi.viber.com/pa/set_webhook" \
  -H "X-Viber-Auth-Token: <VIBER_BOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<PROJECT-REF>.supabase.co/functions/v1/viberWebhook","event_types":["message"]}'
```

---

## Как протестировать
Полный чеклист: `TESTING.md`.

Коротко:
1. Отправить сообщение из виджета.
2. Увидеть чат в dashboard.
3. Ответить оператором → увидеть ответ в виджете.
4. Проверить typing indicator.
5. Проверить фильтры/поиск/назначение оператора.
6. Проверить Telegram и Viber webhook.

---

## План по дням
- **День 1:** БД + web send/receive + session/history
- **День 2:** operator auth + dashboard realtime + статусы/фильтры
- **День 3:** operator→channel router + Telegram webhook
- **День 4:** Viber webhook + presence/typing + hardening
- **День 5:** уведомления, аналитика, RLS-audit, production QA

Итого: **5 дней** до уверенного production MVP.
