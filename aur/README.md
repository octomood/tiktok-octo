# AUR

Два пакета: `tiktok-octo-bin` (готовый AppImage из GitHub Releases) и
`tiktok-octo-git` (сборка из исходников). Первый — основной, второй нужен тем,
кто хочет самую свежую версию между релизами.

## Что и где менять

| Файл                                      | Меняется при                                           |
| :---------------------------------------- | :----------------------------------------------------- |
| `tiktok-octo-bin/PKGBUILD` → `pkgver`     | каждом релизе приложения                               |
| `tiktok-octo-bin/PKGBUILD` → `sha256sums` | каждом релизе приложения                               |
| `tiktok-octo-bin/.SRCINFO`                | после любой правки `PKGBUILD`                          |
| `tiktok-octo-bin/PKGBUILD` → `pkgrel`     | пересборке без смены версии                            |
| `tiktok-octo-bin/PKGBUILD` → `depends`    | новой системной зависимости                            |
| `tiktok-octo-git/*`                       | только правки логики сборки; версию считает `pkgver()` |

## Первая публикация

Нужен SSH-ключ, добавленный в аккаунт на aur.archlinux.org.

```sh
git clone ssh://aur@aur.archlinux.org/tiktok-octo-bin.git
cd tiktok-octo-bin
cp /path/to/tiktok-octo/aur/tiktok-octo-bin/{PKGBUILD,.SRCINFO} .
git add PKGBUILD .SRCINFO
git commit -m "Initial import: tiktok-octo-bin 0.4.3-1"
git push
```

То же для `tiktok-octo-git`. Пакет появляется в AUR сразу после пуша, в
официальные репозитории он не попадает.

## Обновление при релизе

**Сначала** выпустите релиз на GitHub (тег `vX.Y.Z`), чтобы появился
`tiktok-octo-X.Y.Z-linux-x86_64.AppImage`. Потом:

```sh
cd aur/tiktok-octo-bin

# 1. Версия
sed -i 's/^pkgver=.*/pkgver=X.Y.Z/' PKGBUILD
sed -i 's/^pkgrel=.*/pkgrel=1/' PKGBUILD

# 2. Контрольная сумма: makepkg сам скачает AppImage и напечатает строку
makepkg -g
# -> sha256sums=('...')
#    вставьте её в PKGBUILD вместо старой

# 3. Проверка сборки (зависимости можно не ставить: --nodeps)
makepkg -f --nodeps

# 4. Индекс AUR — обязателен в репозитории
makepkg --printsrcinfo > .SRCINFO

# 5. Публикация
git clone ssh://aur@aur.archlinux.org/tiktok-octo-bin.git /tmp/aur-bin
cp PKGBUILD .SRCINFO /tmp/aur-bin/
cd /tmp/aur-bin
git commit -am "upgpkg: tiktok-octo-bin X.Y.Z-1"
git push
```

Альтернатива шагу 2, если не хочется ничего скачивать: хеш есть в API GitHub
Releases.

```sh
curl -s https://api.github.com/repos/octomood/tiktok-octo/releases/tags/vX.Y.Z \
  | jq -r '.assets[] | select(.name|test("linux-x86_64\\.AppImage$")) | .digest'
```

### Когда нужен `pkgrel`

`pkgrel` увеличивается, когда пакет пересобирается без смены версии: изменились
`depends`, поправили `package()`, обновилась системная библиотека. Тогда
`pkgver` не трогаем, ставим `pkgrel=2` и повторяем шаги 3–5.

### `tiktok-octo-git`

Отдельно обновлять не нужно: `pkgver()` берёт `git describe`, а сборка идёт с
`master`. Правки нужны, только если меняется сама сборка (например, новая
системная зависимость или команда electron-builder).

## Проверка перед пушем

```sh
makepkg --printsrcinfo | diff - .SRCINFO   # .SRCINFO не устарел
namcap PKGBUILD                           # если установлен namcap
pacman -Qlp tiktok-octo-bin-*.pkg.tar.zst  # что именно попало в пакет
```

`chrome-sandbox` в пакете должен быть `rwsr-xr-x root/root` — иначе Electron не
запустится на системах с запрещёнными user namespaces.

## Как обновляются у пользователей

```sh
yay -Syu          # или paru -Syu
```

Пакет `-bin` обновится после того, как вы запушили новый `pkgver`;
`-git` — после каждого `yay -Syu`, потому что собирается из `master`.
