'use strict';

/**
/**
 * Пример плагина TikTok octo.
 *
 * Здесь нет Node, require, fetch и eval — только мост window.octo. Плагин
 * регистрирует команду и строку панели, читает настройки и аккуратно трогает
 * DOM через изолированный мир страницы.
 */

let greeting = 'Привет из плагина!';
let accent = true;
let styleInjected = false;

async function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  await octo.page.injectCSS(`
    html[data-octo-hello-accent] [data-e2e="recommend-list-item-container"] {
      box-shadow: inset 0 -2px 0 rgba(255, 179, 193, 0.35);
    }
  `);
}

async function syncAccent() {
  await octo.page.run(
    `document.documentElement.${accent ? "setAttribute('data-octo-hello-accent', '1')" : "removeAttribute('data-octo-hello-accent')"}; return true;`,
  );
}

function readSettings() {
  const values = octo.settings.get();
  greeting = typeof values.greeting === 'string' && values.greeting ? values.greeting : greeting;
  accent = values.accent !== false;
}

async function sayHello() {
  await octo.notify(greeting);
}

async function countVideos() {
  const count = await octo.page.run(`return document.querySelectorAll('video').length;`);
  await octo.notify(`Видео на странице: ${Number(count) || 0}`);
}

octo.onActivate(async () => {
  readSettings();
  await octo.commands.add({
    id: 'hello',
    title: 'Hello octo: поздороваться',
    description: 'Показывает приветствие из настроек плагина.',
    run: sayHello,
  });
  await octo.ui.panelRow({
    id: 'count-videos',
    label: 'Посчитать видео на странице',
    description: 'Безопасный пример page.run в изолированном мире.',
    run: countVideos,
  });
  await octo.storage.set('last-activation', new Date().toISOString());
  await injectStyle().catch((error) => octo.log('style:', error.message));
  await syncAccent().catch((error) => octo.log('accent:', error.message));
  octo.log('активирован', octo.plugin.version);
});

octo.onSettingsChange(async (values) => {
  greeting = typeof values.greeting === 'string' && values.greeting ? values.greeting : greeting;
  accent = values.accent !== false;
  await syncAccent();
});

octo.onPageReady(async ({ url }) => {
  try {
    await octo.page.run(
      `document.documentElement.setAttribute('data-octo-hello', '1'); return true;`,
    );
    await syncAccent();
    octo.log('страница готова', url);
  } catch (error) {
    octo.log('page ready:', error.message);
  }
});

octo.onDeactivate(async () => {
  await octo.commands.remove('hello').catch(() => {});
  await octo.ui.removePanelRow('count-videos').catch(() => {});
  await octo.page
    .run(
      `document.documentElement.removeAttribute('data-octo-hello'); document.documentElement.removeAttribute('data-octo-hello-accent'); return true;`,
    )
    .catch(() => {});
});
