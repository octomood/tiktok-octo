'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { isTikTokAuthUrl, isAuthUrl, isAuthHost, isOAuthPopupUrl } = require('../src/main/shared');

test('предикаты OAuth и страниц входа/регистрации покрывают провайдеров и редиректы', () => {
  expect(isAuthUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=1')).toBe(true);
  expect(isAuthUrl('https://accounts.google.com/v3/signin/identifier')).toBe(true);
  expect(isAuthUrl('https://accounts.google.com/gsi/select')).toBe(true);
  expect(isAuthUrl('https://accounts.google.com/AccountChooser')).toBe(true);
  expect(isAuthUrl('https://accounts.google.com/signin/oauth/legacy/consent?authuser=0')).toBe(
    true,
  );
  expect(isAuthUrl('https://www.facebook.com/login.php?skip_api_login=1')).toBe(true);
  expect(isAuthUrl('https://www.facebook.com/r.php')).toBe(true);
  expect(isAuthUrl('https://x.com/i/flow/login')).toBe(true);
  expect(isAuthUrl('https://api.x.com/oauth/authenticate')).toBe(true);
  expect(isAuthUrl('https://id.vk.com/auth')).toBe(true);
  expect(isAuthUrl('https://www.tiktok.com/login')).toBe(false);
  expect(isAuthHost('https://evil.example/oauth')).toBe(false);

  expect(isOAuthPopupUrl('about:blank')).toBe(true);
  expect(isOAuthPopupUrl('https://accounts.youtube.com/accounts/SetSID')).toBe(true);
  expect(isOAuthPopupUrl('https://consent.google.com/m')).toBe(true);
  expect(isOAuthPopupUrl('https://gds.google.com/web/landing')).toBe(true);
  expect(isOAuthPopupUrl('https://www.tiktok.com/login')).toBe(true);
  expect(isOAuthPopupUrl('https://www.youtube.com/watch?v=1')).toBe(false);

  expect(isTikTokAuthUrl('https://www.tiktok.com/login/phone-or-email/email')).toBe(true);
  expect(isTikTokAuthUrl('https://www.tiktok.com/signup')).toBe(true);
  expect(isTikTokAuthUrl('https://www-useast1a.tiktok.com/passport/web/user/login/')).toBe(true);
  expect(isTikTokAuthUrl('https://www.tiktok.com/foryou')).toBe(false);
  expect(isTikTokAuthUrl('https://www.tiktok.com/business-suite')).toBe(false);
});

test('заголовки входа, отсутствие CDP-отладчика на auth-страницах и OAuth popup', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-auth-'));
  const keyPath = path.join(tmpDir, 'key.pem');
  const certPath = path.join(tmpDir, 'cert.pem');
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-days',
    '1',
    '-nodes',
    '-subj',
    '/CN=*.tiktok.com',
    '-addext',
    'subjectAltName=DNS:*.tiktok.com,DNS:*.google.com,DNS:*.youtube.com',
  ]);

  const seen = [];
  let port = 0;
  const server = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    (req, res) => {
      seen.push({ host: req.headers.host, url: req.url, headers: req.headers });
      if (req.url === '/login') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><body>
          <script>
            window.testLoginXhr = () => fetch('/passport/web/user/login/', { method: 'POST', credentials: 'include' }).then(r => r.json());
            window.openOAuth = () => window.open('https://accounts.google.com:${port}/v3/signin/identifier', 'oauth', 'width=500,height=700');
            window.openBlankOAuth = () => {
              const w = window.open('about:blank', 'oauth2', 'width=500,height=700');
              if (w) w.location = 'https://accounts.youtube.com:${port}/accounts/SetSID';
              return Boolean(w);
            };
          </script>
        </body></html>`);
        return;
      }
      if (
        req.url === '/passport/web/user/login/' &&
        req.headers.host.startsWith('www.tiktok.com')
      ) {
        res.writeHead(307, {
          Location: `https://www-useast1a.tiktok.com:${port}/passport/web/user/login/`,
          'Access-Control-Allow-Origin': `https://www.tiktok.com:${port}`,
          'Access-Control-Allow-Credentials': 'true',
        });
        res.end();
        return;
      }
      if (
        req.url === '/passport/web/user/login/' &&
        req.headers.host.startsWith('www-useast1a.tiktok.com')
      ) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': `https://www.tiktok.com:${port}`,
          'Access-Control-Allow-Credentials': 'true',
          'Set-Cookie':
            'sessionid=test_session; Domain=.tiktok.com; Path=/; HttpOnly; Secure; SameSite=None',
        });
        res.end(JSON.stringify({ message: 'success' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><body>oauth-ok</body></html>');
    },
  );

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;

  let app;
  try {
    app = await electron.launch({
      args: [
        path.join(__dirname, '..'),
        '--no-sandbox',
        '--host-resolver-rules=MAP *.tiktok.com 127.0.0.1,MAP *.google.com 127.0.0.1,MAP *.youtube.com 127.0.0.1',
      ],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: tmpDir,
        OCTO_HOME_URL: 'about:blank',
      },
    });

    await app.firstWindow();

    const result = await app.evaluate(
      async ({ app: electronApp, BrowserWindow, session }, serverPort) => {
        electronApp.on('certificate-error', (event, _wc, _url, _err, _cert, callback) => {
          event.preventDefault();
          callback(true);
        });

        const win = BrowserWindow.getAllWindows()[0];
        const wc = win.contentView.children[0].webContents;
        await wc.loadURL(`https://www.tiktok.com:${serverPort}/login`);

        const debuggerOnLogin = wc.debugger.isAttached();
        const xhrRes = await wc.executeJavaScript('window.testLoginXhr()');
        const ses = session.fromPartition('persist:octo-tiktok');
        const cookies = await ses.cookies.get({ domain: 'tiktok.com', name: 'sessionid' });

        await wc.executeJavaScript('Boolean(window.openOAuth())');
        await new Promise((r) => setTimeout(r, 400));
        const popupsAfterGoogle = BrowserWindow.getAllWindows()
          .filter((w) => w !== win)
          .map((w) => w.webContents.getURL());

        const blankPopupCreated = await wc.executeJavaScript('window.openBlankOAuth()');
        await new Promise((r) => setTimeout(r, 400));
        const popupsAfterYoutube = BrowserWindow.getAllWindows()
          .filter((w) => w !== win)
          .map((w) => w.webContents.getURL());

        for (const w of BrowserWindow.getAllWindows()) {
          if (w !== win && !w.isDestroyed()) w.close();
        }

        return {
          debuggerOnLogin,
          xhrRes,
          hasSessionCookie: cookies.some((c) => c.value === 'test_session'),
          popupsAfterGoogle,
          blankPopupCreated,
          popupsAfterYoutube,
        };
      },
      port,
    );

    expect(result.debuggerOnLogin).toBe(false);
    expect(result.xhrRes).toEqual({ message: 'success' });
    expect(result.hasSessionCookie).toBe(true);
    expect(result.popupsAfterGoogle.some((u) => u.includes('accounts.google.com'))).toBe(true);
    expect(result.blankPopupCreated).toBe(true);
    expect(result.popupsAfterYoutube.some((u) => u.includes('accounts.youtube.com'))).toBe(true);

    const loginNav = seen.find((s) => s.url === '/login');
    expect(loginNav).toBeTruthy();
    expect(loginNav.headers['accept-language']).toBe('ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7');
    expect(loginNav.headers['sec-ch-ua']).toContain('"Google Chrome"');
    expect(loginNav.headers['sec-ch-ua']).toContain('"Chromium"');

    const redirectXhr = seen.find(
      (s) => s.url === '/passport/web/user/login/' && s.host.startsWith('www-useast1a.tiktok.com'),
    );
    expect(redirectXhr).toBeTruthy();
    expect(redirectXhr.headers['accept-language']).toBe('ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7');
    expect(redirectXhr.headers['sec-ch-ua']).toContain('"Google Chrome"');
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
