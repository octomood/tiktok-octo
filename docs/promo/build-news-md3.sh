#!/usr/bin/env bash
# Картинка «Что нового» в стиле Material Design 3 для Telegram-канала.
set -euo pipefail

cd "$(dirname "$0")"
BUILD=build-news-md3

node render.mjs --scene news-md3-16x9.html --width 1920 --height 1080 --still 0 --out "$BUILD"

ffmpeg -hide_banner -v error -y -i "$BUILD/poster-0.00.png" \
  -vf "scale=1920:1080:flags=lanczos" -frames:v 1 news-md3-16x9.png
ffmpeg -hide_banner -v error -y -i "$BUILD/poster-0.00.png" \
  -vf "scale=1280:720:flags=lanczos" -frames:v 1 news-md3-16x9-1280.png

echo "готово: news-md3-16x9.png, news-md3-16x9-1280.png"
