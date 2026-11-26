# Flathub и AUR

Здесь лежит всё, что нужно, чтобы TikTok Octo появился в каталогах Linux.
Сначала — Flatpak (главный источник установок), затем AUR.

## Что уже готово

| Файл                                         | Назначение                             |
| :------------------------------------------- | :------------------------------------- |
| `io.github.octomood.TikTokOcto.yml`          | манифест flatpak-builder               |
| `io.github.octomood.TikTokOcto.metainfo.xml` | AppStream: описание, скриншоты, релизы |
| `io.github.octomood.TikTokOcto.desktop`      | ярлык запуска                          |
| `tiktok-octo.sh`                             | лаунчер через `zypak-wrapper`          |
| `npm-sources.json`                           | офлайн-источники npm (сгенерировано)   |
| `../aur/`                                    | `tiktok-octo-bin` и `tiktok-octo-git`  |

## Локальная сборка

Нужны `flatpak` и `flatpak-builder`, плюс рантаймы:

```sh
flatpak install flathub org.freedesktop.Platform//25.08 \
  org.freedesktop.Sdk//25.08 org.freedesktop.Sdk.Extension.node22//25.08 \
  org.electronjs.Electron2.BaseApp//25.08
```

Сборка и запуск (из этого каталога):

```sh
flatpak-builder --user --install --force-clean \
  --state-dir=/tmp/octo-flatpak/state /tmp/octo-flatpak/build \
  io.github.octomood.TikTokOcto.yml
flatpak run io.github.octomood.TikTokOcto
```

Манифест собирает **тег** `vX.Y.Z` (так он же живёт в репозитории Flathub),
поэтому незакоммиченные правки в сборку не попадут. Чтобы проверить рабочую
копию, замените git-источник на файлы:

```yaml
sources:
  - type: dir
    path: ../src
    dest: src
  - type: file
    path: ../package.json
  - type: file
    path: ../package-lock.json
  - type: file
    path: ../LICENSE
  - type: file
    path: ../build/icon.png
    dest: build
```

Проверка метаданных:

```sh
flatpak run --command=flatpak-builder-lint org.flatpak.Builder \
  manifest io.github.octomood.TikTokOcto.yml
appstreamcli validate io.github.octomood.TikTokOcto.metainfo.xml
```

## Что нужно сделать перед заявкой на Flathub

1. **Скриншоты 16:9.** Сейчас в метаинфо указан
   `docs/screenshots/main.png`, которого нет: валидатор Flathub отклонит
   заявку. Сделайте 2–3 снимка окна (1280×720 или 1920×1080) и положите в
   `docs/screenshots/`. Существующие `docs/titlebar.png` (931×44) и
   `docs/banner.png` (1440×470) для этого не годятся — не тот формат.
2. **Тег и коммит актуальны.** Манифест уже собирает git-тег; при выпуске
   новой версии обновите `tag` и `commit` (см. «Обновление при релизе») и
   перегенерируйте `npm-sources.json` из того же коммита, если менялись
   зависимости.

3. **Версия в метаинфо = версия сборки.** Верхний `<release>` должен совпадать
   с `package.json` тега.
4. **ID приложения.** `io.github.octomood.TikTokOcto` — схема
   `io.github.<владелец>.<Имя>`, потому что своего домена нет. Если появится
   домен (например `octo.app`), ID придётся сменить на `app.octo.*` — лучше
   сделать это до публикации, чтобы не терять установки.
5. **Автообновление отключено.** Flathub запрещает приложениям обновлять себя
   мимо пакетного менеджера. В `src/main/updates.js` уже стоит проверка
   `FLATPAK_ID` — обновления приходят только через Flathub.
6. **Имя и бренд.** В названии «TikTok Octo» есть чужая торговая марка. Это
   допустимо для неофициального клиента с явным дисклеймером (он есть в
   описании и README), но ревьюер может задать вопросы. На такой случай
   держите нейтральный вариант имени.

### Заявка

```sh
# 1. Форк flathub/flathub и ветка new-pr от master
# 2. Скопировать манифест и вспомогательные файлы в корень форка
# 3. Проверить, что сборка проходит в чистом окружении
# 4. Pull request с заголовком «Add io.github.octomood.TikTokOcto»
```

Ревью обычно занимает от нескольких дней до пары недель; правки
запрашивают почти всегда — это нормально.

## Обновление при релизе

Порядок важен: **сначала тег и релиз на GitHub, потом пакеты.** AUR тянет
готовый AppImage из релиза, Flatpak — исходники по тегу, поэтому без
опубликованного тега обновлять нечего.

Всё, что нужно поправить, — в этой таблице. `X.Y.Z` — новая версия.

| Что                         | Где                                                  | Как                                                            |
| :-------------------------- | :--------------------------------------------------- | :------------------------------------------------------------- |
| Версия приложения           | `package.json`                                       | `npm version X.Y.Z` (коммит + тег)                             |
| Запись о релизе в AppStream | `flatpak/io.github.octomood.TikTokOcto.metainfo.xml` | добавить `<release version="X.Y.Z" date="YYYY-MM-DD"/>` первым |
| Тег и коммит для Flathub    | `flatpak/io.github.octomood.TikTokOcto.yml`          | заменить `tag` и `commit` в блоке `type: git`                  |
| npm-источники               | `flatpak/npm-sources.json`                           | перегенерировать, если менялись зависимости                    |
| Electron                    | `flatpak/io.github.octomood.TikTokOcto.yml`          | при смене версии — новые `url`/`sha256`                        |
| Версия AUR                  | `aur/tiktok-octo-bin/PKGBUILD`                       | `pkgver=X.Y.Z`                                                 |
| Контрольная сумма AUR       | `aur/tiktok-octo-bin/PKGBUILD`                       | `sha256sums=('...')`                                           |
| Индекс AUR                  | `aur/tiktok-octo-bin/.SRCINFO`                       | `makepkg --printsrcinfo > .SRCINFO`                            |
| `tiktok-octo-git`           | —                                                    | ничего: версию считает `pkgver()`                              |

Найти все места со старой версией (подставьте её в шаблон):

```sh
grep -rn "0\.5\." package.json flatpak aur
```

### Шаг 1. Выпустить релиз

```sh
npm version X.Y.Z          # без --no-git-tag-version, если тег ставится здесь
git push --follow-tags     # workflow Release соберёт AppImage, deb, dmg, exe
```

Дождитесь, пока в релизе появятся `tiktok-octo-X.Y.Z-linux-x86_64.AppImage`
и `latest-linux.yml`. Полный sha коммита тега:

```sh
git rev-list -n1 vX.Y.Z
```

### Шаг 2. Обновить Flatpak в этом репозитории

1. В `io.github.octomood.TikTokOcto.metainfo.xml` добавьте сверху `<releases>`
   новую строку — иначе Flathub не примет сборку.
2. В манифесте поправьте блок `type: git` (при локальной сборке он не нужен,
   но в Flathub-репозитории должен указывать на новый тег).
3. Если менялись `dependencies`/`devDependencies` — перегенерируйте
   `npm-sources.json` по инструкции ниже. Если нет, файл не трогайте.
4. Проверьте сборку и метаданные:

   ```sh
   flatpak-builder --user --install --force-clean \
     --state-dir=/tmp/octo-flatpak/state /tmp/octo-flatpak/build \
     io.github.octomood.TikTokOcto.yml
   appstreamcli validate io.github.octomood.TikTokOcto.metainfo.xml
   ```

### Шаг 3. Отправить обновление в Flathub

После того как заявку приняли, обновления идут не через `flathub/flathub`, а
через отдельный репозиторий приложения:

```sh
git clone ssh://git@github.com/flathub/io.github.octomood.TikTokOcto.git
cd io.github.octomood.TikTokOcto
# скопировать обновлённые manifest, metainfo, npm-sources.json и т.д.
git checkout -b update-X.Y.Z
git commit -am "Update to X.Y.Z"
git push -u origin update-X.Y.Z
```

Дальше — pull request в `flathub/io.github.octomood.TikTokOcto`. После мержа
бот собирает и публикует сборку, обычно в течение часа. Проверить, что
линтер не ругается, можно до PR:

```sh
flatpak run --command=flatpak-builder-lint org.flatpak.Builder \
  manifest io.github.octomood.TikTokOcto.yml
```

### Шаг 4. Обновить AUR

Подробно — в `aur/README.md`. Коротко: `pkgver`, `sha256sums`, затем
`makepkg --printsrcinfo > .SRCINFO` и пуш в AUR-репозиторий.

### Как обновляются у пользователей

| Канал                 | Команда / место                                                       |
| :-------------------- | :-------------------------------------------------------------------- |
| Flatpak (Flathub)     | `flatpak update`, GNOME Software, KDE Discover — само, после мержа PR |
| AUR `tiktok-octo-bin` | `yay -Syu` / `paru -Syu` — после обновления `pkgver`                  |
| AUR `tiktok-octo-git` | `yay -Syu` — подтянет свежий `master`                                 |
| GitHub Releases       | Windows, macOS и AppImage обновляются сами через `electron-updater`   |

Важно: в Flatpak собственный апдейтер выключен (`FLATPAK_ID` в
`src/main/updates.js`), поэтому «проверить обновления» в приложении отвечает
«Обновления приходят через Flathub». Это требование Flathub, не баг.

## Как обновлять `npm-sources.json`

Генератор — `flatpak-node-generator` из
[flatpak-builder-tools](https://github.com/flathub/flatpak-builder-tools/tree/master/node).
Запускать нужно **в каталоге без `node_modules`**, иначе старые версии
генератора принимают все пакеты за локальные и выдают пустой файл:

```sh
mkdir -p /tmp/octo-npm && cp package.json package-lock.json /tmp/octo-npm/
cd /tmp/octo-npm
flatpak-node-generator npm package-lock.json --no-devel -o npm-sources.json
cp npm-sources.json /path/to/tiktok-octo/flatpak/
```

`--no-devel` обязателен: в манифесте стоит `npm ci --omit=dev`, и Electron с
electron-builder в песочнице не нужны (бинарник Electron качается отдельным
источником).

## Как обновлять хеши Electron

При смене версии Electron в `package.json` обновите оба `url`/`sha256` в
манифесте. Хеши есть в API GitHub Releases:

```sh
curl -s https://api.github.com/repos/electron/electron/releases/tags/v45.3.2 \
  | jq -r '.assets[] | select(.name|test("linux-(x64|arm64)\\.zip$")) | "\(.name) \(.digest)"'
```

## Известные ограничения в Flatpak

- **Автозапуск** (`src/main/autostart.js`) внутри песочницы не работает: файл
  `~/.config/autostart` живёт в `~/.var/app/<id>/config` и хост его не читает.
  Корректный путь — портал `org.freedesktop.portal.Background`; пока автозапуск
  в Flatpak просто отключён.
- **Установка AppImage в меню** не нужна и не показывается: она завязана на
  переменную `APPIMAGE`, которой в Flatpak нет.
- **`abstract-socket`** (необязательная зависимость `dbus-next`) не собирается,
  потому что ставится с `--ignore-scripts`. Для обычной сессионной шины D-Bus
  он не нужен, MPRIS работает через unix-сокет.

## AUR

Пакеты лежат в `../aur/`, инструкция по публикации и обновлению —
`../aur/README.md`:

- `tiktok-octo-bin` — распаковывает AppImage из GitHub Releases в `/opt`,
  без зависимости от FUSE;
- `tiktok-octo-git` — собирает из исходников (`npm ci` + electron-builder).
