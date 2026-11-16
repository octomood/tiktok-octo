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

|                                     |                                                                                                                                                                                                                      |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🪟&nbsp; A title bar of its own** | Back / forward / reload / home, a live page pill, unread count, native window buttons. Dragging and double-click to maximise come for free.                                                                          |
| **🔐&nbsp; Real login**             | A persistent `persist:octo-tiktok` session on disk — you stay signed in between launches. Google, Apple, Facebook and X OAuth windows open on top of the app.                                                        |
| **🔎&nbsp; Find in page**           | <kbd>Ctrl</kbd>+<kbd>F</kbd> opens a compact bar with a `1/3` counter. The page slides down instead of being covered; <kbd>Esc</kbd> closes it.                                                                      |
| **🎬&nbsp; Picture-in-picture**     | A compact always-on-top mini player: auto-advance, previous/next and adaptive sizing for your screen. Toolbar button or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>.                                               |
| **📌&nbsp; Always on top**          | Keep the feed above your work while you pretend to work. The mode survives restarts.                                                                                                                                 |
| **🔇&nbsp; Sound & volume**         | Instant mute with a click, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> or a media key, plus a 0–100 % volume slider in the Playback panel.                                                                         |
| **🗂&nbsp; Tray**                    | Hide the window, mute, pin, PiP, or enable "close to tray" and keep listening.                                                                                                                                       |
| **⬇️&nbsp; Downloads**              | Files go through the system save dialog; progress lives in the title bar, and the result is a toast.                                                                                                                 |
| **🔄&nbsp; Self-updating**          | Packaged builds check GitHub Releases and offer to restart when the update is ready.                                                                                                                                 |
| **🔍&nbsp; Browser-grade zoom**     | Chromium steps from 50 to 300 %, remembered across restarts.                                                                                                                                                         |
| **🌍&nbsp; Links stay polite**      | Anything that isn't `tiktok.com` opens in your system browser. TikTok links with `target=_blank` stay inside the app.                                                                                                |
| **🌐&nbsp; Region & proxy**         | Pick a country to change `Accept-Language`, `navigator.language`, timezone and geolocation. Bring your own SOCKS5/HTTP proxy to change the actual IP.                                                                |
| **🗣️&nbsp; Language**               | 12 UI languages and 22 TikTok site languages via the documented `default_lang` cookie, `Accept-Language` and `navigator.language`. Your choice survives restarts.                                                    |
| **🙂&nbsp; Chat stickers**          | Your PNG/GIF/WebP files go from the panel into the open TikTok chat as photos; a transparent background reads as a sticker.                                                                                          |
| **🧩&nbsp; Plugins**                | A separate manager with a catalog, per-plugin permissions, static security audit, Ed25519 signatures, tamper checks, logs, version rollback and opt-out auto-updates. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>. |
| **🧠&nbsp; It remembers**           | Window geometry, maximised state, zoom, mute, always-on-top and the last page you were on.                                                                                                                           |
| **🧯&nbsp; It survives**            | Failed loads retry with backoff, a crashed renderer is brought back, a hung page says so instead of dying silently.                                                                                                  |
| **⛶&nbsp; Real fullscreen**         | Fullscreen video takes the whole window and the title bar gets out of the way.                                                                                                                                       |

<div align="center">
  <img src="docs/findbar.png" width="820" alt="Find in page bar with a match counter under the title bar" />
  <br />
  <sub><i>Find in page: the content shrinks, it is never covered.</i></sub>
</div>

## Region & proxy

TikTok derives a lot from where a request comes from. The **Region** section in
the panel changes what the browser tells the site — `Accept-Language`, the
language in `navigator`, the `Intl`/`Date` timezone and geolocation coordinates —
and can route the session through a proxy you provide.

- Presets: Kazakhstan, Armenia, Georgia, Turkey, Serbia, UAE, Israel, USA,
  Germany, Netherlands, UK, Poland.
- The proxy field accepts `socks5://host:port`, `http://host:port` and
  `http://user:pass@host:port`. It applies to the whole TikTok session, including
  OAuth windows.
- **Check external IP** sends a request through the same session and proxy, so
  you can see the address and country TikTok is likely to see.
- **Reset site data** removes TikTok cookies, cache and storage after a
  confirmation. You will have to sign in again, and the site re-detects the
  region from the current IP.
- **The preset alone does not change your IP.** Without a proxy or a system-wide
  VPN, the site still sees your real address; the preset only aligns the browser
  signals with the country you picked.
- The app ships no proxy list and no VPN. Use your own endpoint and follow
  TikTok's terms.

## Language

The **Language** section in the feature panel and the matching menu contain two
independent choices:

- **UI language** — menus, feature panel, tray, dialogs and the plugin manager.
  Available: Russian, English, Spanish, Portuguese (Brazil), German, French,
  Turkish, Indonesian, Vietnamese, Japanese, Korean and Arabic. Arabic switches
  the layout to right-to-left.
- **TikTok language** — the language of the site itself. The client sets the
  documented `default_lang` cookie, overrides `Accept-Language` and the
  `navigator` language, then reloads the page. 22 site languages are available,
  including English, Russian, Spanish, Portuguese, German, French, Italian,
  Turkish, Indonesian, Vietnamese, Japanese, Korean, Arabic, Thai, Hindi, Polish,
  Dutch, Ukrainian, both Chinese variants, Malay and Filipino.
- **Auto (like on the site)** removes the `default_lang` cookie and lets the
  site and the region preset decide.
- If a TikTok account stores its own language, the site may keep it: choose the
  language in TikTok's own settings. The client does not bypass that or pretend
  the cookie is an account-level language change.

## Chat stickers

TikTok's web client has no sticker picker, so the app sends your images through
the site's own upload path: it puts the file into the chat's hidden file input
and clicks Send when the button appears.

- **Add stickers** — the feature panel (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>)
  → «Stickers» → «Add stickers…». PNG, JPG, WebP and GIF up to 8 MB.
- **Send** — open a conversation at `tiktok.com/messages`, then click a sticker
  in the panel or the command palette. It arrives as a regular photo.
- A **transparent PNG** looks like a sticker, but the recipient still sees a
  photo. That is a limitation of TikTok's web client, not of the app. Square
  images around 256–512 px look best.
- Files live in the profile's `stickers/` directory; the panel can open the
  folder or delete a sticker together with its file.

## Plugins

Plugins are small JavaScript packages that live in a sandboxed hidden window.
They can add palette commands, rows in the feature panel, settings, storage,
page CSS and isolated page scripts. Nothing else: no Node, no filesystem, no
direct network, no cookies, no navigation.

The **Plugins** manager (also <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>) has
a catalog, local `.octoplugin` installs, per-plugin permissions, security
reports, signature status, tamper detection and auto-updates that can be turned
off globally or per plugin.

Before installation the app validates the manifest and ZIP, runs a static audit
(Node, `eval`, direct network, cookies, native binaries, obfuscation), checks
SHA-256 and Ed25519 signatures, and shows every requested permission. Updates
that add permissions always require confirmation.

Developer guide: [docs/plugins/README.md](docs/plugins/README.md) ·
Publishing rules: [docs/plugins/PUBLISHING.md](docs/plugins/PUBLISHING.md) ·
Example: [plugins/examples/hello-octo](plugins/examples/hello-octo).

The same guide is built into the app: `npm run docs:build` generates
`src/renderer/plugins-docs`, and the Documentation / Publishing rules items open
it in a local window. The static output can also be opened in a browser or hosted
anywhere.

```bash
OCTO_PLUGIN_DEV_DIR="$PWD/plugins/examples" npm start
node scripts/pack-plugin.js plugins/examples/hello-octo \
  --out plugins/packages --update-registry plugins/registry.json
```

## Shortcuts

| Keys                                                                                                 | Action                                           |
| :--------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| <kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Alt</kbd>+<kbd>→</kbd>                                            | Back / forward                                   |
| <kbd>Ctrl</kbd>+<kbd>F</kbd>                                                                         | Find in page                                     |
| <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd>, <kbd>F3</kbd> / <kbd>Shift</kbd>+<kbd>F3</kbd> | Next / previous match                            |
| <kbd>Esc</kbd>                                                                                       | Close find, leave PiP, then leave fullscreen     |
| <kbd>Ctrl</kbd>+<kbd>R</kbd>                                                                         | Reload                                           |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>                                                        | Reload, bypassing cache                          |
| <kbd>F5</kbd>                                                                                        | Reload                                           |
| <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd>           | Zoom in / out / reset                            |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>                                                        | Mute / unmute                                    |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>                                                        | Picture-in-picture                               |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>←</kbd> / <kbd>→</kbd>                                         | Previous / next video                            |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>                                                        | Always on top                                    |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>                                                        | Plugin manager                                   |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>                                                        | DevTools                                         |
| <kbd>Ctrl</kbd>+<kbd>W</kbd> / <kbd>Ctrl</kbd>+<kbd>Q</kbd>                                          | Close window / quit                              |
| <kbd>F11</kbd>                                                                                       | Fullscreen                                       |
| Media keys                                                                                           | Play / pause, stop (mute), next / previous video |

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
    region.js      region presets, Accept-Language and proxy
    region-catalog.js  countries, locales and timezones
    region-preload.js  language/timezone/geolocation patches in the page
    store.js       JSON state in userData
    commands.js    the command table behind every button and shortcut
    pip.js         mini player, auto-advance and adaptive PiP sizing
    find.js        find in page
    shortcuts.js   before-input-event handling
    menu.js        app menu and context menu
    tray.js        tray icon and its menu
    updates.js     electron-updater
    hardening.js   webContents guards for popups and navigation
    links.js       handler for "open in the system browser"
    shared.js      constants and URL predicates
    preload.js     window.octo bridge for the title bar
    plugin-host-preload.js / plugins-manager-preload.js
                   capability bridge for plugins and the manager
    plugins/       plugin engine: manifest, ZIP, audit, installer, registry,
                   sandboxed hosts, manager window and auto-updates
  renderer/
    index.html     title bar + find bar markup
    styles.css     their styling
    titlebar.js    state, toasts, keyboard plumbing
    plugins.html / plugins.css / plugins.js
                   standalone plugin manager
    assets/
      tiktok-octo.png    source photo of the glass octopus
      octo-logo-mark.png mark only, transparent (title bar, narrow nav rail)
      octo-logo-full.png mark + tt-octo lockup (wide nav, header)
test/
  smoke.spec.js        Playwright smoke test
  plugins.spec.js      live plugin host, commands, panel and manager
  plugin-security.spec.js  manifest, audit, ZIP and signature tests
plugins/
  examples/hello-octo  sample plugin
  packages/            built .octoplugin files
  registry.json        sample catalog
docs/plugins/          developer guide, publishing rules, built-in docs
scripts/               pack-plugin.js, plugin-keygen.js, build-plugin-docs.js
build/
  icon.svg / icon.png / entitlements.mac.plist
```

The site does not live in a `<webview>` or an `<iframe>` — it runs in a separate
`WebContentsView` pinned under the title bar. Our UI is an ordinary Electron page;
TikTok's content is an isolated process with no Node and `sandbox: true`. Its only
preload is `region-preload.js`: it applies the selected region's language,
timezone and geolocation patches in the main world, exposes nothing to the page
and keeps `contextIsolation` on. The site cannot reach our interface, and we steer
it only through `webContents`. Permissions are an explicit allowlist (camera,
microphone, notifications, fullscreen, clipboard write, pointer lock) granted only
to `tiktok.com`; every other navigation goes to the system browser.

Plugins are deliberately _not_ loaded into that view. Each one gets a hidden
`BrowserWindow` with `sandbox: true`, `contextIsolation: true`, an ephemeral
session, a custom `octo-plugin://` origin, a strict CSP and all network requests
cancelled at the session level. The plugin sees only the frozen `window.octo`
bridge; main validates every call against the manifest permissions. Page CSS and
page scripts are executed against the site from main, the latter in an isolated
world with runtime scanning. Before anything reaches disk, the package is
validated, unpacked in memory, statically audited, hash-checked, signature-checked
and shown to the user with every permission.

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
- **Region patches** live in a sandboxed preload because `Intl` and `Date` read
  the system timezone directly and page scripts start before our renderer can
  intervene. The function is serialized into the main world before the site's
  own scripts run; it exposes nothing back to the page.

## Known limits

- On **Wayland** the compositor decides where the window goes and how big it is, so
  the saved geometry may be ignored. On X11, Windows and macOS it works as usual.
- **PiP** is our own mini player, so it does not need the desktop portal. On
  Wayland the compositor may still ignore window size and position. **Global
  media keys** do depend on the portal and may not work on some setups (the app
  tells you when it can).
- The tray needs **StatusNotifier** on Linux; without it the app simply runs
  without an icon.
- **Unread badges** appear where the desktop supports them (macOS dock, Unity
  launcher); the count is read from the page title, not from private requests.
- **Auto-update** works only for packaged builds published through GitHub
  Releases. Plugin auto-updates can be disabled globally or per plugin.
- **Plugins are JavaScript-only.** Native modules, WebAssembly and workers are
  rejected. A plugin with `page:script` shares the DOM with the site and can read
  visible page content — install only sources you trust. The catalog requires
  source links and signatures for the verified badge.
- **The plugin catalog** is a JSON file in this repository; without network access
  the manager shows the cached version and local installs still work.
- **Region presets** change browser-side signals only. Without your own proxy or
  a system-wide VPN, TikTok still sees your real IP address; the app bundles no
  proxy list and no VPN.
- Ads, recommendations and account limits are exactly like on the web — the
  client doesn't touch them.

## Legal

The app's code is MIT-licensed. TikTok, its logos and its content belong to
TikTok Ltd. This project is not affiliated with TikTok, does not parse private
endpoints, spoof signatures or bypass technical protections. Region presets only
align browser locale, timezone and geolocation; the optional proxy routes traffic
through an endpoint you choose. Your use of TikTok remains subject to their terms
and your local law. Do not publish builds in stores under someone else's name and
logo — for personal use there is nothing to worry about.

<div align="center">
  <sub>Made with glass, gradients and <code>WebContentsView</code>.</sub>
</div>
