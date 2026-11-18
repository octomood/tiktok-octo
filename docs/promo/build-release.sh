#!/usr/bin/env bash
# Минутный ролик 1.0: PIL-анимация без браузера + синтезированный звук.
set -euo pipefail

cd "$(dirname "$0")"
BUILD=build-release
OUT=tiktok-octo-1.0-60s.mp4

mkdir -p "$BUILD"

echo "→ звук"
python3 release-audio.py --no-voice "$BUILD/audio.wav"

echo "→ видео"
python3 release-anim.py "$BUILD/audio.wav" "$OUT"

echo "→ обложка"
python3 release-cover.py
echo "→ постер"
python3 release-anim.py --poster release-1.0.png >/dev/null

echo "→ готово"
ffprobe -hide_banner -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate \
  -of default=nw=1 "$OUT"
