# SDK плагинов TikTok Octo

Локальный набор для разработки без Electron: типы моста `window.octo`, мок для
unit-тестов и шаблон проекта.

## Что внутри

| Файл           | Зачем                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| `octo.d.ts`    | Типы `window.octo`: настройки, хранилище, команды, панель, страница, сеть. |
| `octo-mock.js` | Мок `octo` в памяти: его можно подключить в Node-тест плагина.             |
| `template/`    | Стартовый плагин: команда, строка панели, настройка и хранилище.           |

## Новый плагин

```bash
npm run plugin:new -- my-plugin
# или с явным идентификатором:
npm run plugin:new -- my-plugin --id app.example.my-plugin --name "My plugin"
```

Скрипт копирует шаблон, подставляет `id` и имя и ничего не устанавливает.

## Тесты без Electron

```js
const { createOctoMock } = require('./octo-mock.js');

const { octo, state, emit } = createOctoMock({
  settings: { greeting: 'Привет' },
});

globalThis.octo = octo;
require('./index.js');
await emit('activate');

await octo.notify('проверка');
expect(state.notifications).toContain('проверка');
expect(state.commands.has('hello')).toBe(true);
```

Мок повторяет форму настоящего API, но всё хранит в памяти: `net.fetch` по
умолчанию бросает ошибку, `page.run` возвращает `null`, `navigate` и
`openExternal` отключены. Это даёт быстрые тесты логики плагина без окна и
сети.

## Лимиты

- Хранилище `octo.storage` — 256 КБ JSON на плагин.
- Команды — до 64, строки панели — до 64.
- `octo.page.run` — изолированный мир, таймаут 10 секунд, результат до 256 КБ.
- Пакет — до 8 МБ, точка входа — до 2 МБ, файл — до 6 МБ.

Точные значения карточка плагина показывает в разделе «О плагине»: сколько
занято хранилище, сколько команд и строк панели зарегистрировано.

## Типы

Подключите `octo.d.ts` в свой проект (или скопируйте рядом с `index.js`):

```ts
/// <reference path="./octo.d.ts" />
```

Типы описывают только мост: самого `require`, `process` и Node в плагине нет.
