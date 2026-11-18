#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Минутный ролик 1.0: плавные анимации, без голоса.

Рендер идёт сразу в ffmpeg через pipe: 1080×1920, 30 к/с, 60 с.
"""

import os
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FPS = 30
DUR = 60.0
BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, 'assets')

INTER = '/usr/share/fonts/inter/Inter.ttc'
MONO = '/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf'

f_reg = lambda px: ImageFont.truetype(INTER, px, index=0)
f_med = lambda px: ImageFont.truetype(INTER, px, index=10)
f_semi = lambda px: ImageFont.truetype(INTER, px, index=12)
f_mono = lambda px: ImageFont.truetype(MONO, px)

WHITE = (242, 242, 244)
DIM = (150, 150, 160)
BG = (10, 10, 12)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def mix(c, a, bg=BG):
    return tuple(int(c[i] * a + bg[i] * (1 - a)) for i in range(3))


def background():
    img = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W * 0.5, H * 0.3
    r = np.sqrt(((xx - cx) / (W * 0.8)) ** 2 + ((yy - cy) / (H * 0.75)) ** 2)
    glow = np.clip(1 - r, 0, 1) ** 1.8
    img[..., 0] = 9 + 15 * glow
    img[..., 1] = 9 + 15 * glow
    img[..., 2] = 11 + 18 * glow
    vr = np.sqrt(((xx - W / 2) / (W * 0.66)) ** 2 + ((yy - H / 2) / (H * 0.66)) ** 2)
    img *= (1 - 0.5 * np.clip(vr, 0, 1) ** 1.2)[..., None]
    rng = np.random.default_rng(7)
    img += rng.normal(0, 1.8, (H, W, 1))
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


BASE_IMG = background()

CHAPTERS = [
    ('Управление', 'Всё на клавишах', [
        'Редактор горячих клавиш и профили',
        'Режим «только полоса»',
        'Клавиатурная лента J / K / L',
        'Ссылки открываются в приложении',
    ], 'keys'),
    ('Звук', 'Звук как надо', [
        'Громкость до 200 %',
        'Выбор аудиовыхода',
        'Эквалайзер и моно-режим',
        'Тихие ролики больше не тихие',
    ], 'eq'),
    ('Мини-плеер', 'Плеер не мешает', [
        'Скраб-бар и таймкод',
        'Перемотка на −10 секунд',
        'Таймер сна и автопауза',
        '«Не спать, пока играет»',
    ], 'pip'),
    ('Библиотека', 'Своя библиотека', [
        'Закладки с таймкодом и заметкой',
        'Очередь «посмотреть позже»',
        'Статистика просмотра',
        'Фокус-режим и Pomodoro',
    ], 'marks'),
    ('Лента', 'Лента по твоим правилам', [
        'Фильтры по словам и авторам',
        'Пропуск рекламы со счётчиком',
        'Субтитры по умолчанию',
        'Яркость, контраст и «заполнить»',
    ], 'feed'),
    ('Чат', 'Чат под рукой', [
        'Уведомления о сообщениях',
        'Док-панель с ресайзом',
        'Драг-н-дроп файлов',
        'Быстрые ответы из палитры',
    ], 'chat'),
    ('Загрузки', 'Забирай с собой', [
        'Менеджер загрузок с очередью',
        'GIF из выделенного фрагмента',
        'Скриншот с аннотацией',
        'Имя файла по шаблону',
    ], 'downloads'),
    ('Приватность', 'Всё под контролем', [
        'Экспорт и импорт настроек',
        'Панель приватности и данных',
        'Резервные копии состояния',
        'Safe mode и диагностика',
    ], 'privacy'),
    ('Плагины', 'Расширяй как хочешь', [
        'SDK, типы и шаблон проекта',
        'Настройки из манифеста',
        'Hot reload и watcher',
        'Свои каталоги и квоты',
    ], 'plugins'),
    ('Система', 'Везде как дома', [
        'SMTC, MPRIS и кнопки в системе',
        'Jump list и меню дока',
        'QR-код текущего видео',
        'Масштаб интерфейса и RTL',
    ], 'os'),
]

INTRO_DUR = 3.5
CH_DUR = 5.2
OUTRO_DUR = 4.5
CH_START = [INTRO_DUR + i * CH_DUR for i in range(len(CHAPTERS))]
OUTRO_START = INTRO_DUR + len(CHAPTERS) * CH_DUR
WIPE = 0.4
LEAD = 0.7


def header(d, index, total):
    d.text((90, 92), 'TIKTOK OCTO · 1.0', font=f_mono(18), fill=(120, 120, 130))
    d.text((990, 92), f'{index:02d} / {total:02d}', font=f_mono(18), fill=(120, 120, 130), anchor='ra')
    d.line((90, 140, 990, 140), fill=(34, 34, 41), width=1)


def progress_bar(img, current, frac):
    d = ImageDraw.Draw(img)
    x = 90
    for i in range(len(CHAPTERS)):
        w = 82
        y = 1762
        fill = (242, 242, 244) if i < current else (46, 46, 54)
        d.rounded_rectangle((x, y, x + w, y + 4), radius=2, fill=fill)
        if i == current:
            d.rounded_rectangle((x, y, x + int(w * frac), y + 4), radius=2, fill=(242, 242, 244))
        x += w + 10


def draw_keys(d, u):
    caps = [('Ctrl', 140), ('⇧', 96), ('P', 96)]
    cx = 90
    y = 1200
    for i, (text, cw) in enumerate(caps):
        press = clamp(1 - abs(u - (1.1 + i * 0.7)) / 0.16)
        off = int(press * 5)
        d.rounded_rectangle((cx, y + off, cx + cw, y + 96 + off), radius=20,
                            fill=(41 + int(press * 40), 41 + int(press * 40), 48 + int(press * 40)),
                            outline=(70, 70, 78), width=1)
        d.text((cx + cw / 2, y + 48 + off), text, font=f_mono(34), fill=WHITE, anchor='mm')
        cx += cw + 14
    d.rounded_rectangle((cx, y, cx + 140, y + 96), radius=20, fill=WHITE)
    d.text((cx + 70, y + 48), '1.0', font=f_mono(34), fill=(11, 11, 13), anchor='mm')


def draw_eq(d, u):
    heights = [34, 62, 96, 132, 82, 150, 110, 70, 138, 98, 54, 118, 88, 146, 66, 102]
    bx = 90
    for i, hh in enumerate(heights):
        k = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(u * 3.2 + i * 0.55))
        h2 = int(hh * k)
        tone = (242, 242, 244) if i < 12 else (120, 120, 130)
        d.rounded_rectangle((bx, 1360 - h2, bx + 26, 1360), radius=6, fill=tone)
        bx += 40
    d.rounded_rectangle((880, 1200, 990, 1246), radius=23, fill=WHITE)
    d.text((935, 1223), '200 %', font=f_mono(20), fill=(11, 11, 13), anchor='mm')


def draw_pip(d, u):
    x, y = 90, 1200
    d.rounded_rectangle((x, y, x + 520, y + 280), radius=24, fill=(20, 20, 25), outline=(56, 56, 64), width=1)
    pulse = 1 + 0.05 * np.sin(u * 4)
    r = int(25 * pulse)
    d.ellipse((x + 260 - r, y + 135 - r, x + 260 + r, y + 135 + r), fill=WHITE)
    d.polygon([(x + 253, y + 122), (x + 274, y + 135), (x + 253, y + 148)], fill=(11, 11, 13))
    fill_w = int(396 * clamp(0.15 + u / CH_DUR * 0.6))
    d.rounded_rectangle((x + 24, y + 238, x + 420, y + 242), radius=2, fill=(70, 70, 78))
    d.rounded_rectangle((x + 24, y + 238, x + 24 + fill_w, y + 242), radius=2, fill=WHITE)
    d.text((x + 24, y + 256), '0:12', font=f_mono(16), fill=(150, 150, 160))
    d.text((x + 470, y + 256), '0:30', font=f_mono(16), fill=(150, 150, 160), anchor='ra')
    d.text((x + 560, y + 30), 'PiP', font=f_mono(22), fill=(150, 150, 160))
    d.text((x + 560, y + 74), '−10 сек', font=f_mono(22), fill=WHITE)


def draw_marks(d, u):
    rows = [('0:42', 'Первый мод для компа'), ('1:07', 'Плагины и песочница'), ('3:15', 'Как работает PiP')]
    ry = 1200
    for i, (ts, title) in enumerate(rows):
        p = ease((u - 0.6 - i * 0.25) / 0.5)
        if p <= 0:
            ry += 90
            continue
        y = ry + int((1 - p) * 16)
        d.rounded_rectangle((90, y, 910, y + 74), radius=16, fill=(20, 20, 25))
        d.rounded_rectangle((108, y + 19, 186, y + 55), radius=9, fill=mix(WHITE, p))
        d.text((147, y + 37), ts, font=f_mono(17), fill=mix((11, 11, 13), p), anchor='mm')
        d.text((208, y + 37), title, font=f_reg(22), fill=mix((220, 220, 226), p), anchor='lm')
        ry += 90


def draw_feed(d, u):
    rows = [('@octo', 'первый мод для компа'), ('@octo', 'плагины и песочница'), ('@octo', 'как работает PiP')]
    ry = 1200
    for i, (who, text) in enumerate(rows):
        p = ease((u - 0.5 - i * 0.3) / 0.5)
        y = ry + int((1 - p) * 18)
        d.rounded_rectangle((90, y, 910, y + 72), radius=16, fill=(20, 20, 25))
        d.ellipse((108, y + 18, 144, y + 54), fill=(60, 60, 68))
        d.text((162, y + 24), who, font=f_reg(20), fill=mix(WHITE, p))
        d.text((162, y + 46), text, font=f_mono(14), fill=mix((150, 150, 160), p))
        show = clamp((u - 1.2 - i * 0.35) / 0.3)
        if show > 0:
            d.rounded_rectangle((790, y + 20, 890, y + 52), radius=16, fill=mix(WHITE, show))
            d.text((840, y + 36), 'скрыто', font=f_mono(13), fill=mix((11, 11, 13), show), anchor='mm')
        ry += 84


def draw_chat(d, u):
    items = [
        (90, 1200, 430, 72, 'привет, все на созвоне?', (36, 36, 43), (225, 225, 230), 0.5),
        (390, 1292, 260, 66, 'через 5 минут', (235, 235, 240), (11, 11, 13), 1.1),
        (90, 1378, 230, 62, 'ок', (36, 36, 43), (225, 225, 230), 1.7),
    ]
    for x, y, wdt, hgt, text, fill, fg, t0 in items:
        p = ease((u - t0) / 0.45)
        yy = y + int((1 - p) * 20)
        d.rounded_rectangle((x, yy, x + wdt, yy + hgt), radius=18, fill=mix(fill, p))
        d.text((x + 22, yy + hgt / 2), text, font=f_reg(20), fill=mix(fg, p), anchor='lm')


def draw_downloads(d, u):
    rows = [('mod-for-pc.mp4', 0.78), ('stickers.zip', 0.44), ('clip.gif', 1.0)]
    ry = 1200
    for i, (name, target) in enumerate(rows):
        p = ease((u - 0.5 - i * 0.25) / 0.5)
        fill = target * ease((u - 0.7 - i * 0.25) / 2.0)
        d.rounded_rectangle((90, ry, 910, ry + 76), radius=16, fill=(20, 20, 25))
        d.rounded_rectangle((108, ry + 20, 144, ry + 56), radius=8, fill=mix((60, 60, 68), p))
        d.text((164, ry + 26), name, font=f_mono(19), fill=mix((225, 225, 230), p))
        d.rounded_rectangle((164, ry + 56, 690, ry + 60), radius=2, fill=(54, 54, 62))
        d.rounded_rectangle((164, ry + 56, 164 + int(526 * fill), ry + 60), radius=2, fill=WHITE)
        d.text((710, ry + 38), f'{int(fill * 100)}%', font=f_mono(16), fill=(150, 150, 160), anchor='lm')
        ry += 92


def draw_privacy(d, u):
    rows = [('Экспорт настроек', True, 1.0), ('Панель приватности', False, 1.8), ('Safe mode', True, 2.6)]
    ry = 1200
    for label, on, t0 in rows:
        flip = ease((u - t0) / 0.4)
        d.rounded_rectangle((90, ry, 910, ry + 76), radius=16, fill=(20, 20, 25))
        d.text((112, ry + 38), label, font=f_reg(21), fill=(225, 225, 230), anchor='lm')
        pos = clamp(flip if on else 1 - flip)
        fill = mix((54, 54, 62), pos, (242, 242, 244))
        d.rounded_rectangle((812, ry + 22, 908, ry + 54), radius=16, fill=fill)
        knob_x = int(832 + 52 * (flip if on else 1 - flip))
        d.ellipse((knob_x - 12, ry + 26, knob_x + 12, ry + 50), fill=(11, 11, 13) if pos > 0.5 else (140, 140, 150))
        ry += 92


def draw_plugins(d, u):
    d.rounded_rectangle((90, 1200, 910, 1450), radius=20, fill=(20, 20, 25), outline=(56, 56, 64), width=1)
    lines = [
        ('octo.ui.panelRow({', (170, 170, 180)),
        ("  id: 'focus',", (210, 210, 218)),
        ("  run: () => octo.notify('ok')", (210, 210, 218)),
        ('})', (170, 170, 180)),
    ]
    for i, (text, color) in enumerate(lines):
        p = ease((u - 0.6 - i * 0.3) / 0.45)
        if p <= 0:
            continue
        d.text((114, 1226 + i * 46), text, font=f_mono(20), fill=mix(color, p))
    d.text((114, 1414), 'hot reload · SDK · permissions', font=f_mono(15), fill=(120, 120, 130))


def draw_os(d, u):
    chips = ['SMTC', 'MPRIS', 'QR', 'Browser']
    x = 90
    for i, text in enumerate(chips):
        p = ease((u - 0.5 - i * 0.25) / 0.45)
        y = 1200 + int((1 - p) * 18)
        wdt = 190
        d.rounded_rectangle((x, y, x + wdt, y + 92), radius=20, fill=mix((20, 20, 25), p), outline=(56, 56, 64), width=1)
        d.text((x + wdt / 2, y + 46), text, font=f_mono(24), fill=mix(WHITE, p), anchor='mm')
        x += wdt + 16


MOTIFS = {
    'keys': draw_keys,
    'eq': draw_eq,
    'pip': draw_pip,
    'marks': draw_marks,
    'feed': draw_feed,
    'chat': draw_chat,
    'downloads': draw_downloads,
    'privacy': draw_privacy,
    'plugins': draw_plugins,
    'os': draw_os,
}


def chapter_img(index, u, final=False):
    img = BASE_IMG.copy()
    d = ImageDraw.Draw(img)
    label, title, items, motif = CHAPTERS[index]
    header(d, index + 1, len(CHAPTERS))

    p_num = 1.0 if final else ease((u - 0.0) / 0.5)
    d.text((84, 300 + int((1 - p_num) * 40)), f'{index + 1:02d}', font=f_semi(300),
           fill=mix((24, 24, 30), p_num))

    p_lab = 1.0 if final else ease((u - 0.15) / 0.45)
    d.text((90, 660 + int((1 - p_lab) * 20)), label.upper(), font=f_mono(22),
           fill=mix((140, 140, 150), p_lab))

    p_tit = 1.0 if final else ease((u - 0.25) / 0.5)
    d.text((90, 700 + int((1 - p_tit) * 24)), title, font=f_semi(62), fill=mix(WHITE, p_tit))

    for i, item in enumerate(items):
        p = 1.0 if final else ease((u - 0.45 - i * 0.12) / 0.45)
        y = 850 + i * 74 + int((1 - p) * 18)
        d.rounded_rectangle((90, y + 9, 98, y + 17), radius=1, fill=mix(WHITE, p))
        d.text((118, y), item, font=f_reg(28), fill=mix((200, 200, 208), p))

    p_mot = 1.0 if final else ease((u - 0.6) / 0.5)
    if p_mot > 0.01:
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        MOTIFS[motif](ld, u)
        layer.putalpha(layer.getchannel('A').point(lambda a: int(a * p_mot)))
        img = Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')
        d = ImageDraw.Draw(img)

    d.text((90, 1652), 'TikTok octo 1.0', font=f_mono(17), fill=(110, 110, 120))
    return img


def logo_layer(size, center, alpha=1.0):
    lg = Image.open(os.path.join(ASSETS, 'tiktok-octo.png')).convert('RGBA')
    lg = lg.resize((size, size), Image.LANCZOS)
    if alpha < 1:
        lg.putalpha(lg.getchannel('A').point(lambda a: int(a * alpha)))
    return lg, (int(center[0] - size / 2), int(center[1] - size / 2))


def intro_img(u):
    img = BASE_IMG.copy()
    p = ease(u / 0.8)
    size = int(380 * (0.92 + 0.08 * p))
    lg, pos = logo_layer(size, (540, 520), clamp(u / 0.5))
    img = img.convert('RGBA')
    img.alpha_composite(lg, pos)
    d = ImageDraw.Draw(img)

    pw = ease((u - 0.25) / 0.6)
    d.text((540, 900 + int((1 - pw) * 24)), 'TikTok octo', font=f_semi(92), fill=mix(WHITE, pw), anchor='mm')
    p1 = ease((u - 0.4) / 0.6)
    d.text((540, 1090 + int((1 - p1) * 30)), '1.0', font=f_semi(210), fill=mix(WHITE, p1), anchor='mm')
    ps = ease((u - 0.6) / 0.6)
    d.text((540, 1250), '58 ИЗМЕНЕНИЙ · 10 ГЛАВ', font=f_mono(24), fill=mix((150, 150, 160), ps), anchor='mm')
    return img.convert('RGB')


def outro_img(u):
    img = BASE_IMG.copy()
    p = ease(u / 0.7)
    size = int(300 * (0.94 + 0.06 * p))
    lg, pos = logo_layer(size, (540, 400), clamp(u / 0.5))
    img = img.convert('RGBA')
    img.alpha_composite(lg, pos)
    d = ImageDraw.Draw(img)

    pt = ease((u - 0.2) / 0.6)
    d.text((540, 610 + int((1 - pt) * 24)), '1.0 — уже здесь', font=f_semi(76), fill=mix(WHITE, pt), anchor='mm')
    d.text((540, 700), 'Забирай в Telegram', font=f_reg(28), fill=mix((200, 200, 208), pt), anchor='mm')

    pc = ease((u - 0.35) / 0.6)
    card_x, card_y, card_w = 260, 790, 560
    d.rounded_rectangle((card_x, card_y, card_x + card_w, card_y + 560), radius=44, fill=mix((244, 244, 246), pc))
    if pc > 0.05:
        qr = Image.open(os.path.join(ASSETS, 'telegram-qr.png')).convert('RGB')
        qr = qr.resize((380, 380), Image.NEAREST)
        qr.putalpha(int(255 * pc))
        img.paste(qr, (350, 840), qr)
        d = ImageDraw.Draw(img)
    d.text((540, 1250), 't.me/tiktok_octo', font=f_mono(40), fill=mix((11, 11, 13), pc), anchor='mm')
    d.text((540, 1610), 'LINUX · WINDOWS · MACOS', font=f_mono(20), fill=(140, 140, 150), anchor='mm')
    d.text((540, 1660), 'github.com/octomood/tiktok-octo', font=f_mono(17), fill=(100, 100, 110), anchor='mm')
    return img.convert('RGB')


def frame(t):
    # определяем карту и переход
    if t < INTRO_DUR:
        if t > INTRO_DUR - WIPE:
            q = (t - (INTRO_DUR - WIPE)) / WIPE
            q = q * q * (3 - 2 * q)
            a = intro_img(INTRO_DUR)
            b = chapter_img(0, LEAD)
            off = int(H * q)
            out = Image.new('RGB', (W, H), (8, 8, 10))
            out.paste(a, (0, -off))
            out.paste(b, (0, H - off))
            return out
        return intro_img(t)

    if t < OUTRO_START:
        i = int((t - INTRO_DUR) // CH_DUR)
        u = t - CH_START[i]
        if u > CH_DUR - WIPE and i + 1 < len(CHAPTERS):
            q = (u - (CH_DUR - WIPE)) / WIPE
            q = q * q * (3 - 2 * q)
            a = chapter_img(i, CH_DUR, final=True)
            b = chapter_img(i + 1, LEAD)
            off = int(H * q)
            out = Image.new('RGB', (W, H), (8, 8, 10))
            out.paste(a, (0, -off))
            out.paste(b, (0, H - off))
            return out
        img = chapter_img(i, u + LEAD)
        progress_bar(img, i, u / CH_DUR)
        return img

    # финал
    u = t - OUTRO_START
    if u > OUTRO_DUR - WIPE:
        q = (u - (OUTRO_DUR - WIPE)) / WIPE
        q = q * q * (3 - 2 * q)
        a = chapter_img(len(CHAPTERS) - 1, CH_DUR, final=True)
        b = outro_img(LEAD)
        off = int(H * q)
        out = Image.new('RGB', (W, H), (8, 8, 10))
        out.paste(a, (0, -off))
        out.paste(b, (0, H - off))
        return out
    out = outro_img(u + LEAD)
    progress_bar(out, len(CHAPTERS) - 1, 1.0)
    return out


def main():
    audio = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'build-release', 'audio.wav')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, 'tiktok-octo-1.0-60s.mp4')
    poster = sys.argv[3] if len(sys.argv) > 3 else os.path.join(BASE, 'release-1.0.png')

    if '--poster' in sys.argv:
        i = sys.argv.index('--poster')
        if i + 1 < len(sys.argv):
            poster = sys.argv[i + 1]
        intro_img(1.2).save(poster)
        print('poster', poster)
        return

    cmd = [
        'ffmpeg', '-hide_banner', '-v', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-i', audio,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-level', '4.2',
        '-x264-params', 'aq-mode=3:deblock=1,-1',
        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-shortest', '-movflags', '+faststart', out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for i in range(total):
        img = frame(i / FPS)
        proc.stdin.write(img.tobytes())
        if i % 150 == 0:
            print(f'  {i}/{total}')
    proc.stdin.close()
    proc.wait()
    print('done', out)


if __name__ == '__main__':
    main()
