# Hello octo

Минимальный пример плагина для TikTok Octo. Показывает, как:

- зарегистрировать команду в палитре (`octo.commands.add`);
- добавить строку в панель функций (`octo.ui.panelRow`);
- объявить настройки в `plugin.json` и прочитать их (`octo.settings.get`);
- сохранить данные (`octo.storage`);
- добавить CSS (`octo.page.injectCSS`);
- выполнить безопасный скрипт в изолированном мире страницы (`octo.page.run`);
- корректно убрать всё за собой (`octo.onDeactivate`).

## Сборка

```bash
node scripts/pack-plugin.js plugins/examples/hello-octo \
  --out plugins/packages \
  --update-registry plugins/registry.json
```

Готовый файл `app.octo.hello-1.0.0.octoplugin` можно установить через
«Плагины → Установить из файла…».

## Разработка

Распакуйте папку и запустите приложение с переменной окружения:

```bash
OCTO_PLUGIN_DEV_DIR=$PWD/plugins/examples npm start
```

Плагины из папки разработки не подписаны и не сохраняются в профиль, но
проходят тот же манифест и статическую проверку.
