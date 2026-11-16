#!/bin/sh
# Запуск TikTok octo внутри песочницы Flatpak.
#
# zypak подменяет песочницу Chromium на песочницу Flatpak: SUID-хелпер
# chrome-sandbox внутри sandbox недоступен, поэтому Electron запускается
# через zypak-wrapper из org.electronjs.Electron2.BaseApp.
set -eu

exec zypak-wrapper /app/electron/electron /app/main "$@"
