<div align="center">
  <img src="docs/banner.png" width="880" alt="TikTok octo — unofficial desktop shell for tiktok.com" />
</div>

<div align="center">
  <a href="https://github.com/octomood/tiktok-octo/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/octomood/tiktok-octo/ci.yml?style=flat-square&labelColor=12121a&label=ci" /></a>
  <a href="https://github.com/octomood/tiktok-octo/releases"><img alt="Release" src="https://img.shields.io/github/v/release/octomood/tiktok-octo?style=flat-square&color=25f4ee&labelColor=12121a&label=release" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-fe2c55?style=flat-square&labelColor=12121a" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/electron-45-9a9aa8?style=flat-square&labelColor=12121a" />
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-linux%20%7C%20windows%20%7C%20macos-ffffff?style=flat-square&labelColor=12121a" />
  <img alt="No API, no scraping" src="https://img.shields.io/badge/no%20api-no%20scraping-25f4ee?style=flat-square&labelColor=12121a" />
</div>

<br />

<div align="center">
  <b>English</b> &nbsp;·&nbsp; <a href="README.ru.md">Русский</a>
</div>

<br />

**TikTok octo** is an unofficial desktop client for TikTok: the official website,
login and all, wrapped in a thin native Electron shell. No browser chrome, no
tabs, no address bar — just a 44-pixel title bar of its own, a floating video
window and a handful of shortcuts that make sense on a desktop.

> **Why a shell and not a "real" client?**
> TikTok gives third-party apps no access to the feed, the For You algorithm or
> publishing — there is no public API for that. The only route that doesn't break
> the rules is to render their own web client in a native window, which is exactly
> what this is: no private endpoint parsing, no signature spoofing, no protection
> bypass. A browser, shaped like an app.

<div align="center">
  <img src="docs/titlebar.png" width="820" alt="TikTok octo title bar with the glass octopus mark, navigation, unread badge and window controls" />
  <br />
  <sub><i>The whole chrome: brand mark, navigation, unread badge, page state, window controls.</i></sub>
</div>

## What's inside

|                                     |                                                                                                                                                               |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **🪟&nbsp; A title bar of its own** | Back / forward / reload / home, a live page pill, unread count, native window buttons. Dragging and double-click to maximise come for free.                   |
| **🔐&nbsp; Real login**             | A persistent `persist:octo-tiktok` session on disk — you stay signed in between launches. Google, Apple, Facebook and X OAuth windows open on top of the app. |
| **🔎&nbsp; Find in page**           | <kbd>Ctrl</kbd>+<kbd>F</kbd> opens a compact bar with a `1/3` counter. The page slides down instead of being covered; <kbd>Esc</kbd> closes it.               |
| **🎬&nbsp; Picture-in-picture**     | Send the current video into a floating window above everything else. Toolbar button or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>.                         |
| **📌&nbsp; Always on top**          | Keep the feed above your work while you pretend to work. The mode survives restarts.                                                                          |
| **🔇&nbsp; Instant mute**           | One click, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> or a media key. No reload, no state lost.                                                            |
| **🗂&nbsp; Tray**                    | Hide the window, mute, pin, PiP, or enable "close to tray" and keep listening.                                                                                |
| **⬇️&nbsp; Downloads**              | Files go through the system save dialog; progress lives in the title bar, and the result is a toast.                                                          |
| **🔄&nbsp; Self-updating**          | Packaged builds check GitHub Releases and offer to restart when the update is ready.                                                                          |
| **🔍&nbsp; Browser-grade zoom**     | Chromium steps from 50 to 300 %, remembered across restarts.                                                                                                  |
| **🌍&nbsp; Links stay polite**      | Anything that isn't `tiktok.com` opens in your system browser. TikTok links with `target=_blank` stay inside the app.                                         |
| **🧠&nbsp; It remembers**           | Window geometry, maximised state, zoom, mute, always-on-top and the last page you were on.                                                                    |
| **🧯&nbsp; It survives**            | Failed loads retry with backoff, a crashed renderer is brought back, a hung page says so instead of dying silently.                                           |
| **⛶&nbsp; Real fullscreen**         | Fullscreen video takes the whole window and the title bar gets out of the way.                                                                                |

<div align="center">
  <img src="docs/findbar.png" width="820" alt="Find in page bar with a match counter under the title bar" />
  <br />
  <sub><i>Find in page: the content shrinks, it is never covered.</i></sub>
</div>

## Shortcuts

| Keys                                                                                                 | Action                                    |
| :--------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| <kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Alt</kbd>+<kbd>→</kbd>                                            | Back / forward                            |
| <kbd>Ctrl</kbd>+<kbd>F</kbd>                                                                         | Find in page                              |
| <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd>, <kbd>F3</kbd> / <kbd>Shift</kbd>+<kbd>F3</kbd> | Next / previous match                     |
| <kbd>Esc</kbd>                                                                                       | Close the find bar, then leave fullscreen |
| <kbd>Ctrl</kbd>+<kbd>R</kbd>                                                                         | Reload                                    |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>                                                        | Reload, bypassing cache                   |
| <kbd>F5</kbd>                                                                                        | Reload                                    |
| <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd>           | Zoom in / out / reset                     |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>                                                        | Mute / unmute                             |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>                                                        | Picture-in-picture                        |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>                                                        | Always on top                             |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>                                                        | DevTools                                  |
| <kbd>Ctrl</kbd>+<kbd>W</kbd> / <kbd>Ctrl</kbd>+<kbd>Q</kbd>                                          | Close window / quit                       |
| <kbd>F11</kbd>                                                                                       | Fullscreen                                |
| Media keys                                                                                           | Play / pause, stop (mute)                 |

On macOS use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>.

## Quick start

```bash
git clone https://github.com/octomood/tiktok-octo.git
cd tiktok-octo

npm ci

# npm 12+ blocks install scripts, so the Electron binary is not fetched:
node node_modules/electron/install.js

npm start        # run
npm run dev      # run with page logs
```

## Build & release

```bash
npm run dist:linux   # AppImage + deb
npm run dist:win     # NSIS installer + portable
npm run dist:mac     # dmg
```

Artifacts land in `dist/`. The app icon is `build/icon.png`
(source: `build/icon.svg`, rebuilt with `rsvg-convert`).

Pushing a `v*` tag triggers `.github/workflows/release.yml`: it builds all three
platforms and publishes the artifacts to GitHub Releases, which is also what the
in-app updater reads.

## Development

```bash
npm run lint          # eslint
npm run format:check  # prettier
npm test              # Playwright smoke test on the real Electron app
```

The smoke test launches the app with a temporary profile and `about:blank` as the
home page, so it touches neither your session nor the network. CI runs it under
`xvfb`.

```
src/
  main/
    main.js        app lifecycle, IPC, media keys, single-instance lock
    app-context.js shared window state and the main → title bar bridge
    window.js      BrowserWindow, geometry, close-to-tray
    view.js        WebContentsView with the site, history, retries, fullscreen
    session.js     persistent session, permissions, downloads
    store.js       JSON state in userData
    commands.js    the command table behind every button and shortcut
    find.js        find in page
    shortcuts.js   before-input-event handling
    menu.js        app menu and context menu
    tray.js        tray icon and its menu
    updates.js     electron-updater
    hardening.js   webContents guards for popups and navigation
    links.js       handler for "open in the system browser"
    shared.js      constants and URL predicates
    preload.js     window.octo bridge for the title bar
  renderer/
    index.html     title bar + find bar markup
    styles.css     their styling
    titlebar.js    state, toasts, keyboard plumbing
    assets/
      tiktok-octo.png  brand mark (cropped and cleaned tiktok-octo.jpg)
test/
  smoke.spec.js  Playwright smoke test
build/
  icon.svg / icon.png / entitlements.mac.plist
```

The site does not live in a `<webview>` or an `<iframe>` — it runs in a separate
`WebContentsView` pinned under the title bar. Our UI is an ordinary Electron page;
TikTok's content is an isolated process with no preload, no Node and
`sandbox: true`. The site cannot reach our interface, and we steer it only through
`webContents`. Permissions are an explicit allowlist (camera, microphone,
notifications, fullscreen, clipboard write, pointer lock) granted only to
`tiktok.com`; every other navigation goes to the system browser.

Small things that took actual work:

- **User-Agent** is assembled from the Chromium version without the `Electron/…`
  token — otherwise some CDNs and pages behave differently than in plain Chrome.
- **Navigation history** is tracked by index instead of
  `navigationHistory.canGoBack()`. TikTok's SPA router marks entries as skippable,
  so the built-in `canGoBack()`/`goBack()` lie and silently do nothing. A step is
  performed with `goToIndex()`.
- **Deep profile links** come with `location.replace`, which collapses history to
  a single entry — "back" is genuinely unavailable there. That's the site's
  behaviour, not a client bug.
- **The find bar** lives in our renderer, but the search itself is
  `webContents.findInPage()`. The renderer reports its real height over IPC, so
  the site view is pushed down instead of being overlapped.
- **HTML fullscreen** is handled separately: on `enter-html-full-screen` the view
  stretches over the whole window and the title bar hides.

## Known limits

- On **Wayland** the compositor decides where the window goes and how big it is, so
  the saved geometry may be ignored. On X11, Windows and macOS it works as usual.
- **PiP** and **global media keys** depend on the desktop portal; on some Wayland
  setups they may not work (the app tells you when it can).
- The tray needs **StatusNotifier** on Linux; without it the app simply runs
  without an icon.
- **Unread badges** appear where the desktop supports them (macOS dock, Unity
  launcher); the count is read from the page title, not from private requests.
- **Auto-update** works only for packaged builds published through GitHub
  Releases.
- Ads, recommendations and account limits are exactly like on the web — the
  client doesn't touch them.

## Legal

The app's code is MIT-licensed. TikTok, its logos and its content belong to
TikTok Ltd. This project is not affiliated with TikTok, does not modify their
traffic and does not bypass protections: it is a browser in the shape of a window.
Do not publish builds in stores under someone else's name and logo — for personal
use there is nothing to worry about.

<div align="center">
  <sub>Made with glass, gradients and <code>WebContentsView</code>.</sub>
</div>
