#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Весёлый саундтрек к 30-секундному промо-ролику TikTok Octo v2.0 (MD3 Expressive).
120 BPM, светлый мажорный грув (C - G - Am - F), маримба, электропиано, бас,
ударные и мягкие тактильные фоли интерфейса. Без внешних сэмплов.
"""

import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(20261126)

BEAT = 0.5  # 120 BPM (ровно 2 удара в секунду; смены сцен на 4.0, 9.2, 14.6, 19.8, 24.8)
mix = np.zeros((N, 2), dtype=np.float64)


def place(buf, x, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), N - i)
    if x.ndim == 2:
        buf[i:i + n] += x[:n] * gain
        return
    a = (pan + 1.0) * np.pi / 4.0
    buf[i:i + n, 0] += x[:n] * gain * np.cos(a)
    buf[i:i + n, 1] += x[:n] * gain * np.sin(a)


def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='low', output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='high', output='sos')
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band', output='sos')
    return signal.sosfilt(sos, x)


def env_exp(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1.0, t / max(attack, 1e-5)) * np.exp(-t / decay)


def marimba(freq, dur=0.45):
    """Яркая, тёплая маримба / ксилофон для весёлой мелодии."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (
        np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.16)
        + 0.32 * np.sin(2 * np.pi * freq * 4.0 * t) * np.exp(-t / 0.035)
        + 0.12 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t / 0.08)
    )
    mallet = lp(rng.normal(0, 0.18, n), 3400) * np.exp(-t / 0.004)
    return (y + mallet) * np.minimum(1.0, t / 0.002)


def epiano_chord(freqs, dur=1.6):
    """Тёплое электропиано (Rhodes-подобный FM) для мажорных аккордов."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        mod = 1.4 * np.exp(-t / 0.14) * np.sin(2 * np.pi * f * 2.0 * t)
        car = np.sin(2 * np.pi * f * t + mod)
        warm = 0.25 * np.sin(2 * np.pi * f * 0.5 * t)
        sig += (car + warm) * env_exp(n, 0.01, dur * 0.55)
    return lp(sig / max(len(freqs), 1), 4200)


def bass_pluck(freq, dur=0.42):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(4 * np.pi * freq * t)
    return lp(np.tanh(y * 1.35), 320) * env_exp(n, 0.005, dur * 0.55)


def kick():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 48.0 + 110.0 * np.exp(-t / 0.024)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = lp(rng.normal(0, 0.22, n), 2400) * np.exp(-t / 0.006)
    return (np.sin(ph) * env_exp(n, 0.002, 0.11) + click) * 0.85


def clap():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    nz = bp(rng.normal(0, 1, n), 900, 5600)
    return nz * env_exp(n, 0.002, 0.042) * 0.52


def shaker(accent=False):
    n = int((0.1 if accent else 0.05) * SR)
    t = np.arange(n) / SR
    nz = hp(rng.normal(0, 1, n), 6800)
    return nz * env_exp(n, 0.002, 0.032 if accent else 0.014) * (0.28 if accent else 0.17)


def ui_pop(freq=720.0):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = freq * (1.0 + 0.45 * np.exp(-t / 0.018))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(n, 0.0015, 0.035) * 0.45


def chime(freq, dur=0.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2.0 * t)
    return y * env_exp(n, 0.003, dur * 0.3)


def whoosh(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = bp(rng.normal(0, 1, n), 350, 3800)
    env = np.sin(np.pi * t / dur) ** 1.6
    return nz * env * 0.24


# --------------------------------------------------------------------------
# 1) Интро (0.0 .. 4.0s): приветливое восходящее арпеджио + аккорды
# --------------------------------------------------------------------------
intro_notes = [
    (0.08, 523.25),  # C5
    (0.24, 659.25),  # E5
    (0.40, 783.99),  # G5
    (0.56, 1046.5),  # C6
    (1.00, 783.99),  # G5
    (1.25, 880.00),  # A5
    (1.50, 1046.5),  # C6
    (2.00, 698.46),  # F5
    (2.25, 880.00),  # A5
    (2.50, 1046.5),  # C6
    (3.00, 783.99),  # G5
    (3.25, 987.77),  # B5
    (3.50, 1174.66), # D6
]
for tn, fn in intro_notes:
    place(mix, marimba(fn, 0.48), tn, 0.36, -0.15 if tn % 0.5 < 0.2 else 0.15)

place(mix, epiano_chord([261.63, 329.63, 392.00, 493.88], 1.9), 0.05, 0.52)
place(mix, epiano_chord([349.23, 440.00, 523.25, 659.25], 1.9), 2.00, 0.52)
place(mix, ui_pop(640.0), 0.12, 0.5)
place(mix, whoosh(0.42), 3.62, 0.85)

# --------------------------------------------------------------------------
# 2) Основная гармония C - G - Am - F (по 2 секунды на аккорд, 4.0 .. 30.0s)
# --------------------------------------------------------------------------
prog = [
    ([261.63, 329.63, 392.00, 493.88], 130.81),  # Cmaj7 / C3
    ([196.00, 246.94, 293.66, 392.00], 98.00),   # G6 / G2
    ([220.00, 261.63, 329.63, 392.00], 110.00),  # Am7 / A2
    ([174.61, 220.00, 261.63, 329.63], 87.31),   # Fmaj7 / F2
]

# Вкусный мажорный рифф маримбы на 2-секундный бар (по 8-м долям)
melody_patterns = [
    [(0.0, 523.25), (0.5, 659.25), (0.75, 783.99), (1.25, 659.25), (1.5, 783.99)],
    [(0.0, 587.33), (0.5, 783.99), (0.75, 987.77), (1.25, 783.99), (1.5, 659.25)],
    [(0.0, 523.25), (0.5, 659.25), (0.75, 880.00), (1.25, 783.99), (1.5, 659.25)],
    [(0.0, 440.00), (0.5, 523.25), (0.75, 698.46), (1.25, 659.25), (1.5, 587.33)],
]

for bar_idx in range(13):  # 4.0 .. 30.0s = 13 баров по 2.0s
    t_bar = 4.0 + bar_idx * 2.0
    if t_bar >= 29.2:
        break
    ch, bass_f = prog[bar_idx % 4]
    pat = melody_patterns[bar_idx % 4]

    dur_ch = 1.9 if t_bar < 26.0 else 3.4
    place(mix, epiano_chord(ch, dur_ch), t_bar, 0.56)

    # Прыгучий весёлый бас на 1, 2.5, 3, 4
    for bo, g in [(0.0, 0.55), (0.75, 0.42), (1.0, 0.52), (1.5, 0.44)]:
        if t_bar + bo < 28.8:
            place(mix, bass_pluck(bass_f, 0.36), t_bar + bo, g)

    # Мелодия маримбы (в финале 26..30 чуть спокойнее)
    if t_bar < 28.0:
        for mo, mf in pat:
            if t_bar + mo < 28.4:
                pan = -0.22 if (mo * 4) % 2 == 0 else 0.22
                place(mix, marimba(mf, 0.4), t_bar + mo, 0.30, pan)

# --------------------------------------------------------------------------
# 3) Ударные (4.0 .. 28.5s)
# --------------------------------------------------------------------------
t = 4.0
step = 0
while t < 28.4:
    # Короткая пауза перед финалом (24.5..24.8) для сочного импакта
    if not (24.5 <= t < 24.8):
        place(mix, kick(), t, 0.52)
        if step % 2 == 1:
            place(mix, clap(), t, 0.34, 0.05)
        place(mix, shaker(step % 4 == 3), t + BEAT * 0.5, 0.24, -0.25 if step % 2 == 0 else 0.25)
    t += BEAT
    step += 1

# --------------------------------------------------------------------------
# 4) Синхронные фоли к страницам и UI-анимациям
# --------------------------------------------------------------------------
for tc in (4.0, 9.2, 14.6, 19.8, 24.8):
    place(mix, whoosh(0.32), tc - 0.14, 0.85)
    place(mix, chime(1046.5 if tc < 24.8 else 1318.5, 0.9), tc, 0.22, 0.1)

# Страница 1: тумблер (6.2s) и кнопка PiP (7.2s)
place(mix, ui_pop(840.0), 6.20, 0.55, 0.15)
place(mix, ui_pop(960.0), 7.20, 0.45, -0.15)

# Страница 2: переключение 5 палитр (9.2, 10.28, 11.36, 12.44, 13.52)
palette_pitches = [660.0, 740.0, 830.0, 932.0, 1046.5]
for idx, fp in enumerate(palette_pitches):
    tp = 9.2 + idx * 1.08
    if idx > 0:
        place(mix, ui_pop(fp), tp, 0.52, -0.2 + 0.1 * idx)
        place(mix, marimba(fp * 1.5, 0.35), tp, 0.24, 0.2)

# Страница 3: появление плагинов (16.5s) и смена вкладки (17.3s)
place(mix, ui_pop(780.0), 16.50, 0.55)
place(mix, ui_pop(920.0), 17.30, 0.45, -0.2)

# Страница 4: переключение режима ленты на Широкий (22.0s)
place(mix, whoosh(0.24), 21.92, 0.65)
place(mix, ui_pop(880.0), 22.00, 0.55)

# Финал (24.8s): радостный каскад колокольчиков
for k, freq in enumerate((1046.5, 1318.5, 1567.98, 2093.0)):
    place(mix, chime(freq, 1.3), 24.82 + k * 0.08, 0.22, -0.3 + 0.2 * k)

# --------------------------------------------------------------------------
# 5) Мастеринг: -14 LUFS, пик <= -1 dBFS
# --------------------------------------------------------------------------
bus = np.stack([hp(mix[:, 0], 30), hp(mix[:, 1], 30)], axis=1)
thr = 0.13
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.04 * SR))
env = gaussian_filter1d(env, sigma=0.016 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 4.0) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.32) / np.tanh(1.32)

fade_in = int(0.02 * SR)
fade_out = int(0.55 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5

rms = np.sqrt(np.mean(bus ** 2))
bus *= 0.174 / max(rms, 1e-9)
peak = np.max(np.abs(bus))
if peak > 0.89:
    bus *= 0.89 / peak

out_path = sys.argv[1]
wavfile.write(out_path, SR, (np.clip(bus, -1.0, 1.0) * 32767.0).astype(np.int16))
print(f'audio ok: {out_path}')
