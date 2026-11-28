'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

async function waitForFileWindow(app) {
  let page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
  }
  return page;
}

function readState(userData) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
  } catch {
    return {};
  }
}

function launch(userData) {
  return electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
    },
  });
}

test('произвольный цвет палитры и покомпонентная кастомизация интерфейса', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-uicustom-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await page.click('#btnPanel');
    await expect(page.locator('#panel')).toBeVisible();
    await page.click('[data-cat-head="cosmetics"]');

    // 1. Выбор произвольного цвета палитры (primary + surface) через редактор.
    await page.fill('#themeCustomPrimaryHex', '#e91e63');
    await page.locator('#themeCustomPrimaryHex').dispatchEvent('change');
    await page.fill('#themeCustomSurfaceHex', '#140c18');
    await page.locator('#themeCustomSurfaceHex').dispatchEvent('change');

    await expect(page.locator('html')).toHaveAttribute('data-palette', 'custom');
    await expect.poll(() => readState(userData).themePalette).toBe('custom');
    await expect
      .poll(() => readState(userData).themeCustom)
      .toMatchObject({
        primary: '#e91e63',
        surface: '#140c18',
      });

    const appliedVars = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        primary: cs.getPropertyValue('--md-primary').trim(),
        surface: cs.getPropertyValue('--md-surface').trim(),
      };
    });
    expect(appliedVars.primary).toBe('#e91e63');
    expect(appliedVars.surface).toBe('#140c18');

    // Проверка MD3 Expressive ползунков краски (Hue / Saturation / Lightness).
    await page.locator('#themeCustomRoleTabs [data-color-role="primary"]').click();
    await page.locator('#themeCustomHue').fill('200');
    await page.locator('#themeCustomHue').dispatchEvent('input');
    await expect.poll(() => readState(userData).themeCustom?.primary).not.toBe('#e91e63');
    const hueSliderPct = await page.evaluate(() =>
      document.getElementById('themeCustomHue')?.style.getPropertyValue('--slider-pct'),
    );
    expect(hueSliderPct).toContain('%');

    // 2. Переход в раздел «Компоненты» и кастомизация бренда, кнопки настроек и кнопки назад.
    await page.click('#btnOpenComponentsCat');
    await expect(page.locator('#catComponents')).toBeVisible();

    // Бренд: своё название и эмодзи-иконка.
    await page.selectOption('#compSelect', 'brand');
    await page.fill('#compLabelInput', 'My Custom Octo');
    await page.locator('#compLabelInput').dispatchEvent('change');
    await page.selectOption('#compIconType', 'emoji');
    await page.locator('#compIconEmojiChips [data-emoji="⚡"]').click();

    await expect(page.locator('.brand-custom-label')).toHaveText('My Custom Octo');
    await expect(page.locator('.brand .octo-custom-icon--emoji')).toHaveText('⚡');
    expect(await page.title()).toBe('My Custom Octo');

    // Кнопка настроек: переименование, цвета, шрифт, иконка из набора и размер.
    await page.selectOption('#compSelect', 'btnPanel');
    await page.fill('#compLabelInput', 'Пульт');
    await page.locator('#compLabelInput').dispatchEvent('change');
    await page.fill('#compFgHex', '#ffffff');
    await page.locator('#compFgHex').dispatchEvent('change');
    await page.fill('#compBgHex', '#6a1b9a');
    await page.locator('#compBgHex').dispatchEvent('change');
    await page.selectOption('#compIconType', 'preset');
    await page.locator('#compIconPresetGrid [data-icon-preset="star"]').click();
    await page.selectOption('#compFontPreset', 'custom-name');
    await page.fill('#compFontNameInput', 'Fira Code');
    await page.click('#compFontNameApply');

    await expect(page.locator('#btnPanel .settings-label')).toHaveText('Пульт');
    await expect(page.locator('#btnPanel .octo-custom-icon--svg svg')).toBeVisible();
    const btnPanelStyles = await page.evaluate(() => {
      const btn = document.getElementById('btnPanel');
      return {
        color: btn.style.color,
        bg: btn.style.background,
        font: btn.style.fontFamily,
      };
    });
    expect(btnPanelStyles.color).toBe('rgb(255, 255, 255)');
    expect(btnPanelStyles.bg).toContain('106, 27, 154');
    expect(btnPanelStyles.font).toContain('Fira Code');

    // Своя картинка-иконка из файла для кнопки «Главная».
    const sampleIcon = path.join(__dirname, '../src/renderer/assets/octo-logo-mark.png');
    await page.selectOption('#compSelect', 'btnHome');
    await page.evaluate(
      (filePath) => window.octo.cmd('uiCustomIconPick', { id: 'btnHome', filePath }),
      sampleIcon,
    );
    await expect(page.locator('#btnHome .octo-custom-icon--img')).toBeVisible();
    expect(fs.existsSync(path.join(userData, 'ui-icons', 'btnHome.png'))).toBe(true);

    // Скрытие компонента и подсказка.
    await page.selectOption('#compSelect', 'btnForward');
    await page.fill('#compTooltipInput', 'Шаг вперёд');
    await page.locator('#compTooltipInput').dispatchEvent('change');
    await page.click('#compHiddenRow');
    await expect(page.locator('#btnForward')).toBeHidden();
    await expect(page.locator('#btnForward')).toHaveAttribute('title', 'Шаг вперёд');

    // Сброс одного компонента возвращает кнопку «Вперёд».
    await page.click('#compResetBtn');
    await expect(page.locator('#btnForward')).toBeVisible();
    await expect.poll(() => readState(userData).uiCustom?.btnForward).toBeUndefined();

    // Перезапуск: кастомизация и цвет палитры сохраняются.
    await app.close();
    app = await launch(userData);
    await app.firstWindow();
    const restarted = await waitForFileWindow(app);
    await expect(restarted.locator('html')).toHaveAttribute('data-palette', 'custom');
    await expect(restarted.locator('.brand-custom-label')).toHaveText('My Custom Octo');
    await expect(restarted.locator('#btnPanel .settings-label')).toHaveText('Пульт');
    await expect(restarted.locator('#btnHome .octo-custom-icon--img')).toBeVisible();

    // Полный сброс всех компонентов.
    await restarted.click('#btnPanel');
    await restarted.click('[data-cat-head="components"]');
    await restarted.click('#compResetAllBtn');
    await expect(restarted.locator('.brand-custom-label')).toHaveCount(0);
    await expect(restarted.locator('#btnPanel .settings-label')).toHaveText('Настройки');
    await expect(restarted.locator('#btnHome .octo-custom-icon')).toHaveCount(0);
    await expect.poll(() => Object.keys(readState(userData).uiCustom || {})).toHaveLength(0);
  } finally {
    await app?.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
