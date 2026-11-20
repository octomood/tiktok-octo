#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Кадры «видео» для фида: 6-секундный луп 12 к/с, 540×960.

Стеклянный логотип качается и пульсирует под 120 BPM, вокруг ходят
световые пятна, частицы и блик. Кадры используют night.html как обычный
видеоряд: <img> меняется по t, поэтому рендер остаётся детерминированным.

    python3 docs/promo/night-feed.py
"""

import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, 'assets')
OUT = os.path.join(ASSETS, 'night-feed')
os.makedirs(OUT, exist_ok=True)

W, H = 720, 1280
S = 2
w, h = W * S, H * S
FPS = 24
DUR = 6.0
FRAMES = int(FPS * DUR)

logo_src = Image.open(os.path.join(ASSETS, 'tiktok-octo.png')).convert('RGBA')


def background(t):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x = xx / w
    y = yy / h
    img = np.zeros((h, w, 3), np.float32)
    img[..., 0] = 6
    img[..., 1] = 6
    img[..., 2] = 8

    def glow(cx, cy, rx, ry, color, power=1.9, amp=1.0):
        r = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
        g = np.clip(1 - r, 0, 1) ** power
        for k in range(3):
            img[..., k] += color[k] * g * amp

    # два медленных пятна: тёплое снизу, холодное сверху
    gx = 0.5 + 0.12 * math.sin(2 * math.pi * t / DUR)
    gy = 0.46 + 0.05 * math.cos(2 * math.pi * t / (DUR / 2))
    glow(0.30 + 0.08 * math.sin(2 * math.pi * t / DUR), 0.68, 0.46, 0.40, (90, 64, 12), 2.2, 0.85)
    glow(0.72, 0.28 + 0.08 * math.cos(2 * math.pi * t / DUR), 0.42, 0.44, (16, 34, 72), 2.0, 0.8)
    glow(gx, gy, 0.33, 0.28, (42, 38, 28), 2.4, 0.55)

    # диагональный блик, который проходит раз в 2 секунды
    p = ((t / 2.0) % 1.0) * 1.8 - 0.4
    band = np.exp(-(((x * 0.7 + y * 0.3) - p) / 0.11) ** 2)
    img += band[..., None] * np.array([26, 24, 18], np.float32)

    # виньетка
    vr = np.sqrt(((x - 0.5) / 0.66) ** 2 + ((y - 0.5) / 0.66) ** 2)
    img *= (1 - 0.55 * np.clip(vr, 0, 1) ** 1.3)[..., None]

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def particles(t):
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = np.random.default_rng(808)
    for i in range(38):
        base_x = rng.random()
        base_y = rng.random()
        speed = (1 + i % 3) / DUR
        px = ((base_x + speed * t) % 1.0) * w
        py = ((base_y - speed * 0.6 * t) % 1.0) * h
        size = (1.4 + (i % 4) * 0.9) * S
        a = int(28 + 90 * (0.5 + 0.5 * math.sin(2 * math.pi * (t / DUR + i / 38))))
        d.ellipse((px - size, py - size, px + size, py + size), fill=(255, 255, 255, a))
    return layer.filter(ImageFilter.GaussianBlur(0.6 * S))


def logo_layer(t):
    # пульс на каждую долю 120 BPM
    beat = 0.5
    pulse = math.exp(-(((t % beat) / 0.13) ** 2))
    size = int(330 * S * (1 + 0.035 * pulse))
    logo = logo_src.resize((size, size), Image.LANCZOS)
    angle = 7 * math.sin(2 * math.pi * t / DUR)
    logo = logo.rotate(angle, resample=Image.BICUBIC, expand=True)
    logo = logo.filter(ImageFilter.GaussianBlur(0.35 * S))

    # свечение под логотипом
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx = w / 2 + 10 * math.sin(2 * math.pi * t / (DUR / 2))
    cy = h / 2 - 40 + 16 * math.sin(2 * math.pi * t / (DUR / 3))
    r = 210 * S * (1 + 0.06 * pulse)
    gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 244, 210, 22 + int(26 * pulse)))
    glow = glow.filter(ImageFilter.GaussianBlur(55 * S))

    px = int(cx - logo.width / 2)
    py = int(cy - logo.height / 2)
    return glow, logo, (px, py)


def make_frame(i):
    t = i / FPS
    img = background(t)
    glow, logo, pos = logo_layer(t)
    img = Image.alpha_composite(img, glow)
    img.alpha_composite(logo, pos)
    img = Image.alpha_composite(img, particles(t))

    # лёгкое «дыхание» камеры
    shake_x = math.sin(2 * math.pi * t / (DUR / 2)) * 2.0 * S
    shake_y = math.cos(2 * math.pi * t / (DUR / 3)) * 1.5 * S
    img = img.transform(
        (w, h),
        Image.AFFINE,
        (1, 0, -shake_x, 0, 1, -shake_y),
        resample=Image.BICUBIC,
    )

    # зерно
    rng = np.random.default_rng(1000 + i)
    arr = np.asarray(img.convert('RGB')).astype(np.float32)
    arr += rng.normal(0, 1.8, (h, w, 1))
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    return img.resize((W, H), Image.LANCZOS)


if __name__ == '__main__':
    for i in range(FRAMES):
        make_frame(i).save(os.path.join(OUT, f'{i:03d}.jpg'), quality=87, optimize=True)
        if i % 12 == 0:
            print(f'{i + 1}/{FRAMES}')
    print('frames ok →', OUT)
