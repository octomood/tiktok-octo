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

|                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🪟&nbsp; A title bar of its own** | Back / forward / reload / home, a live page pill, unread count, native window buttons. Dragging and double-click to maximise come for free.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **🔐&nbsp; Real login**             | A persistent `persist:octo-tiktok` session on disk — you stay signed in between launches. Google, Apple, Facebook and X OAuth windows open on top of the app.                                                                                                                                                                                                                                                                                                                                                                                                                |
| **🔎&nbsp; Find in page**           | <kbd>Ctrl</kbd>+<kbd>F</kbd> opens a compact bar with a `1/3` counter. The page slides down instead of being covered; <kbd>Esc</kbd> closes it.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **🎬&nbsp; Picture-in-picture**     | A compact always-on-top mini player: auto-advance, previous/next, a scrub bar with timecode and a "−10 seconds" button, adaptive sizing for your screen. Toolbar button or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>.                                                                                                                                                                                                                                                                                                                                                    |
| **📌&nbsp; Always on top**          | Keep the feed above your work while you pretend to work. The mode survives restarts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **🔇&nbsp; Sound & volume**         | Instant mute with a click, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> or a media key, plus a 0–200 % volume slider in the Playback panel, audio output selection, speech/music equalizer and mono for one earbud.                                                                                                                                                                                                                                                                                                                                                         |
| **⏱️&nbsp; Sleep timer**            | 15/30/60 minutes, "until the video ends" or "stop after N videos" with a smooth fade-out. The countdown survives restarts.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **⌨️&nbsp; Keyboard**               | J / L seek 10 seconds, K and space pause, 0–9 jump to a percentage, S takes a screenshot, ? shows the hint. Every command can be remapped with profiles and conflict highlighting.                                                                                                                                                                                                                                                                                                                                                                                           |
| **😴&nbsp; Auto-pause**             | No input for N minutes pauses the video; coming back resumes it. "Keep screen awake" holds the display on with `powerSaveBlocker`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **🖼️&nbsp; Picture & captions**     | Brightness, contrast, warm tone, sharpness and fit/fill for the video. Captions are turned on by the site's own button; size, background and outline change without touching account settings.                                                                                                                                                                                                                                                                                                                                                                               |
| **🎞️&nbsp; Video quality**          | The actual resolution and bitrate of the stream, plus HEVC support. On Linux, hardware decoding is an experimental switch in the «Player» section — after a restart and only if the GPU supports H.265.                                                                                                                                                                                                                                                                                                                                                                      |
| **🔳&nbsp; QR & mini bar**          | The current video's QR code is built locally, with no external services. "Bar only" mode is a compact remote without the site: title, play/pause, volume and PiP.                                                                                                                                                                                                                                                                                                                                                                                                            |
| **🗂&nbsp; Tray**                    | Hide the window, mute, pin, PiP, or enable "close to tray" and keep listening.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **⬇️&nbsp; Downloads**              | Files go through the dialog or a `{author}-{date}-{title}` template with a per-author folder. A separate manager window shows progress, a simultaneous limit, pause, the queue and "show in folder".                                                                                                                                                                                                                                                                                                                                                                         |
| **✂️&nbsp; Annotated snapshot**     | A snapshot opens an editor with an arrow, rectangle and blur; the PNG is saved to Pictures and copied to the clipboard, with a small "tiktok octo" label in the corner.                                                                                                                                                                                                                                                                                                                                                                                                      |
| **🎞️&nbsp; GIF from video**         | A 3–10 second fragment from the current second: 5–15 fps and 320–640 px wide. Encoded locally, with no external services.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **🧪&nbsp; Custom code**            | Advanced mode: your own CSS and JavaScript for the page. Off by default, warns when enabled and turns off with one button.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **🚫&nbsp; Content filters**        | Hide by words, hashtags and authors: a match in the visible DOM advances the feed like ad skipping does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **🔄&nbsp; Self-updating**          | Packaged builds check GitHub Releases and offer to restart when the update is ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **🔍&nbsp; Browser-grade zoom**     | Chromium steps from 50 to 300 %, remembered across restarts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **🔠&nbsp; Interface scale**        | The title bar, panel and dialogs scale independently from the site: 80–150 %. Page zoom stays on <kbd>Ctrl</kbd>+<kbd>+</kbd> and <kbd>Ctrl</kbd>+<kbd>−</kbd>.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **⌨️&nbsp; Accessibility**          | Focus rings on every button and field, focus containment in the command palette, `prefers-reduced-motion`, ARIA roles and an RTL Arabic layout.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **🌍&nbsp; Links stay polite**      | Anything that isn't `tiktok.com` opens in your system browser. TikTok links with `target=_blank` stay inside the app.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **🌐&nbsp; Region & proxy**         | Pick a country to change `Accept-Language`, `navigator.language`, timezone and geolocation. Bring your own SOCKS5/HTTP proxy to change the actual IP.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **🗣️&nbsp; Language**               | 12 UI languages and 22 TikTok site languages via the documented `default_lang` cookie, `Accept-Language` and `navigator.language`. Your choice survives restarts.                                                                                                                                                                                                                                                                                                                                                                                                            |
| **🙂&nbsp; Chat stickers**          | Your PNG/GIF/WebP files go from the quick menu into the open TikTok chat as photos, including Business Suite; a transparent background reads as a sticker.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **💬&nbsp; Side chat**              | «Messages» opens as a panel on the left that squeezes the feed by default: drag the handle to resize, the width is remembered, and the video keeps playing. Double-click opens the regular messages page.                                                                                                                                                                                                                                                                                                                                                                    |
| **🔔&nbsp; Notifications**          | A native notification when the unread count in the page title grows; clicking opens «Messages». «Do not disturb» schedule and «no notifications while the window is active».                                                                                                                                                                                                                                                                                                                                                                                                 |
| **⚡&nbsp; Quick replies**          | Your templates go from the command palette into the open chat's message field — you decide whether to send.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **📚&nbsp; Library**                | Bookmarks with a timecode and a note, search, jump to the saved second, Markdown/JSON export, plus a "watch later" queue.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **📊&nbsp; Statistics**             | Time and video count for today and the week, top authors. Counted locally and never sent anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **🎯&nbsp; Focus mode**             | A 15/25/50/90-minute viewing limit and a 3/5/10-minute break: the feed dims and pauses, then comes back. <kbd>Esc</kbd> turns it off.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **🖥️&nbsp; Ambient**                | The feed on another monitor with no sound and no UI: just video. <kbd>Esc</kbd> restores the window and sound.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **🗄️&nbsp; My archive**             | A ZIP with bookmarks, statistics, settings and stickers — one file on disk, nothing sent anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **🌙&nbsp; Dark theme everywhere**  | TikTok theme cookies are written for the whole domain, and Chromium auto dark mode covers Business Suite and service pages, so no white TikTok pages remain.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **🔤&nbsp; Shell font on the site** | Inter is applied to all site text, including nested frames and web components in shadow DOM. SVG icons are left untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **💬&nbsp; Comments side panel**    | The video page's “You may like” column no longer takes space: the comment icon opens it, and a second click or <kbd>Esc</kbd> hides it again. Can be turned off in “Tweaks”.                                                                                                                                                                                                                                                                                                                                                                                                 |
| **🧩&nbsp; Plugins**                | A separate manager with local `.octoplugin` installs, permissions, static audit, Ed25519 signatures, tamper checks, logs and rollback. Plugins are published in the Telegram channel [t.me/octo_plugins](https://t.me/octo_plugins). Developers get an SDK with types and a mock, a generator and hot reload. Cosmetic packs are CSS-only plugins with preview and rollback. Plugins can show system notifications with the `os:notify` permission. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>. Local installs work offline; updates are installed from downloaded files. |
| **💾&nbsp; Settings and backups**   | Export and import settings as one JSON file, a daily state backup on launch (last 8) and one-click restore. Cookies, chats and passwords never go into the files.                                                                                                                                                                                                                                                                                                                                                                                                            |
| **🛡️&nbsp; Privacy**                | A privacy panel shows how much local data takes, deletes it item by item, copies diagnostics without paths or tokens, and lists licenses with an honest "not affiliated with TikTok" page.                                                                                                                                                                                                                                                                                                                                                                                   |
| **🧠&nbsp; It remembers**           | Window geometry, maximised state, zoom, mute, always-on-top and the last page you were on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **🧯&nbsp; It survives**            | Failed loads retry with backoff, a crashed renderer is brought back, a hung page says so instead of dying silently. Two crashes bring safe mode, the white screen becomes "No connection", and battery power enables saver mode.                                                                                                                                                                                                                                                                                                                                             |
| **⛶&nbsp; Real fullscreen**         | Fullscreen video takes the whole window and the title bar gets out of the way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

The **Functions** panel opens from the labelled title-bar button or
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>: sections are grouped by topic,
open as a subpage with a Back button, and search covers every setting at once.

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

On first launch a **setup wizard** opens: pick the interface language, flip the
“Use a proxy” switch or enable the experimental DPI bypass. You can skip it and
reopen it later from the Region section or the command palette.

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
  servers: the app sends the TLS handshake in tiny packets, like
  Zapret/GoodbyeDPI, so a network filter cannot see the whole site name. The
  connection goes straight to TikTok and turns on by itself on the next launch.
  It helps only when the site is blocked by name: if TikTok is unreachable by
  IP, the mode will not help — you need a proxy or VPN then.
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
  feed: dark theme, Inter, dark scrollbars and hidden app promos. Toggles in
  the feature panel affect the side chat too.
- The site's global navigation and header are hidden inside the panel:
  otherwise only a narrow strip would remain for the conversation list. Links
  from a conversation to other TikTok pages open in the main window, external
  links go to the system browser.
- **Limitation**: this is the same TikTok web client, not a separate chat. If
  the site changes the messages layout, the panel shows what the site renders;
  there are no private requests and no bypassing protections.

## Plugins

Plugins are small JavaScript packages that live in a sandboxed hidden window.
They can add palette commands, rows in the feature panel, settings, storage,
page CSS and isolated page scripts. Nothing else: no Node, no filesystem, no
direct network or cookies; navigation is limited to TikTok pages and needs the
`navigation` permission.

The **Plugins** manager (also <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>) has
local `.octoplugin` installs, per-plugin permissions, security reports,
signature status, tamper detection, logs and rollback. The "All plugins" tab
links to the Telegram channel [t.me/octo_plugins](https://t.me/octo_plugins):
download the package there and install it with **Install from file**. The puzzle
button next to the sticker menu opens a quick list of enabled plugins and runs
their actions without opening the feature panel.

Before installation the app validates the manifest and ZIP, runs a static audit
(Node, `eval`, direct network, cookies, native binaries, obfuscation), checks
SHA-256 and Ed25519 signatures, and shows every requested permission. Updates
that add permissions always require confirmation.

Developer guide: [docs/plugins/README.md](docs/plugins/README.md) ·
Publishing rules: [docs/plugins/PUBLISHING.md](docs/plugins/PUBLISHING.md) ·
Example: [plugins/examples/hello-octo](plugins/examples/hello-octo).
The first ready-made plugin: [plugins/shelf](plugins/shelf) — local bookmarks with
hotkeys, a context-menu item and an on-page badge.

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

A direct `https://` handler cannot be claimed: browsers and the OS do not hand
that protocol to a third-party app. For links clicked in a browser, use a
shortcut or an extension that opens `tiktok-octo://`.

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
| <kbd>J</kbd> / <kbd>L</kbd>                                                                          | Seek 10 seconds back / forward                   |
| <kbd>K</kbd> / <kbd>Space</kbd>                                                                      | Pause / resume                                   |
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
<kbd>Esc</kbd>, media keys and the keyboard feed can be remapped in the
**Keys** section: standard, compact and custom profiles, with conflicts
highlighted.

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
npm run install:local # AppImage from the working tree + app-menu entry
```

`npm run install:local` builds a fresh version from the current files and updates
the “TikTok octo (локальная сборка)” item in the app menu, so changes can be
checked without starting the app from a terminal. It publishes nothing; if the
app is already running, quit it first or the old instance will be focused.
OpenCode agents are not allowed to launch the app or Playwright by hand
(`opencode.json`): UI is verified by tests, and the build lands in the menu with
the same command.

The smoke test launches the app with a temporary profile and `about:blank` as the
home page, so it touches neither your session nor the network. On Linux `npm test`
re-launches itself under `Xvfb` (`scripts/run-tests.js`), so no app windows pop up
over your work; CI does the same. To watch the test run on a real display use
`OCTO_TEST_WINDOW=1 npm test`.

```
src/
  main/
    main.js        app lifecycle, IPC, media keys, single-instance lock
    app-context.js shared window state and the main → title bar bridge
    window.js      BrowserWindow, geometry, close-to-tray
    view.js        WebContentsView with the site, history, retries, fullscreen
    chat.js        side chat panel over the feed
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
  plugin-shelf.spec.js “Shelf” plugin: bookmarks, badge and clearing
  plugin-security.spec.js  manifest, audit, ZIP and signature tests
plugins/
  examples/hello-octo  sample plugin
  shelf/               ready-made “Shelf” plugin: local bookmarks
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
- **Volume above 100 %**, the equalizer and mono go through Web Audio. They work
  for videos the site plays from its own origin (`blob:`) or with CORS enabled.
  When a video comes straight from another domain, the app keeps the normal
  volume and says so — otherwise Chromium would output silence.
- **Video quality** is set by TikTok itself: the web player serves H.264 at no
  more than 540p, while the HD variants are H.265. On Linux you can try to enable
  them with the "Hardware decoder" switch in the «Player» section (a restart is
  required): it needs a GPU and driver with VA-API, and if frames freeze, turn it
  back off. On Windows and macOS the system decoder works without this setting.
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
- **Library, queue and statistics** live in the app's local state: no
  cross-device sync, moving them means exporting.
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
  after a restart while the files stay on disk.
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
  <sub>Made with glass, gradients and <code>WebContentsView</code>.</sub>
</div>
