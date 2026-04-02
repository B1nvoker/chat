# TESTING (E2E + Regression)

## 0. Pre-check
- `schema.sql` применен.
- Все 5 Edge Functions задеплоены.
- Оператор создан в Supabase Auth и имеет `user_metadata.role = operator`.

## 1. Web Widget
1. Открой страницу с `widget.js`.
2. Убедись, что бот приветствует через 3 секунды.
3. Отправь сообщение.
4. Перезагрузи страницу.
5. Убедись, что история и сессия сохранились.

Ожидание:
- в localStorage есть `chat_user_id` и `chat_conversation_id`;
- в БД есть `users`, `conversations`, `messages`.

## 2. Operator Auth + Inbox
1. Открой `operator.html`.
2. Войди email/password оператора.
3. Убедись, что список диалогов загружен.
4. Применяй фильтры (`new`, `in_progress`, `closed`) и поиск.

## 3. Operator -> User
1. Выбери диалог.
2. Нажми `Назначить мне`.
3. Отправь сообщение оператором.
4. Проверь, что ответ появился в виджете через sync.

## 4. Typing + Presence
1. В dashboard начни печатать — в виджете должен появиться `Оператор печатает...`.
2. Закрой dashboard вкладку и открой виджет — статус должен смениться на `Оператор офлайн`.

## 5. Telegram / Viber
1. Подключи webhooks.
2. Напиши в Telegram/Viber-бота.
3. Убедись, что сообщения появились в dashboard.
4. Ответь оператором — сообщение должно уйти обратно в канал.

## 6. Negative / Security
- Пустой `text` в `sendMessage` -> `400`.
- Спам 20+ сообщений/мин -> `429`.
- Без токена в `operatorSend` -> `401`.
- С токеном без роли operator/admin -> `403`.

## 7. SQL checks
```sql
select status, count(*) from conversations group by status;
select channel, count(*) from messages group by channel;
select assigned_operator, count(*) from conversations group by assigned_operator;
```
