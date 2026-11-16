#!/usr/bin/env bash
# Обложка 16:9 для Telegram-канала.
set -euo pipefail

cd "$(dirname "$0")"
BUILD=build-cover

node render.mjs --scene cover-16x9.html --width 1920 --height 1080 --still 0 --out "$BUILD"

ffmpeg -hide_banner -v error -y -i "$BUILD/poster-0.00.png" \
  -vf "scale=1920:1080:flags=lanczos" -frames:v 1 cover-16x9.png
ffmpeg -hide_banner -v error -y -i "$BUILD/poster-0.00.png" \
  -vf "scale=1280:720:flags=lanczos" -frames:v 1 cover-16x9-1280.png

echo "готово: cover-16x9.png, cover-16x9-1280.png"
