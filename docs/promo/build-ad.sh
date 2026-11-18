#!/usr/bin/env bash
# 5-секундная реклама TikTok octo с озвучкой (PIL + ffmpeg, без браузера).
set -euo pipefail

cd "$(dirname "$0")"
BUILD=build-ad

mkdir -p "$BUILD"

echo "→ звук"
python3 audio-ad.py assets/vo-ad.wav "$BUILD/audio.wav"

echo "→ кадры"
python3 ad-frames.py

echo "→ видео"
ffmpeg -hide_banner -v error -y \
  -loop 1 -framerate 30 -t 2.7 -i "$BUILD/hero.png" \
  -loop 1 -framerate 30 -t 2.8 -i "$BUILD/cta.png" \
  -i "$BUILD/audio.wav" \
  -filter_complex "
    [0:v]scale=1080:1920,zoompan=z='min(1+0.00007*on,1.02)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[a];
    [1:v]scale=1080:1920,zoompan=z='max(1.02-0.00005*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[b];
    [a][b]xfade=transition=fadeblack:duration=0.34:offset=2.33[v];
    [v]fade=t=in:st=0:d=0.15,fade=t=out:st=4.84:d=0.16,format=yuv420p[v2]
  " \
  -map "[v2]" -map 2:a -t 5 -r 30 \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.2 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart \
  tiktok-octo-ad-5s.mp4

cp "$BUILD/cta.png" ad-5s.png

echo "→ готово"
ffprobe -hide_banner -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate \
  -of default=nw=1 tiktok-octo-ad-5s.mp4
