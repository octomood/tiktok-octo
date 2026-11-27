<div align="center">
  <img src="docs/banner.png?v=2" width="880" alt="TikTok Octo — Material Design 3 Expressive desktop shell for tiktok.com" />
</div>

<div align="center">
  <a href="https://github.com/octomood/tiktok-octo/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/octomood/tiktok-octo/ci.yml?style=flat&labelColor=211d30&label=ci" /></a>
  <a href="https://github.com/octomood/tiktok-octo/releases"><img alt="Release" src="https://img.shields.io/github/v/release/octomood/tiktok-octo?style=flat&color=d0bcff&labelColor=211d30&label=release" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-8c84a9?style=flat&labelColor=211d30" /></a>
  <img alt="Design: MD3 Expressive" src="https://img.shields.io/badge/design-MD3%20Expressive-c5bddb?style=flat&labelColor=211d30" />
  <img alt="Electron" src="https://img.shields.io/badge/electron-45-564e70?style=flat&labelColor=211d30" />
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-linux%20%7C%20windows%20%7C%20macos-ddd2e0?style=flat&labelColor=211d30" />
  <img alt="No API, no scraping" src="https://img.shields.io/badge/no%20api-no%20scraping-8c84a9?style=flat&labelColor=211d30" />
</div>

<br />

<div align="center">
  <b>English</b> &nbsp;·&nbsp; <a href="README.ru.md">Русский</a>
</div>

<br />

**TikTok Octo** is an unofficial desktop client for TikTok: the official website,
login and all, wrapped in a thin native Electron shell styled with **Material
Design 3 Expressive**. No browser chrome, no tabs, no address bar — just a
52-pixel tonal pill title bar, **20 harmonious dark and light MD3 palettes**, a
floating mini player and desktop shortcuts that make sense.

> **Why a shell and not a "real" client?**
> TikTok gives third-party apps no access to the feed, the For You algorithm or
> publishing — there is no public API for that. The only route that doesn't break
> the rules is to render their own web client in a native window, which is exactly
> what this is: no private endpoint parsing, no signature spoofing, no protection
> bypass. A browser, shaped like an app.

<div align="center">
  <img src="docs/titlebar.png?v=2" width="820" alt="TikTok Octo MD3 Expressive title bar with scalloped flower mark, tonal navigation pill group, unread badge, feed layout switch and Settings pill" />
  <br />
  <sub><i>The 52 px MD3 Expressive title bar: scalloped brand mark, tonal navigation group, unread badge, playback &amp; feed-layout controls, Settings pill and window controls.</i></sub>
</div>

## What's inside

### Material Design 3 Expressive & Appearance

|                                       |                                                                                                                                                                                                                                                                |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🎨&nbsp; MD3 Expressive UI**        | Tonal pill containers, grouped rounded lists, spring motion physics, expressive sliders, custom dropdowns (`md3-select`) and wavy progress indicators across the title bar, Settings overlay, Plugin Manager, Download Manager, Annotator, Wizard and Updater. |
| **🌈&nbsp; 20 harmonious palettes**   | **Octo Lavender** (`#3e3854` / `#8c84a9` / `#ddd2e0`) by default plus 19 curated MD3 schemes (Iris &amp; Lilac, Sakura Blossom, Emerald Forest, Deep Ocean, Graphite, etc.), each with dark, light and **System** modes.                                       |
| **✨&nbsp; Material 3 on tiktok.com** | Tabs, buttons, navigation rail, search bar, cards, comments, chat, dialogs, Business Suite, subframes and Shadow DOM match your chosen MD3 palette. Switch back to stock TikTok anytime in **Settings → Tweaks**.                                              |
| **🔤&nbsp; Shell &amp; site fonts**   | **Google Sans Medium** by default in the shell, with presets, any system font by name, or your own `.ttf` / `.otf` / `.woff` / `.woff2` file; `Inter` is applied cleanly across site text without touching SVG icons.                                          |
| **💬&nbsp; Comments side panel**      | The video page's "You may like" column stays out of the way: the comment icon opens it, and a second click or <kbd>Esc</kbd> hides it again. Can be toggled in **Tweaks**.                                                                                     |
| **🏅&nbsp; Community badges**         | Animated MD3 vector badges next to usernames in profiles, feeds, comments, and chat. Clicking a badge opens an MD3 card with the role and description; synced from `src/main/badges.json` and toggleable in **Tweaks**.                                        |
| **♿&nbsp; Accessibility**            | Focus rings on every control, focus containment in dialogs and the command palette, `prefers-reduced-motion`, ARIA roles and an RTL Arabic layout.                                                                                                             |

### Shell, Player & Viewing

|                                         |                                                                                                                                                                                                                   |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🪟&nbsp; 52 px tonal title bar**      | Back / forward / reload / home, live page pill, unread count, quick playback &amp; tool groups and native window controls. Dragging and double-click to maximise come for free.                                   |
| **🔐&nbsp; Real login &amp; profiles**  | Persistent `persist:octo-tiktok` session on disk plus isolated **Account profiles** — create and switch between accounts without restarting. Google, Apple, Facebook and X OAuth windows open on top of the app.  |
| **🔎&nbsp; Find in page**               | <kbd>Ctrl</kbd>+<kbd>F</kbd> opens a compact tonal bar with a `1/3` counter. The page slides down instead of being covered; <kbd>Esc</kbd> closes it.                                                             |
| **🎬&nbsp; Picture-in-picture**         | Compact always-on-top mini player: auto-advance, previous/next, scrub bar with timecode and "−10 s", adaptive sizing for your screen. Toolbar button or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>.            |
| **📌&nbsp; Always on top &amp; Tray**   | Keep the feed above your work (survives restarts), or hide to tray, mute, pin, open PiP and enable "close to tray" to keep listening.                                                                             |
| **🔇&nbsp; Sound &amp; equalizer**      | Instant mute with a click, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> or media keys, 0–200 % volume slider, audio output picker, speech/music equalizer and mono mode for one earbud.                          |
| **⏯️&nbsp; Frame step &amp; A–B loop**  | Step frame-by-frame while paused (<kbd>,</kbd> / <kbd>.</kbd> or panel buttons), loop an A–B segment and keep playback speed locked between videos.                                                               |
| **🖼️&nbsp; Picture &amp; captions**     | Brightness, contrast, warm tone, sharpness and fit/fill. Captions toggle via the site's own button, while size, background and outline update without touching account settings.                                  |
| **🎞️&nbsp; Video quality**              | Real stream resolution and bitrate plus HEVC support. On Linux, experimental VA-API hardware decoding in **Player** enables H.265 HD after a restart on supported GPUs.                                           |
| **⏱️&nbsp; Sleep, focus &amp; ambient** | Sleep timer (15/30/60 min, end of video or N videos with fade-out), idle auto-pause + `powerSaveBlocker`, **Focus mode** (15/25/50/90 min + breaks) and distraction-free **Ambient** mode on a second monitor.    |
| **🔳&nbsp; QR &amp; bar-only remote**   | Local offline QR code for the current video, plus **Bar only** mode — a compact remote without the site (title, play/pause, volume, PiP).                                                                         |
| **⌨️&nbsp; Keyboard &amp; zoom**        | J / L seek 10 s, K / Space pause, 0–9 jump to percentage, S snapshot, ? hint. Remappable shortcuts with profiles and conflict highlights, browser-grade page zoom (50–300 %) and independent UI scale (80–150 %). |

### Chat, Library & Media

|                                           |                                                                                                                                                                                                   |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **💬&nbsp; Side chat**                    | "Messages" opens on the left and squeezes the feed by default: drag to resize (width is remembered) while the video keeps playing. Double-click opens the full messages page.                     |
| **🙂&nbsp; Chat stickers &amp; replies**  | Send your PNG/GIF/WebP files into an open TikTok chat (including Business Suite) as photos — transparent backgrounds read like stickers. Insert saved **Quick replies** from the command palette. |
| **🔔&nbsp; Notifications**                | Native notification when the unread count in the page title grows; clicking opens "Messages". Includes "Do not disturb" schedule and "quiet while window is active".                              |
| **📚&nbsp; Library, history &amp; notes** | Bookmarks with timecode and note, watch-later queue, searchable **Watch history**, local **Creator notes &amp; tags**, and Markdown/JSON export.                                                  |
| **📊&nbsp; Statistics &amp; archive**     | Local daily/weekly watch time, video count and top authors (never sent anywhere), plus a one-file **My archive** ZIP with bookmarks, stats, settings and stickers.                                |
| **⬇️&nbsp; Downloads &amp; audio**        | Save via dialog or `{author}-{date}-{title}` template with per-author folders. Queue manager tracks progress, concurrency limit and pause, and can extract audio tracks via system `ffmpeg`.      |
| **✂️&nbsp; Snapshot &amp; GIF export**    | Snapshots open an MD3 annotator (arrow, rectangle, blur) and save PNG to Pictures + clipboard. Local **GIF export** encodes 3–10 s clips (5–15 fps, 320–640 px) completely offline.               |

### Plugins, Network & Privacy

|                                        |                                                                                                                                                                                                                                                                                                          |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🧩&nbsp; Sandboxed plugins**         | Modal **Plugins** manager (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>): local `.octoplugin` installs, permissions, static audit, embedded Ed25519 `SIGNATURE.json`, tamper checks, logs and rollback. SDK with types/mock, ES modules and hot reload. [t.me/octo_plugins](https://t.me/octo_plugins). |
| **🧪&nbsp; Custom code &amp; filters** | Optional isolated page CSS/JS (off by default with warning and one-click kill switch), plus content filters by words, hashtags and authors.                                                                                                                                                              |
| **🌐&nbsp; Region, proxy &amp; DPI**   | 12 country presets (`Accept-Language`, `navigator.language`, timezone, geolocation), SOCKS5/HTTP proxy + local VPN proxy discovery, connection latency test and experimental **DPI bypass** (DNS-over-HTTPS + TLS ClientHello SNI splitting).                                                            |
| **🗣️&nbsp; Language**                  | 12 UI languages (including RTL Arabic) and 22 TikTok site languages via documented `default_lang` cookie, `Accept-Language` and `navigator.language`.                                                                                                                                                    |
| **💾&nbsp; Backups &amp; resilience**  | JSON settings export/import (no cookies/chats/passwords), 8 daily auto-backups, backoff retries, renderer crash recovery, safe mode after 2 crashes, battery saver and GitHub Releases self-updater.                                                                                                     |
| **🛡️&nbsp; Privacy**                   | Clear breakdown of local storage with per-item deletion, sanitized diagnostics without paths or tokens, license list and an honest "not affiliated with TikTok" notice.                                                                                                                                  |

The **Settings** overlay opens from the title-bar pill or with
<kbd>Ctrl</kbd>+<kbd>,</kbd> (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>)
over the feed: grouped sections live in the left rail for one-click switching,
setting cards sit on the right, and header search filters every section at once.

<div align="center">
  <img src="docs/settings.png" width="820" alt="TikTok Octo MD3 Expressive Settings overlay with grouped navigation rail, search bar, and 20 harmonious color palettes" />
  <br />
  <sub><i>Settings overlay in Material Design 3 Expressive: grouped rail, instant search, theme modes and 20 color palettes.</i></sub>
</div>

<br />

<div align="center">
  <img src="docs/findbar.png?v=2" width="820" alt="TikTok Octo MD3 Expressive find bar with match counter below the 52 px title bar" />
  <br />
  <sub><i>Find in page: the content shrinks smoothly below the tonal search bar, never covered.</i></sub>
</div>

## Region & proxy

TikTok derives a lot from where a request comes from. The **Region** section in
Settings changes what the browser tells the site — `Accept-Language`, the
language in `navigator`, the `Intl`/`Date` timezone and geolocation coordinates —
and can route the session through a proxy you provide.

On first launch an MD3 **setup wizard** opens: pick the interface language, flip
the “Use a proxy” switch or enable the experimental DPI bypass. You can skip it
and reopen it later from the Region section or the command palette.

- Presets: Kazakhstan, Armenia, Georgia, Turkey, Serbia, UAE, Israel, USA,
  Germany, Netherlands, UK, Poland.
- The proxy field accepts `socks5://host:port`, `http://host:port` and
  `http://user:pass@host:port`. It applies to the whole TikTok session, including
  OAuth windows.
- The proxy login and password are used only by the live profile: settings
  export, backups and “my archive” get the address without them. After a move or
  restore, enter the password again. In the profile the password is encrypted
  when the system provides a key store; otherwise the file is closed to other
  users (`0600`).
- **Find a local proxy** checks the usual ports of already running clients:
  v2ray/Xray (10808, 10809), Clash/Mihomo (7890, 7891, 7897), Tor (9050), Privoxy
  (8118) and SOCKS5 (1080). A found address is verified with a real external IP
  request through that proxy. The app downloads nothing and ships no third-party
  servers: you need an installed and running VPN client.
- **DPI bypass (experimental)** — a mode without proxy, VPN or third-party
  servers: the local proxy resolves domains over **DNS-over-HTTPS** and splits
  the TLS `ClientHello` into valid TLS records inside the SNI so a network
  filter cannot read the hostname. The connection goes straight to TikTok and
  turns on by itself on the next launch. It helps only when a domain is blocked
  by name: if TikTok is unreachable by IP or restricted for your region, you need
  a proxy or VPN.
- **Check external IP** and **Connection test** run through the active session
  and proxy/DPI mode, showing latency and the IP/country TikTok sees.
- **Reset site data** removes TikTok cookies, cache and storage after a
  confirmation. You will have to sign in again, and the site re-detects the
  region from the current IP.
- **The preset alone does not change your IP.** Without a proxy or a system-wide
  VPN, the site still sees your real address; the preset only aligns the browser
  signals with the country you picked.
- The app ships no proxy list and no VPN. Use your own endpoint and follow
  TikTok's terms.

## Language

The **Language** section in Settings and the matching menu contain two
independent choices:

- **UI language** — menus, Settings overlay, tray, dialogs and the plugin
  manager. Available: Russian, English, Spanish, Portuguese (Brazil), German,
  French, Turkish, Indonesian, Vietnamese, Japanese, Korean and Arabic. Arabic
  switches the layout to right-to-left.
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

## Images in chat

TikTok's web client does not let you add your own image to its sticker set, so
the app sends it through the site's own upload path: it puts the file into the
chat's file input and clicks Send when the button appears. For the recipient it
is a regular photo, not a native TikTok sticker.

- **Images menu** — the smiley button in the title bar. It opens on its own and
  scrolls through as many images as you have.
- **Add images** — the «+» in the menu, View → Images in chat, or the command
  palette. PNG, JPG, WebP and GIF up to 8 MB.
- **Send** — open a conversation at `tiktok.com/messages` or in the side chat
  panel, then click an image in the menu or the command palette.
- **Business Suite and nested frames** — the message composer is located in every
  frame and open or closed shadow root, and the attachment button is clicked with
  a trusted input event, so sending also works in Business Suite.
- A **transparent PNG** looks like a sticker, but the recipient sees a photo.
  Square images around 256–512 px look best.
- **Photos in direct messages are not available in every region.** If the
  recipient's TikTok does not have this feature, the photo will not be displayed;
  the app detects that error and reports it. The client cannot work around this:
  it uses TikTok's own upload.
- Files live in the profile's `stickers/` directory; the menu can open the folder
  or delete an image together with its file.

## TikTok stickers

The **«TikTok stickers»** button in the images menu opens the site's native
sticker panel. From there you can send real TikTok stickers: they do not depend
on regional availability of photos in direct messages. Your own PNGs cannot be
added to that panel — the site does not allow it without a private API.

## Side chat

Messages do not have to take the whole window on desktop. A single click on
«Messages» in TikTok's sidebar or header opens a panel on the left: by default
it squeezes the feed and the video keeps playing. The panel shares the main
window's session, so sign-in, theme and conversations are already there.

- **Width** — when opened, the panel fits itself to the messages page (up to
  980 px) so the conversation list, messages and the input are not clipped; when
  docked, the feed keeps at least 320 px. Opening a conversation inside the page
  fits the panel again. You can still drag the handle; double-click it to reset
  to 420 px.
- **Dock** — the "Chat squeezes the feed" switch; turning it off brings back the
  old behaviour where the panel floats over the feed.
- **Double-click** on «Messages» (or a second click in a row) opens the regular
  messages page in the whole window.
- **Close the panel** with the speech-bubble button in the title bar,
  <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> or <kbd>Esc</kbd>.
- **Theme, font and cosmetics** — the same rules apply to the panel as to the
  feed: MD3 Expressive palette, light/dark theme, typography and hidden app
  promos. Toggles in Tweaks affect the side chat too.
- The site's global navigation and header are hidden inside the panel:
  otherwise only a narrow strip would remain for the conversation list. Links
  from a conversation to other TikTok pages open in the main window, external
  links go to the system browser.
- **Limitation**: this is the same TikTok web client, not a separate chat. If
  the site changes the messages layout, the panel shows what the site renders;
  there are no private requests and no bypassing protections.

## Plugins

Plugins are small JavaScript packages (CommonJS or ES modules with `module: true`)
that live in a sandboxed hidden window. They can add palette commands,
dynamically updatable panel rows, settings (`color`, `textarea`, `secret`,
`action`), storage (`keys` / `usage`), interactive dialogs (`ui.confirm`,
`ui.prompt`, `ui.pick`), playback &amp; theme listeners, named page CSS and
isolated page scripts. Nothing else: no Node, no filesystem, no direct network
or cookies; navigation is limited to TikTok pages and needs the `navigation`
permission.

The **Plugins** manager (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>) opens as
an MD3 Expressive overlay with local `.octoplugin` installs, per-plugin
permissions, security reports, embedded Ed25519 `SIGNATURE.json` verification,
tamper detection, logs, DevTools for dev plugins and rollback. The "All plugins"
tab links to the Telegram channel [t.me/octo_plugins](https://t.me/octo_plugins):
download a package there and install it with **Install from file**. The puzzle
button in the title bar opens a quick popover of enabled plugins and runs their
actions without opening Settings.

Before installation the app validates the manifest and ZIP, runs a static audit
(Node, `eval`, direct network, cookies, native binaries, obfuscation), checks
SHA-256 and Ed25519 signatures, and shows every requested permission and network
host. When updating from a file, the dialog lists added permissions and hosts and
warns about downgrades. The publisher is remembered on first install (the signing
key, or the author name for unsigned plugins): if a package with the same `id`
comes from a different publisher, it needs a separate confirmation and does not
receive the old version's settings, storage or secrets.

Developer guide: [docs/plugins/README.md](docs/plugins/README.md) ·
Publishing rules: [docs/plugins/PUBLISHING.md](docs/plugins/PUBLISHING.md) ·
Example: [plugins/examples/hello-octo](plugins/examples/hello-octo).
Ready-made plugins: [plugins/shelf](plugins/shelf) (local bookmarks with hotkeys
and an on-page badge) and [plugins/gradient-frame](plugins/gradient-frame)
(configurable animated border).

The same guide is built into the app: `npm run docs:build` generates
`src/renderer/plugins-docs`, and the Documentation / Publishing rules items open
it in a local window. The static output can also be opened in a browser or hosted
anywhere.

```bash
OCTO_PLUGIN_DEV_DIR="$PWD/plugins/examples" npm start
node scripts/pack-plugin.js plugins/examples/hello-octo \
  --out plugins/packages --update-registry plugins/registry.json
```

## Links and system menus

The `tiktok-octo://` scheme opens a video in the app:

```bash
xdg-open 'tiktok-octo://www.tiktok.com/@author/video/123'
```

`tiktok-octo://open?url=https%3A%2F%2Fwww.tiktok.com%2F...` works too, as does
a regular `https://www.tiktok.com/...` link passed as a launch argument. Other
hosts are rejected.

The task menu — Windows jump list, macOS dock menu and Linux launchers — offers
Picture-in-Picture, Messages and Mute. The app icon shows download progress, and
MPRIS exposes cover art and seeking.

The OS does not allow claiming `https://` for a single domain, but on Linux
the Application panel has an "Open TikTok links in client" toggle: the app
registers as the system `http`/`https` handler, intercepts `tiktok.com` links
(including `vm.tiktok.com` and `vt.tiktok.com`), and forwards all other URLs to
your previous default browser without raising the client window. To open from a
browser without changing the system handler, use the `tiktok-octo://` scheme.

## Shortcuts

| Keys                                                                                                 | Action                                           |
| :--------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| <kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Alt</kbd>+<kbd>→</kbd>                                            | Back / forward                                   |
| <kbd>Ctrl</kbd>+<kbd>F</kbd>                                                                         | Find in page                                     |
| <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd>, <kbd>F3</kbd> / <kbd>Shift</kbd>+<kbd>F3</kbd> | Next / previous match                            |
| <kbd>Esc</kbd>                                                                                       | Close overlay, find, leave PiP, leave fullscreen |
| <kbd>Ctrl</kbd>+<kbd>R</kbd>                                                                         | Reload                                           |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>                                                        | Reload, bypassing cache                          |
| <kbd>F5</kbd>                                                                                        | Reload                                           |
| <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd>           | Zoom in / out / reset                            |
| <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                         | Command palette                                  |
| <kbd>Ctrl</kbd>+<kbd>,</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>                         | Settings                                         |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>                                                        | Side chat                                        |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>                                                        | Mute / unmute                                    |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>                                                        | Picture-in-picture                               |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>←</kbd> / <kbd>→</kbd>                                         | Previous / next video                            |
| <kbd>J</kbd> / <kbd>L</kbd>                                                                          | Seek 10 seconds back / forward                   |
| <kbd>K</kbd> / <kbd>Space</kbd>                                                                      | Pause / resume                                   |
| <kbd>,</kbd> / <kbd>.</kbd>                                                                          | Step one frame back / forward (while paused)     |
| <kbd>0</kbd>–<kbd>9</kbd>                                                                            | Jump to 0–90 % of the video                      |
| <kbd>S</kbd> / <kbd>?</kbd>                                                                          | Screenshot / keyboard hint                       |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd>                                                        | Open the current page in your browser            |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>                                                        | Always on top                                    |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>                                                        | Plugin manager                                   |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>                                                        | DevTools                                         |
| <kbd>Ctrl</kbd>+<kbd>W</kbd> / <kbd>Ctrl</kbd>+<kbd>Q</kbd>                                          | Close window / quit                              |
| <kbd>F11</kbd>                                                                                       | Fullscreen                                       |
| Media keys                                                                                           | Play / pause, stop (mute), next / previous video |

On macOS use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>. Everything except
<kbd>Esc</kbd>, media keys and the keyboard feed can be remapped in **Keys**:
standard, compact and custom profiles, with conflicts highlighted.

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
(source: `build/icon.svg`).

Pushing a `v*` tag triggers `.github/workflows/release.yml`: it builds all three
platforms and publishes the artifacts to GitHub Releases, which is also what the
in-app updater reads.

## Development

```bash
npm run lint          # eslint
npm run format:check  # prettier
npm test              # Playwright tests on the real Electron app
npm run install:local # AppImage from the working tree + app-menu entry
```

`npm run install:local` builds a fresh version from the current files and updates
the “TikTok Octo (локальная сборка)” item in the app menu, so changes can be
checked without starting the app from a terminal. It publishes nothing; if the
app is already running, quit it first or the old instance will be focused.
OpenCode agents are not allowed to launch the app or Playwright by hand
(`opencode.json`): UI is verified by tests, and the build lands in the menu with
the same command.

The test suite launches the app with a temporary profile and `about:blank` as the
home page, so it touches neither your session nor the network. On Linux `npm test`
re-launches itself under `Xvfb` (`scripts/run-tests.js`), so no app windows pop up
over your work; CI does the same. To watch the test run on a real display use
`OCTO_TEST_WINDOW=1 npm test`.

<details>
<summary>Project structure &amp; architecture notes</summary>

```
src/
  main/
    main.js            app lifecycle, IPC, media keys, single-instance lock
    app-context.js     shared window state and the main → title bar bridge
    window.js          BrowserWindow, geometry, close-to-tray
    view.js            WebContentsView with the site, history, retries, fullscreen
    chat.js            side chat panel over the feed
    session.js         persistent session, permissions, downloads
    profiles.js        isolated multi-account profiles
    md3-palettes.js    20 harmonious MD3 Expressive palettes (dark + light)
    md3-site.js        Material Design 3 Expressive skin for tiktok.com
    cosmetics.js       site tweaks, typography, feed layout, comments panel
    region.js          region presets, Accept-Language, proxy & network test
    dpi-bypass.js      experimental DoH + TLS SNI splitting proxy
    region-catalog.js  countries, locales and timezones
    region-preload.js  language/timezone/geolocation patches in the page
    player.js          frame step, A–B loop, speed lock, equalizer, quality
    library.js / history.js / creator-notes.js
                       bookmarks, watch history and local author notes
    store.js           JSON state in userData
    commands.js        command table behind every button and shortcut
    pip.js             mini player, auto-advance and adaptive PiP sizing
    find.js            find in page
    shortcuts.js       before-input-event handling
    menu.js / tray.js  app menu, context menu and tray icon
    updates.js         electron-updater
    hardening.js       webContents guards for popups and navigation
    links.js / link-handler.js
                       external browser routing & Linux http/https handler
    shared.js          constants and URL predicates
    preload.js         window.octo bridge for the title bar
    plugin-host-preload.js / plugins-manager-preload.js
                       capability bridge for plugins and the manager
    plugins/           plugin engine: manifest, ZIP, audit, installer, registry,
                       sandboxed hosts, manager window and auto-updates
  renderer/
    index.html         title bar, find bar and Settings overlay markup
    styles.css         MD3 Expressive styling, tokens and spring curves
    md3-select.js      accessible MD3 Expressive dropdown component
    theme-sync.js      theme/palette sync across shell and child windows
    titlebar.js        state, toasts, keyboard plumbing
    plugins.html / plugins.css / plugins.js
                       MD3 Expressive plugin manager
    assets/
      tiktok-octo.png    brand mark source (flower badge and note)
      octo-logo-mark.png mark only, transparent (title bar, narrow nav rail)
      octo-logo-full.png mark + tt-octo lockup (wide nav, header)
      md3-scallop.svg / md3-wave.svg
                         MD3 Expressive scallop and wave shapes
test/
  smoke.spec.js          Playwright smoke test
  md3-site.spec.js       MD3 Expressive site skin & theme tests
  new-features.spec.js   profiles, creator notes, sticky speed & 20 palettes
  plugins.spec.js        live plugin host, commands, panel and manager
  plugin-shelf.spec.js   “Shelf” plugin: bookmarks, badge and clearing
  plugin-security.spec.js  manifest, audit, ZIP and signature tests
plugins/
  examples/hello-octo    sample plugin
  shelf/                 ready-made “Shelf” plugin: local bookmarks
  gradient-frame/        ready-made “Gradient Frame” cosmetic plugin
  packages/              built .octoplugin files
  registry.json          sample catalog
docs/plugins/            developer guide, publishing rules, built-in docs
scripts/                 pack-plugin.js, plugin-keygen.js, build-plugin-docs.js
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

</details>

## Known limits

- On **Wayland** the compositor decides where the window goes and how big it is, so
  the saved geometry may be ignored. On X11, Windows and macOS it works as usual.
- **PiP** is our own mini player, so it does not need the desktop portal. On
  Wayland the compositor may still ignore window size and position. **Global
  media keys** do depend on the portal and may not work on some setups (the app
  tells you when it can).
- **Volume above 100 %**, the equalizer and mono go through Web Audio. They work
  for videos the site plays from its own origin (`blob:`) or with CORS enabled.
  When a video comes straight from another domain, the app keeps the normal
  volume and says so — otherwise Chromium would output silence.
- **Video quality** is set by TikTok itself: the web player serves H.264 at no
  more than 540p, while the HD variants are H.265. On Linux you can try to enable
  them with the "Hardware decoder" switch in **Player** (a restart is required):
  it needs a GPU and driver with VA-API, and if frames freeze, turn it back off.
  On Windows and macOS the system decoder works without this setting.
  Sharpness emphasises the edges of the received frame; it does not raise the
  resolution.
- **Captions and the publish date** depend on TikTok's markup: the app looks for
  the caption button and the date by signals the site may change. Without that
  signal captions are not toggled blindly and the date stays empty.
- **"Bar only" mode** keeps the site loaded: sound continues, but video is not
  drawn until the window returns to the normal mode.
- **Notifications** rely on the unread count in the page title: the type
  (message, like, comment) cannot be told apart, so the notification says
  "something new" and clicking it opens «Messages».
- **Files dropped on chat** are sent only from the «Messages» panel and only as
  photos (PNG/JPG/WebP/GIF up to 8 MB); the site's own uploader is not touched.
- **Quick replies** only insert text into the field; sending and edits are yours.
- **Library, history, notes, queue and statistics** live in the app's local
  state: no cross-device sync, moving them means exporting.
- **Auto-advance** works only for items opened from the queue; if the site
  switches the video on its own, the queue does not follow.
- **Focus mode** counts real playback only: nothing accumulates while paused or
  during a break. The overlay clears after the break or with <kbd>Esc</kbd>.
- **Ambient** without a second monitor stays on the current one: it just hides
  the interface and the sound.
- **The archive** is a snapshot at export time; restoring from it is not there yet.
- **The file-name template** uses the download date when the site does not
  expose the publish date.
- **Content filters** only look at the visible DOM: TikTok markup changes can
  break a rule, and preloaded videos are not checked.
- **The download manager** shows the current session only: the list is empty
  after a restart while the files stay on disk. Audio extraction requires a
  system `ffmpeg` binary in `PATH`.
- **Annotations** are an arrow, a rectangle and blur; there is no text or shape
  set yet.
- **Custom JavaScript** runs in an isolated world: the site's JS is out of
  reach, but the DOM is shared, so the code can change or break the feed. Only
  enable your own trusted code.
- **GIF** covers up to 10 seconds and 60 frames, without sound; if the browser
  refuses to expose frames of a protected video, the export says so.
- The tray needs **StatusNotifier** on Linux; without it the app simply runs
  without an icon.
- **Unread badges** appear where the desktop supports them (macOS dock, Unity
  launcher); the count is read from the page title, not from private requests.
- **Auto-update** works only for packaged builds published through GitHub
  Releases. On launch the app checks for a new release and offers to update; the
  window can be closed, and after consent the download runs in the background.
  When the download finishes the app asks to restart. The offer appears again on
  the next launch until the update is installed. Plugins do not auto-update:
  download a new version from the Telegram channel and install the file.
- **Plugins are JavaScript-only.** Native modules, WebAssembly and workers are
  rejected. A plugin with `page:script` shares the DOM with the site and can read
  visible page content — install only sources you trust. Publishing requires
  source links and signatures for the verified badge.
- **Plugins are distributed through the Telegram channel**
  [t.me/octo_plugins](https://t.me/octo_plugins). There is no built-in catalog or
  background update check; installing from a file works offline.
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
  <sub>Made with Material Design 3 Expressive, tonal surfaces and <code>WebContentsView</code>.</sub>
</div>
