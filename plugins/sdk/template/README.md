# **NAME**

Стартовый плагин для TikTok Octo.

- Команда в палитре команд и строка в панели функций.
- Настройка `greeting` объявлена в `plugin.json` — отдельный HTML не нужен.
- Хранилище до 256 КБ через `octo.storage`.

## Разработка

```bash
OCTO_PLUGIN_DEV_DIR="$PWD" npm start
```

Приложение подхватит папку как dev-плагин и перезагрузит его при изменении
`plugin.json`, `index.js` и других файлов. Собрать пакет:

```bash
node scripts/pack-plugin.js . --out ../packages
```
