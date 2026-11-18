#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Общая картинка 16:9 «TikTok octo 1.0» для Telegram-канала."""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
S = 2
w, h = W * S, H * S
BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, 'assets')

INTER = '/usr/share/fonts/inter/Inter.ttc'
MONO = '/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf'
f_reg = lambda px: ImageFont.truetype(INTER, px * S, index=0)
f_med = lambda px: ImageFont.truetype(INTER, px * S, index=10)
f_semi = lambda px: ImageFont.truetype(INTER, px * S, index=12)
f_mono = lambda px: ImageFont.truetype(MONO, px * S)

WHITE = (242, 242, 244)
DIM = (160, 160, 170)


def background():
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w * 0.3, h * 0.2
    r = np.sqrt(((xx - cx) / (w * 0.8)) ** 2 + ((yy - cy) / (h * 0.8)) ** 2)
    glow = np.clip(1 - r, 0, 1) ** 1.8
    img = np.zeros((h, w, 3), np.float32)
    img[..., 0] = 8 + 16 * glow
    img[..., 1] = 8 + 16 * glow
    img[..., 2] = 10 + 19 * glow
    vr = np.sqrt(((xx - w / 2) / (w * 0.66)) ** 2 + ((yy - h / 2) / (h * 0.66)) ** 2)
    img *= (1 - 0.5 * np.clip(vr, 0, 1) ** 1.2)[..., None]
    rng = np.random.default_rng(21)
    img += rng.normal(0, 2.0, (h, w, 1))
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')


def tracked(d, xy, text, font, fill, tracking=0.0):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + tracking


def wrap(d, text, font, maxw):
    words = text.split(' · ')
    lines, cur = [], ''
    for word in words:
        candidate = word if not cur else cur + ' · ' + word
        if d.textlength(candidate, font=font) <= maxw:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


CHAPTERS = [
    ('Управление', 'Хоткеи и профили · «только полоса» · лента J/K/L · ссылки в приложении'),
    ('Звук', 'Громкость 200 % · выбор выхода · эквалайзер · моно'),
    ('Мини-плеер', 'Скраб-бар · таймкод · −10 секунд · таймер сна · автопауза'),
    ('Библиотека', 'Закладки · очередь «позже» · статистика · фокус-режим'),
    ('Лента', 'Фильтры · пропуск рекламы · субтитры · яркость и «заполнить»'),
    ('Чат', 'Уведомления · док-панель · drag&drop · быстрые ответы'),
    ('Загрузки', 'Менеджер · GIF · скриншот с аннотацией · шаблоны имён'),
    ('Приватность', 'Экспорт · панель данных · бэкапы · safe mode'),
    ('Плагины', 'SDK · схема настроек · hot reload · каталоги и квоты'),
    ('Система', 'SMTC/MPRIS · jump list · QR · масштаб UI и RTL'),
]


def main():
    img = background()
    d = ImageDraw.Draw(img)

    # шапка
    logo = Image.open(os.path.join(ASSETS, 'tiktok-octo.png')).convert('RGBA')
    logo = logo.resize((60 * S, 60 * S), Image.LANCZOS)
    img.alpha_composite(logo, (90 * S, 62 * S))
    d = ImageDraw.Draw(img)
    d.text((168 * S, 68 * S), 'TikTok octo', font=f_semi(30), fill=WHITE)
    d.text((170 * S, 108 * S), '1.0 · DESKTOP', font=f_mono(11), fill=(120, 120, 130))

    # заголовок
    d.text((90 * S, 186 * S), '1.0 — большое обновление', font=f_semi(62), fill=WHITE)
    d.text((92 * S, 272 * S), '58 ИЗМЕНЕНИЙ · 10 ГЛАВ · 40 ГЛАВНЫХ НИЖЕ', font=f_mono(18), fill=(150, 150, 160))

    # сетка 5×2
    x0, y0 = 79, 330
    tw, th = 338, 242
    gx, gy = 18, 18
    for i, (title, text) in enumerate(CHAPTERS):
        col, row = i % 5, i // 5
        x = x0 + col * (tw + gx)
        y = y0 + row * (th + gy)
        d.rounded_rectangle((x * S, y * S, (x + tw) * S, (y + th) * S), radius=20 * S,
                            fill=(20, 20, 25), outline=(44, 44, 52), width=S)
        d.text(((x + 20) * S, (y + 16) * S), f'{i + 1:02d}', font=f_mono(13), fill=(110, 110, 120))
        d.text(((x + 20) * S, (y + 42) * S), title, font=f_semi(24), fill=WHITE)
        font = f_reg(17)
        lines = wrap(d, text, font, (tw - 40) * S)
        ly = y + 84
        for line in lines:
            d.text(((x + 20) * S, ly * S), line, font=font, fill=(176, 176, 186))
            ly += 26

    # нижняя белая карточка
    bx, by, bw, bh = 79 * S, 856 * S, 1762 * S, 108 * S
    d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=26 * S, fill=WHITE)
    d.text((bx + 30 * S, by + bh / 2), 'Полный список изменений — в Telegram', font=f_med(22),
           fill=(11, 11, 13), anchor='lm')
    # самолётик
    plane = Image.open(os.path.join(ASSETS, 'plane.png')).convert('RGBA')
    ps = 34 * S
    plane = plane.resize((ps, ps), Image.LANCZOS)
    img.alpha_composite(plane, (int(bx + bw - 420 * S), int(by + bh / 2 - ps / 2)))
    d = ImageDraw.Draw(img)
    d.text((bx + bw - 370 * S, by + bh / 2), 't.me/tiktok_octo', font=f_mono(24), fill=(11, 11, 13), anchor='lm')

    # подвал
    d.line((79 * S, 1000 * S, 1841 * S, 1000 * S), fill=(38, 38, 45), width=S)
    d.text((79 * S, 1024 * S), '40 главных из 58 · полный список — в канале и ролике', font=f_mono(14), fill=(120, 120, 130))
    d.text((1841 * S, 1024 * S), 'LINUX · WINDOWS · MACOS', font=f_mono(14), fill=(120, 120, 130), anchor='ra')

    img = img.convert('RGB').resize((W, H), Image.LANCZOS)
    img.save(os.path.join(BASE, 'cover-1.0-16x9.png'))
    img.resize((1280, 720), Image.LANCZOS).save(os.path.join(BASE, 'cover-1.0-16x9-1280.png'))
    print('cover ok')


if __name__ == '__main__':
    main()
