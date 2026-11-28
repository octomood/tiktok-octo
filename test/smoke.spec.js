'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Дымовой тест: приложение поднимается, полоса заголовка отвечает на команды,
 * панель поиска открывается и меняет высоту «хрома».
 *
 * Сайт не грузим: OCTO_HOME_URL=about:blank и отдельный профиль в temp,
 * чтобы не трогать реальную сессию и не зависеть от сети.
 *
 * Шорткаты проверяем через мост (window.octo.cmd): синтетические клавиши
 * Playwright не проходят через before-input-event, которым обрабатываются
 * реальные нажатия. Сам поиск и состояние при этом проходят весь путь
 * renderer → main → findInPage → renderer.
 */
test('окно, команды, поиск и панель функций', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-'));
  const screenshots = path.join(userData, 'screens');
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_SCREENSHOT_DIR: screenshots,
      },
    });

    await app.firstWindow();

    // Первым окном Playwright может отдать about:blank внутри WebContentsView.
    let page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
    for (let attempt = 0; attempt < 50 && !page; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
    }
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await expect(page.locator('#titlebar')).toBeVisible();
    await expect(page.locator('#btnHome')).toBeVisible();
    await expect(page.locator('#findbar')).toBeHidden();

    const baseHeight = await page.evaluate(
      () => document.getElementById('chrome').getBoundingClientRect().height,
    );
    expect(baseHeight).toBeGreaterThan(0);

    // Звук: команда проходит main → renderer и меняет состояние интерфейса.
    await page.click('#btnMute');
    await expect(page.locator('body')).toHaveClass(/is-muted/);
    await page.click('#btnMute');
    await expect(page.locator('body')).not.toHaveClass(/is-muted/);

    // Поиск: открытие меняет высоту «хрома», main сдвигает WebContentsView.
    await page.evaluate(() => window.octo.cmd('find'));
    await expect(page.locator('#findbar')).toBeVisible();

    const findHeight = await page.evaluate(
      () => document.getElementById('chrome').getBoundingClientRect().height,
    );
    expect(findHeight).toBeGreaterThan(baseHeight);

    await page.locator('#findInput').fill('tiktok');
    await expect(page.locator('#findCount')).toHaveText('Нет совпадений');

    await page.evaluate(() => window.octo.find('close'));
    await expect(page.locator('#findbar')).toBeHidden();

    // Настройки: оверлей поверх экрана, разделы слева, поиск, косметика и реклама.
    await page.click('#btnPanel');
    await expect(page.locator('#panel')).toBeVisible();
    await expect(page.locator('#panelDialog')).toBeVisible();
    await expect(page.locator('#btnPanel')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#btnPanel')).toContainText('Настройки');
    await expect(page.locator('#panelHeadTitle')).toHaveText('Настройки');
    await expect(page.locator('[data-cat-head="page"]')).toBeVisible();
    await expect(page.locator('[data-cat-head="page"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#catPage')).toBeVisible();
    await expect(page.locator('.panel-group').first()).toBeVisible();

    // Оверлей действительно по центру поверх экрана, а не узкая боковая панель.
    const dialogBox = await page.locator('#panelDialog').boundingBox();
    const viewSize = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    expect(dialogBox.x).toBeGreaterThan(20);
    expect(dialogBox.x + dialogBox.width).toBeLessThan(viewSize.w - 20);

    // Пункты навигации в меню настроек оформлены как MD3-пилюли (24px) с прозрачным
    // фоном в покое и подсветкой при наведении, а активный раздел выделяется
    // скользящей капсулой индикатора.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const ind = document.getElementById('settingsNavIndicator');
          const cs = ind ? getComputedStyle(ind) : null;
          return cs
            ? {
                opacity: cs.opacity,
                bg: cs.backgroundColor,
                tl: cs.borderTopLeftRadius,
              }
            : null;
        }),
      )
      .toEqual({
        opacity: '1',
        bg: expect.not.stringMatching(/^rgba\(0,\s*0,\s*0,\s*0\)$/),
        tl: '24px',
      });

    const readNavGeometry = () =>
      page.evaluate(() =>
        ['library', 'stats', 'downloads'].map((id) => {
          const cs = getComputedStyle(document.querySelector(`[data-cat-head="${id}"]`));
          return {
            id,
            bg: cs.backgroundColor,
            tl: cs.borderTopLeftRadius,
            tr: cs.borderTopRightRadius,
            bl: cs.borderBottomLeftRadius,
            br: cs.borderBottomRightRadius,
          };
        }),
      );
    const navDefault = await readNavGeometry();
    expect(navDefault).toEqual(
      ['library', 'stats', 'downloads'].map((id) => ({
        id,
        bg: 'rgba(0, 0, 0, 0)',
        tl: '24px',
        tr: '24px',
        bl: '24px',
        br: '24px',
      })),
    );

    for (const [index, id] of ['library', 'stats', 'downloads'].entries()) {
      await page.locator(`[data-cat-head="${id}"]`).hover();
      await expect
        .poll(async () => {
          const item = (await readNavGeometry())[index];
          return item;
        })
        .toEqual({
          ...navDefault[index],
          bg: expect.not.stringMatching(/^rgba\(0,\s*0,\s*0,\s*0\)$/),
        });
    }

    // Переключение разделов в один клик без «Назад».
    await page.locator('[data-cat-head="playback"]').click();
    await expect(page.locator('#catPlayback')).toBeVisible();
    await expect(page.locator('#catPage')).toBeHidden();
    await expect(page.locator('[data-cat-head="playback"]')).toHaveAttribute(
      'aria-current',
      'true',
    );

    // Поиск раскрывает подходящие разделы в правой колонке и прячет остальные.
    await page.locator('#panelSearch').fill('таймер');
    // Фокус не рисует второе кольцо вокруг поля: остаётся только рамка
    // контейнера, у самого input outline выключен.
    const searchFocus = await page.evaluate(() => {
      const input = document.getElementById('panelSearch');
      const bar = document.getElementById('panelSearchBar');
      return {
        outline: getComputedStyle(input).outlineStyle,
        shadow: getComputedStyle(bar).boxShadow,
      };
    });
    expect(searchFocus).toEqual({ outline: 'none', shadow: 'none' });
    await expect(page.locator('#catPlayback')).toBeVisible();
    await expect(page.locator('#sleepLabel')).toBeVisible();
    await expect(page.locator('#catPage')).toBeHidden();
    await page.locator('#panelSearch').fill('такой функции нет');
    await expect(page.locator('#panelNoResults')).toBeVisible();
    await page.locator('#btnPanelSearchClear').click();
    await expect(page.locator('#panelNoResults')).toBeHidden();
    await expect(page.locator('[data-cat-head="page"]')).toBeVisible();
    await expect(page.locator('#catPlayback')).toBeVisible();

    // Поиск не блокирует переход: клик по найденному заголовку сбрасывает фильтр.
    await page.locator('#panelSearch').fill('тё');
    await expect(page.locator('#catPage')).toBeHidden();
    await page.locator('[data-cat-head="cosmetics"]').click();
    await expect(page.locator('#panelSearch')).toHaveValue('');
    await expect(page.locator('#catCosmetics')).toBeVisible();

    // Быстрое меню стикеров открывается из полосы заголовка и закрывает настройки.
    await page.click('#btnStickers');
    await expect(page.locator('#stickerPopover')).toBeVisible();
    await expect(page.locator('#panel')).toBeHidden();
    await expect(page.locator('#stickerPopoverEmpty')).toBeVisible();
    await expect(page.locator('#btnStickers')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#btnStickers');
    await expect(page.locator('#popover')).toBeHidden();

    // Такое же меню для активных плагинов: без плагинов — пустое состояние.
    await page.click('#btnPluginsActive');
    await expect(page.locator('#pluginsPopover')).toBeVisible();
    await expect(page.locator('#pluginsPopoverEmpty')).toBeVisible();
    await page.click('#btnPluginsActive');
    await expect(page.locator('#popover')).toBeHidden();

    // Команда settings открывает тот же оверлей настроек.
    await page.evaluate(() => window.octo.cmd('settings'));
    await expect(page.locator('#panel')).toBeVisible();

    // Косметика: раздел открывается по клику; кастомное MD3-меню выбора работает вместо OS popup.
    await page.locator('[data-cat-head="cosmetics"]').click();
    const themeTrigger = page.locator('.octo-select-trigger[data-for="themeModeSelect"]');
    await expect(themeTrigger).toBeVisible();
    await themeTrigger.click();
    await expect(page.locator('#octoSelectMenu')).toBeVisible();
    await expect(page.locator('#octoSelectMenu .octo-select-opt.is-selected')).toHaveAttribute(
      'data-value',
      'dark',
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('#octoSelectMenu')).toBeHidden();
    await expect(page.locator('#panel')).toBeVisible();
    await themeTrigger.click();
    await page.locator('#octoSelectMenu .octo-select-opt[data-value="light"]').click();
    await expect(page.locator('#themeModeSelect')).toHaveValue('light');
    await expect(page.locator('#octoSelectMenu')).toBeHidden();
    await themeTrigger.click();
    await page.locator('#octoSelectMenu .octo-select-opt[data-value="dark"]').click();
    await expect(page.locator('#themeModeSelect')).toHaveValue('dark');

    const cosmetic = page.locator('#panelCosmetics [data-cosmetic="dark-scrollbars"]');
    await expect(cosmetic).toHaveAttribute('aria-checked', 'true');
    await cosmetic.click();
    await expect(cosmetic).toHaveAttribute('aria-checked', 'false');
    await cosmetic.click();
    await expect(cosmetic).toHaveAttribute('aria-checked', 'true');

    // Пропуск рекламы по умолчанию выключен.
    await page.locator('[data-cat-head="ads"]').click();
    const adSkip = page.locator('#rowAdSkip');
    await expect(adSkip).toHaveAttribute('aria-checked', 'false');
    await adSkip.click();
    await expect(adSkip).toHaveAttribute('aria-checked', 'true');
    await adSkip.click();
    await expect(adSkip).toHaveAttribute('aria-checked', 'false');

    // Регион: пресет применяется, переживает pushState и выключается обратно.
    await page.locator('[data-cat-head="region"]').click();
    await expect(page.locator('#regionSelect')).toHaveValue('off');
    await page.selectOption('#regionSelect', 'kz');
    await expect(page.locator('#regionSelect')).toHaveValue('kz');
    await expect(page.locator('#regionProxyState')).toContainText('Прокси не задан');
    await expect(page.locator('#regionIpValue')).toHaveText('Проверить');
    await expect(page.locator('[data-cmd="regionResetData"]')).toBeVisible();
    await page.selectOption('#regionSelect', 'off');
    await expect(page.locator('#regionSelect')).toHaveValue('off');

    // Загрузки: пустое состояние и таймер сна.
    await page.locator('[data-cat-head="downloads"]').click();
    await expect(page.locator('#downloadsEmpty')).toBeVisible();
    await page.locator('[data-cat-head="playback"]').click();
    await page.locator('[data-sleep="15"]').click();
    await expect(page.locator('[data-sleep="15"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sleepLabel')).toContainText('·');
    await page.locator('[data-sleep="0"]').click();
    await expect(page.locator('#sleepLabel')).toHaveText('Таймер сна');

    await page.locator('#panelSearch').fill('язык');
    await page.click('#btnPanelClose');
    await expect(page.locator('#panel')).toBeHidden();
    await expect(page.locator('#btnPanel')).toHaveAttribute('aria-pressed', 'false');

    // Поиск не переживает закрытие: при следующем открытии снова первый раздел.
    await page.click('#btnPanel');
    await expect(page.locator('#panelSearch')).toHaveValue('');
    await expect(page.locator('[data-cat-head="page"]')).toBeVisible();
    await expect(page.locator('#catPage')).toBeVisible();

    // Клик по затемнённому фону вокруг карточки закрывает настройки.
    await page.locator('#panel').click({ position: { x: 8, y: 8 } });
    await expect(page.locator('#panel')).toBeHidden();

    // Палитра команд: открывается, фильтрует и выполняет команду.
    await page.evaluate(() => window.octo.cmd('palette'));
    await expect(page.locator('#palette')).toBeVisible();
    await expect(page.locator('#paletteInput')).toBeFocused();
    await expect(page.locator('#paletteList .palette-item').first()).toBeVisible();

    await page.locator('#paletteInput').fill('скорость 1.5');
    await expect(page.locator('#paletteList .palette-item')).toHaveCount(1);
    await page.locator('#paletteList .palette-item').click();
    await expect(page.locator('#palette')).toBeHidden();

    await page.evaluate(() => window.octo.cmd('panel'));
    await page.locator('[data-cat-head="player"]').click();
    await expect(page.locator('[data-player-speed="1.5"]')).toHaveClass(/is-on/);
    await page.evaluate(() => window.octo.cmd('panel'));

    // Снимок кадра: файл появляется в переопределённом каталоге.
    await page.evaluate(() => window.octo.cmd('screenshot'));
    // Сначала ждём подтверждение от main, затем проверяем файл: команда
    // выполняется асинхронно и не обязана успеть к первому poll.
    await expect(page.locator('#pageTitle')).toContainText('Снимок сохранён');
    await expect
      .poll(() => (fs.existsSync(screenshots) ? fs.readdirSync(screenshots).length : 0))
      .toBe(1);

    // В правом нижнем углу есть тёмная плашка с подписью «TikTok Octo».
    const shot = fs.readFileSync(path.join(screenshots, fs.readdirSync(screenshots)[0]));
    const cornerPixels = await page.evaluate(async (base64) => {
      const image = new window.Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const width = Math.max(1, Math.round(image.naturalWidth * 0.3));
      const height = Math.max(1, Math.round(image.naturalHeight * 0.15));
      const data = context.getImageData(
        image.naturalWidth - width,
        image.naturalHeight - height,
        width,
        height,
      ).data;
      let dark = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] > 0 && data[index] < 160) dark += 1;
      }
      return dark;
    }, shot.toString('base64'));
    expect(cornerPixels).toBeGreaterThan(100);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
