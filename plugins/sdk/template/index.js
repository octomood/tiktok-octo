'use strict';

/**
 * Стартовый плагин TikTok Octo.
 *
 * Никакого Node, require, fetch и eval: только window.octo. Настройки
 * объявлены в plugin.json и уже отрисованы в карточке плагина, хранилище
 * ограничено 256 КБ, команды и строки панели снимаются при выключении.
 */

let greeting = 'Привет из плагина!';

function readSettings() {
  const values = octo.settings.get();
  if (typeof values.greeting === 'string' && values.greeting) {
    greeting = values.greeting;
  }
}

async function activate() {
  readSettings();

  await octo.commands.add({
    id: 'hello',
    title: 'Сказать привет',
    description: 'Показывает приветствие из настроек плагина',
    run: () => octo.notify(greeting),
  });

  await octo.ui.panelRow({
    id: 'hello',
    label: 'Сказать привет',
    description: 'Приветствие из плагина',
    run: () => octo.notify(greeting),
  });

  await octo.storage.set('activated-at', Date.now());
}

octo.onActivate(activate);

octo.onSettingsChange((values) => {
  if (typeof values.greeting === 'string' && values.greeting) {
    greeting = values.greeting;
  }
});

octo.onDeactivate(async () => {
  await octo.commands.remove('hello').catch(() => {});
  await octo.ui.removePanelRow('hello').catch(() => {});
});
