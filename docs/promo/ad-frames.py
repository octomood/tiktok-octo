#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Кадры 5-секундной рекламы без браузера: PIL + Inter + стеклянный логотип."""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
S = 2  # суперсэмплинг
w, h = W * S, H * S

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, 'assets')
OUT = os.path.join(BASE, 'build-ad')
os.makedirs(OUT, exist_ok=True)

INTER = '/usr/share/fonts/inter/Inter.ttc'
MONO = '/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf'
if not os.path.exists(MONO):
    import subprocess
    MONO = subprocess.check_output(['fc-match', '-f', '%{file}', 'JetBrains Mono']).decode()

f_reg = lambda px: ImageFont.truetype(INTER, px * S, index=0)
f_med = lambda px: ImageFont.truetype(INTER, px * S, index=10)
f_semi = lambda px: ImageFont.truetype(INTER, px * S, index=12)
f_mono = lambda px: ImageFont.truetype(MONO, px * S)


def background():
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w * 0.5, h * 0.3
    r = np.sqrt(((xx - cx) / (w * 0.75)) ** 2 + ((yy - cy) / (h * 0.7)) ** 2)
    glow = np.clip(1 - r, 0, 1) ** 1.8
    img = np.zeros((h, w, 3), np.float32)
    img[..., 0] = 9 + 15 * glow
    img[..., 1] = 9 + 15 * glow
    img[..., 2] = 11 + 17 * glow
    # виньетка
    vr = np.sqrt(((xx - w / 2) / (w * 0.62)) ** 2 + ((yy - h / 2) / (h * 0.62)) ** 2)
    img *= (1 - 0.5 * np.clip(vr, 0, 1) ** 1.2)[..., None]
    # зерно
    rng = np.random.default_rng(11)
    img += rng.normal(0, 2.2, (h, w, 1))
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


def tracked(draw, xy, text, font, fill, tracking=0.0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def logo(size_px, center):
    im = Image.open(os.path.join(ASSETS, 'tiktok-octo.png')).convert('RGBA')
    im = im.resize((size_px * S, size_px * S), Image.LANCZOS)
    return im, (int(center[0] * S - im.width / 2), int(center[1] * S - im.height / 2))


def frame_a():
    img = background()
    lg, pos = logo(320, (540, 740))
    # мягкое свечение под логотипом
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        (pos[0] - 80 * S, pos[1] + 40 * S, pos[0] + lg.width + 80 * S, pos[1] + lg.height + 120 * S),
        fill=(255, 255, 255, 16),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(70 * S))
    img = Image.alpha_composite(img.convert('RGBA'), glow)
    img.alpha_composite(lg, pos)

    d = ImageDraw.Draw(img)
    d.text((w / 2, 955 * S), 'TikTok octo', font=f_semi(76), fill=(242, 242, 244), anchor='mm')
    d.text(
        (w / 2, 1050 * S),
        'Первый мод для компьютера',
        font=f_med(56),
        fill=(242, 242, 244),
        anchor='mm',
    )
    sub = 'БЕЗ БРАУЗЕРА И ВКЛАДОК'
    font = f_mono(22)
    total = sum(d.textlength(c, font=font) for c in sub) + 3 * S * (len(sub) - 1)
    tracked(d, (w / 2 - total / 2, 1122 * S), sub, font, (120, 120, 128), 3 * S)

    return img.resize((W, H), Image.LANCZOS).convert('RGB')


def frame_b():
    img = background().convert('RGBA')
    d = ImageDraw.Draw(img)

    # тень карточки
    shadow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (90 * S, 790 * S, 990 * S, 1110 * S), radius=44 * S, fill=(0, 0, 0, 180)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(38 * S))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)

    d.rounded_rectangle(
        (90 * S, 760 * S, 990 * S, 1080 * S), radius=44 * S, fill=(244, 244, 246)
    )

    label = 'СКАЧИВАЙ В TELEGRAM'
    lf = f_mono(24)
    tracked(d, (150 * S, 812 * S), label, lf, (120, 120, 128), 2.4 * S)

    # бумажный самолётик
    px, py = 150 * S, 858 * S
    plane = Image.open(os.path.join(ASSETS, 'plane.png')).convert('RGBA')
    plane = plane.resize((46 * S, 46 * S), Image.LANCZOS)
    img.alpha_composite(plane, (px, py))
    d = ImageDraw.Draw(img)

    d.text(
        (px + 64 * S, py + 24 * S),
        't.me/tiktok_octo',
        font=f_mono(68),
        fill=(11, 11, 13),
        anchor='lm',
    )

    sub = 'TikTok octo · Linux · Windows · macOS'
    tracked(d, (150 * S, 1000 * S), sub, f_mono(18), (120, 120, 128), 1.6 * S)

    return img.convert('RGB').resize((W, H), Image.LANCZOS)


if __name__ == '__main__':
    frame_a().save(os.path.join(OUT, 'hero.png'))
    frame_b().save(os.path.join(OUT, 'cta.png'))
    print('frames ok')
