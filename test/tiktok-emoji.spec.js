'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { EMOJI, replaceEmojiCodes } = require('../src/main/tiktok-emoji');

async function waitForPage(app, prefix) {
  await expect.poll(() => app.windows().some((page) => page.url().startsWith(prefix))).toBe(true);
  return app.windows().find((page) => page.url().startsWith(prefix));
}

const FIXTURE = `<!doctype html><meta charset="utf-8"><body>
  <p id="reply">Ответил(-а) вам: <span>[Глаза-сердечки]</span></p>
  <p id="codes">[smile][loveface] [unknown] [обычный текст]</p>
  <p id="markup"><b>[happy]</b> <a href="#keep">[cry]</a></p>
  <input id="input" value="[smile]">
  <textarea id="textarea">[Глаза-сердечки]</textarea>
  <div contenteditable="true" id="editor"><span>[loveface]</span></div>
  <div role="textbox" id="textbox">[happy]</div>
  <pre id="code">[smile]</pre>
  <script type="application/json" id="data">["[smile]"]</script>
  <iframe srcdoc="<p id='frame-reply'>[Глаза-сердечки]</p>"></iframe>
</body>`;

test('известные коды заменяются, прочие скобки и Unicode остаются нетронутыми', () => {
  for (const [name, emoji] of Object.entries(EMOJI)) {
    expect(replaceEmojiCodes(`[${name}]`)).toBe(emoji);
  }
  expect(replaceEmojiCodes('[Глаза-сердечки][loveface][SMILE]')).toBe('😍😍🙂');
  const untouched = '😍 [неизвестно] [обычный текст] [] [ smile ] [__proto__] [constructor]';
  expect(replaceEmojiCodes(untouched)).toBe(untouched);
  expect(replaceEmojiCodes(replaceEmojiCodes('[smile] [cry]'))).toBe('🙂 😢');
});

test('коды TikTok заменяются в основном окне, боковом чате и фреймах, но не в редакторах', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-emoji-'));
  let app;
  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: `data:text/html,${encodeURIComponent(FIXTURE)}`,
      },
    });
    await app.firstWindow();
    const shell = await waitForPage(app, 'file://');
    const site = await waitForPage(app, 'about:blank');
    await site.setContent(FIXTURE);

    await expect(site.locator('#reply')).toHaveText('Ответил(-а) вам: 😍');
    await expect(site.locator('#codes')).toHaveText('🙂😍 [unknown] [обычный текст]');
    await expect(site.locator('#markup b')).toHaveText('😊');
    await expect(site.locator('#markup a')).toHaveText('😢');
    await expect(site.locator('#markup a')).toHaveAttribute('href', '#keep');
    await expect(site.locator('#input')).toHaveValue('[smile]');
    await expect(site.locator('#textarea')).toHaveValue('[Глаза-сердечки]');
    await expect(site.locator('#editor')).toHaveText('[loveface]');
    await expect(site.locator('#textbox')).toHaveText('[happy]');
    await expect(site.locator('#code')).toHaveText('[smile]');
    await expect(site.locator('#data')).toHaveJSProperty('textContent', '["[smile]"]');
    await expect(site.frameLocator('iframe').locator('#frame-reply')).toHaveText('😍');

    // Новые сообщения и переиспользованные React текстовые узлы.
    await site.evaluate(() => {
      const message = document.createElement('p');
      message.id = 'later';
      message.append(document.createTextNode('[cry]'));
      document.body.append(message);
    });
    await expect(site.locator('#later')).toHaveText('😢');
    await site.evaluate(() => {
      document.querySelector('#later').firstChild.data = '[Глаза-сердечки]';
    });
    await expect(site.locator('#later')).toHaveText('😍');

    // Выключенная косметика не отключает постоянную замену.
    await shell.evaluate(() => window.octo.cmd('cosmetic', 'md3-design'));
    await site.evaluate(() => {
      document.querySelector('#later').firstChild.data = '[smile]';
    });
    await expect(site.locator('#later')).toHaveText('🙂');

    await shell.locator('#btnChat').click();
    const chat = await waitForPage(app, 'data:text/html');
    await expect(chat.locator('#reply')).toHaveText('Ответил(-а) вам: 😍');
    await expect(chat.frameLocator('iframe').locator('#frame-reply')).toHaveText('😍');
    await expect(chat.locator('#editor')).toHaveText('[loveface]');
    await chat.reload();
    await expect(chat.locator('#reply')).toHaveText('Ответил(-а) вам: 😍');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
