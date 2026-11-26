#!/usr/bin/env bash
# 30-секундный ролик TikTok Octo v2.0 в стиле Material Design 3 Expressive (1080×1920, 30 к/с).
set -euo pipefail

cd "$(dirname "$0")"
OUT=tiktok-octo-v2-md3-30s.mp4
BUILD=build-v2-md3

mkdir -p "$BUILD"

echo "→ звук"
python3 v2-md3-audio.py "$BUILD/audio.wav"

echo "→ кадры"
rm -rf "$BUILD/frames"
node render.mjs --scene v2-md3.html --fps 30 --dsf 2 --out "$BUILD"

echo "→ постер"
node render.mjs --scene v2-md3.html --still 27.5 --out "$BUILD" >/dev/null
ffmpeg -hide_banner -v error -y -i "$BUILD/poster-27.50.png" \
  -vf "scale=1080:1920:flags=lanczos" -frames:v 1 v2-md3-30s.png

echo "→ кодирование"
ffmpeg -hide_banner -v error -y \
  -framerate 30 -i "$BUILD/frames/%04d.png" \
  -i "$BUILD/audio.wav" \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.2 \
  -x264-params "aq-mode=3:deblock=1,-1" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t 30 -shortest -movflags +faststart \
  "$OUT"

echo "→ готово"
ffprobe -hide_banner -v error -show_entries format=duration,size,bit_rate \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames \
  -of default=nw=1 "$OUT"
