'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * «Современный шрифт на сайте» должен накрывать все элементы, а не только
 * body: TikTok задаёт font-family на своих компонентах (TikTokFont,
 * TikTokDisplayFont), и эти правила перебивали наследование — шапки и имена в
 * чатах оставались в фирменном шрифте, а остальной текст — в Inter.
 *
 * Сайт не грузим: проверяем на about:blank с элементами, которые ведут себя
 * как компоненты TikTok (задают font-family сами, в том числе inline
 * !important). SVG-текст трогать нельзя: на сайте в SVG живут иконки.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('шрифт сайта применяется ко всем элементам, кроме SVG', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-font-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
      },
    });

    await app.firstWindow();

    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    await site.evaluate(() => {
      const text = document.createElement('div');
      text.id = 'octo-font-text';
      text.setAttribute('style', "font-family: 'TikTokDisplayFont', serif");
      text.textContent = 'Сообщения';

      const important = document.createElement('div');
      important.id = 'octo-font-important';
      important.setAttribute('style', "font-family: 'TikTokFont', serif !important");
      important.textContent = 'Только непрочитанные';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const svgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      svgText.id = 'octo-font-svg-text';
      svgText.setAttribute('style', 'font-family: serif');
      svgText.textContent = 'icon';
      svg.append(svgText);

      document.body.append(text, important, svg);
    });

    const fontOf = (id) =>
      site.evaluate(
        (elementId) => getComputedStyle(document.getElementById(elementId)).fontFamily,
        id,
      );

    await expect.poll(() => fontOf('octo-font-text')).toContain('Inter');
    await expect.poll(() => fontOf('octo-font-important')).toContain('Inter');

    // Inter действительно подгружается из встроенных data: URI.
    await expect
      .poll(() =>
        site.evaluate(() =>
          [...document.fonts].some((face) => face.family === 'Inter' && face.status === 'loaded'),
        ),
      )
      .toBe(true);

    // Иконки в SVG остаются на своём шрифте.
    expect(await fontOf('octo-font-svg-text')).toContain('serif');
  } finally {
    await app?.close();
  }
});
