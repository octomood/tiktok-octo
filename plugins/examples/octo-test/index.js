'use strict';

/**
 * Самый простой тестовый плагин.
 *
 * Никакого page:script — только CSS. Пока плагин включён, поверх страницы
 * висит бейдж, а ролики в ленте обведены розовой рамкой. При выключении
 * приложение само убирает вставленный CSS.
 */

const CSS = `
  [data-e2e="recommend-list-item-container"],
  [data-e2e="browse-video"],
  [data-e2e="feed-item"],
  [data-e2e="feed-video"] {
    outline: 3px solid rgba(255, 93, 143, 0.85) !important;
    outline-offset: -3px !important;
  }

  video {
    outline: 3px solid rgba(255, 93, 143, 0.85) !important;
    outline-offset: -3px !important;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    box-sizing: border-box;
    border: 3px solid rgba(255, 93, 143, 0.8);
    pointer-events: none;
  }

  body::after {
    content: 'OCTO TEST OK';
    position: fixed;
    top: 16px;
    left: 50%;
    z-index: 2147483647;
    transform: translateX(-50%);
    padding: 8px 15px;
    border-radius: 999px;
    background: #ff5d8f;
    color: #ffffff;
    font: 700 13px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: 0.03em;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38);
  }
`;

let cssApplied = false;

async function applyCss() {
  if (cssApplied) return;
  await octo.page.injectCSS(CSS);
  cssApplied = true;
}

octo.onActivate(async () => {
  await octo.commands.add({
    id: 'hello',
    title: 'Тест: привет',
    description: 'Показывает сообщение, что тестовый плагин работает.',
    run: () => octo.notify('Тестовый плагин работает'),
  });

  await octo.ui.panelRow({
    id: 'time',
    label: 'Тест: текущее время',
    description: 'Показывает время, чтобы увидеть, что код плагина выполняется.',
    run: () => octo.notify(`Сейчас ${new Date().toLocaleTimeString('ru-RU')}`),
  });

  await applyCss().catch((error) => octo.log('CSS:', error.message));
});

octo.onPageReady(async () => {
  await applyCss().catch((error) => octo.log('CSS:', error.message));
});

octo.onDeactivate(async () => {
  await octo.commands.remove('hello').catch(() => {});
  await octo.ui.removePanelRow('time').catch(() => {});
});
