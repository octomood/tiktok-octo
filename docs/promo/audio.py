#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к промо TikTok octo — 15 секунд.

Никакой генеративной музыки: все звуки собраны вручную из синусов,
фильтрованного шума и свёрточной реверберации. Это привычный «фоли»
язык интерфейса: деревянные щелчки, стеклянные пинг-понги, воздушные
протяжки и тёплый аккорд в финале.

    python3 docs/promo/audio.py docs/promo/build/audio.wav
"""

import sys
import wave
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(20261115)

mix = np.zeros((N, 2), dtype=np.float64)


# --------------------------------------------------------------------------
# утилиты
# --------------------------------------------------------------------------

def place(x, t0, gain=1.0, pan=0.0):
    """Кладём моно-событие в стерео-шину с панорамой -1..1."""
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), N - i)
    a = (pan + 1) * np.pi / 4
    mix[i:i + n, 0] += x[:n] * gain * np.cos(a)
    mix[i:i + n, 1] += x[:n] * gain * np.sin(a)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band', output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='low', output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='high', output='sos')
    return signal.sosfilt(sos, x)


def env_ad(n, attack, decay):
    """Атака + экспоненциальный спад."""
    t = np.arange(n) / SR
    a = np.minimum(1.0, t / max(attack, 1e-4))
    return a * np.exp(-np.maximum(0, t - attack) / decay)


# --------------------------------------------------------------------------
# голоса
# --------------------------------------------------------------------------

def pluck(freq, dur=1.5, bright=1.0, amp=1.0):
    """Деревянно-стеклянный щипок: маримба, а не синт-лид."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    # (отношение, амплитуда, спад в секундах) — слегка негармоничные обертоны
    partials = [
        (1.000, 1.00, 0.95),
        (2.006, 0.30 * bright, 0.55),
        (3.015, 0.15 * bright, 0.34),
        (4.930, 0.08 * bright, 0.22),
        (6.580, 0.04 * bright, 0.14),
    ]
    for ratio, a, tau in partials:
        det = 1 + rng.normal(0, 0.0006)
        ph = rng.uniform(0, 2 * np.pi)
        y += a * np.sin(2 * np.pi * freq * ratio * det * t + ph) * np.exp(-t / tau)
    # щелчок молоточка
    nc = int(0.004 * SR)
    click = lp(rng.standard_normal(nc), 7500, 2) * np.exp(-np.arange(nc) / (0.0007 * SR))
    y[:nc] += 0.10 * bright * click
    y *= np.minimum(1.0, (dur - t) / 0.12)
    return y * amp / 1.7


def bell(freq, dur=2.4, amp=1.0):
    """Стеклянный пинг: негармоничные партиалы, длинный хвост."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 1.55), (2.76, 0.34, 0.85), (5.40, 0.16, 0.5), (8.93, 0.07, 0.3)]:
        ph = rng.uniform(0, 2 * np.pi)
        y += a * np.sin(2 * np.pi * freq * ratio * t + ph) * np.exp(-t / tau)
    y *= np.minimum(1.0, t / 0.003)
    y *= np.minimum(1.0, (dur - t) / 0.4)
    return y * amp / 1.6


def thock(amp=1.0, f0=210.0):
    """Деревянный стук — карточка легла на поверхность."""
    dur = 0.4
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 52 + f0 * np.exp(-t * 10)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    knock = bp(rng.standard_normal(n), 500, 2600) * np.exp(-t / 0.012) * 0.55
    sub = np.sin(2 * np.pi * 58 * t) * np.exp(-t / 0.14) * 0.22
    y = body * 0.8 + knock + sub
    y *= np.minimum(1.0, t / 0.0015)
    return y * amp


def tick(freq=2300.0, amp=1.0, dur=0.05):
    """Мягкий кейкап-щелчок: короткий шум + едва слышный тон."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1800, min(9000, SR / 2 - 500))
    noise *= np.exp(-t / 0.004)
    tone = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006)
    y = noise / max(np.max(np.abs(noise)), 1e-9) * 0.7 + tone * 0.25
    y *= np.minimum(1.0, t / 0.0008)
    return y * amp


def pop(f0=520.0, f1=880.0, dur=0.09, amp=1.0):
    """Пузырьковый «поп» для тостов и чипов."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    y *= np.minimum(1.0, t / 0.002)
    return y * amp


def bass(freq, dur=0.45, amp=1.0):
    """Мягкий низкий щипок для грува."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (
        np.sin(2 * np.pi * freq * t) * 0.8
        + 0.25 * np.sin(2 * np.pi * freq * 2 * t)
    ) * np.exp(-t / 0.16)
    y *= np.minimum(1.0, t / 0.006)
    return y * amp


def rhodes(freq, dur=2.4, amp=1.0, idx=1.1):
    """Тёплое электропиано: лёгкая FM-модуляция и мягкая атака."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = idx * np.exp(-t / 0.4) * np.sin(2 * np.pi * freq * 2 * t)
    y = np.sin(2 * np.pi * freq * t + mod)
    y *= np.exp(-t / 1.5) * np.minimum(1.0, t / 0.014)
    y += 0.12 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t / 0.5)
    return y * amp


def kick(amp=1.0, f0=70.0):
    """Мягкая бочка для лоу-фая."""
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 42 + f0 * np.exp(-t * 22)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    y *= np.minimum(1.0, t / 0.002)
    return y * amp


def shaker(amp=1.0):
    """Шейкер: короткий шумовой хвост."""
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 4200, 11000) * np.exp(-t / 0.018)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def rim(amp=1.0):
    """Римшот вместо малого."""
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 1400, 3800) * np.exp(-t / 0.012)
    y += 0.4 * np.sin(2 * np.pi * 620 * t) * np.exp(-t / 0.02)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def keytap(amp=1.0, f=1500.0):
    """Мягкое механическое нажатие: короткий стук по клавише."""
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    click = bp(rng.standard_normal(n), 700, 4200) * np.exp(-t / 0.008)
    body = np.sin(2 * np.pi * f * 0.13 * t) * np.exp(-t / 0.02)
    y = click * 0.8 + body * 0.35
    y *= np.minimum(1.0, t / 0.0012)
    return y * amp


def whoosh(dur=0.55, up=True, amp=1.0):
    """Воздушная протяжка: шум, у которого едет полоса."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    lo = bp(noise, 180, 700)
    mid = bp(noise, 700, 2400)
    hi = bp(noise, 2400, 8500)
    p = t / dur
    if not up:
        p = 1 - p
    # плавная кривая 0..1
    p = p * p * (3 - 2 * p)
    # полоса скользит снизу вверх (или обратно), с весом по трём слоям
    w_lo = np.clip(1 - p * 1.6, 0, 1)
    w_mid = np.clip(1 - np.abs(p - 0.45) * 2.6, 0, 1)
    w_hi = np.clip(p * 1.3 - 0.3, 0, 1)
    y = lo * w_lo * 0.9 + mid * w_mid * 0.75 + hi * w_hi * 0.55
    # огибающая-«дыхание»
    env = np.sin(np.pi * (t / dur) ** 0.8) ** 1.4
    y *= env
    return y * amp


def swell(dur=1.1, amp=1.0, f0=48.0):
    """Низкий подъём перед ударом."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    gl = f0 * (1 + 0.85 * p ** 1.6)
    tone = np.sin(2 * np.pi * np.cumsum(gl) / SR) * (p ** 2.2) * 0.55
    air = bp(rng.standard_normal(n), 400, 2800) * (p ** 1.6) * 0.35
    y = tone + air
    y *= np.sin(np.pi * np.clip(t / dur, 0, 1) * 0.5) ** 0.5
    return y * amp


def pad(freqs, dur=2.6, amp=1.0, cutoff=2600.0, attack=0.55, release=1.1):
    """Тёплая подушка: синусы с малым расщеплением, без пилы и без луфса."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.0016, 0.0016):
            y += (
                np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28))
                + 0.20 * np.sin(2 * np.pi * f * 2 * (1 + det) * t)
                + 0.06 * np.sin(2 * np.pi * f * 3 * (1 + det) * t)
            )
    y = lp(y, cutoff)
    env = np.minimum(1.0, t / attack) ** 1.2 * np.minimum(1.0, (dur - t) / release)
    return y * env * amp / (len(freqs) * 2.0)


# --------------------------------------------------------------------------
# 15 секунд: события
# --------------------------------------------------------------------------

# 1. Логотип
place(swell(0.45, 0.10, 58), 0.02, gain=0.5)
place(thock(0.6, f0=150), 0.36, gain=0.9)
place(bell(1318.5, 2.0), 0.34, gain=0.06, pan=0.15)
place(whoosh(0.5, up=True, amp=0.055), 0.16, gain=0.9, pan=-0.2)
place(whoosh(0.5, up=True, amp=0.04), 0.44, gain=0.9, pan=0.25)
place(pluck(110.0, 1.7, 0.9), 0.36, gain=0.3, pan=-0.1)
place(pluck(164.81, 1.5, 0.9), 0.66, gain=0.22, pan=0.1)
place(bell(659.25, 2.2), 0.7, gain=0.1, pan=0.2)
place(pluck(220.0, 1.4, 0.85), 0.94, gain=0.18, pan=-0.06)
place(pluck(261.63, 1.3, 0.8), 1.2, gain=0.13, pan=0.12)
place(pluck(329.63, 1.3, 0.8), 1.48, gain=0.1, pan=-0.12)
place(whoosh(0.4, up=False, amp=0.05), 1.72, gain=0.9, pan=0.2)

# 2. Первый мод: удар стикера и грув
place(whoosh(0.38, up=False, amp=0.12), 2.1, gain=1.0, pan=0.05)
place(thock(1.0, f0=115), 2.3, gain=1.0)
place(tick(850, 0.5), 2.3, gain=1.0, pan=0.0)
place(bell(220.0, 1.2), 2.31, gain=0.08, pan=0.1)
place(bass(55.0, 0.6, 0.55), 2.32, gain=0.9)
# маримба-риф 120 BPM
riff = [220.0, 261.63, 329.63, 440.0, 392.0, 329.63, 261.63, 220.0]
for i, f in enumerate(riff):
    place(pluck(f, 1.0, 0.95), 2.58 + i * 0.235, gain=0.15 - i * 0.006, pan=-0.26 + (i % 2) * 0.52)
place(bass(55.0, 0.5, 0.45), 2.58, gain=0.8)
place(bass(43.65, 0.5, 0.4), 3.29, gain=0.8)
place(bass(49.0, 0.5, 0.4), 4.0, gain=0.7)
place(tick(2400, 0.06), 3.05, gain=0.5, pan=0.3)
place(tick(2700, 0.05), 3.76, gain=0.45, pan=-0.3)
place(whoosh(0.4, up=False, amp=0.06), 4.86, gain=0.9, pan=0.15)

# 3. Окно и клик
place(whoosh(0.45, up=True, amp=0.06), 5.02, gain=0.9, pan=-0.15)
place(thock(0.55, f0=245), 5.52, gain=0.9)
place(pluck(220.0, 1.4, 0.9), 5.54, gain=0.2, pan=-0.12)
for i, dt in enumerate([5.22, 5.31, 5.4, 5.49, 5.58]):
    place(tick(2100 + i * 90, 0.08), dt, gain=0.9, pan=-0.3 + i * 0.14)
place(tick(1750, 0.45), 6.85, gain=0.32, pan=0.05)
place(keytap(0.6, 1200), 6.86, gain=0.9, pan=0.06)
place(bell(1174.66, 1.5), 6.89, gain=0.08, pan=0.12)
place(pop(480, 860, 0.1, 0.5), 7.0, gain=0.9, pan=0.1)
place(whoosh(0.4, up=False, amp=0.05), 8.22, gain=0.9, pan=-0.15)
place(whoosh(0.4, up=True, amp=0.05), 8.36, gain=0.9, pan=0.15)

# 4. Плюшка
place(thock(0.5, f0=225), 9.0, gain=0.8)
place(bell(880.0, 2.2), 9.03, gain=0.1, pan=0.2)
place(pad([110.0, 164.81, 220.0], 2.2, 0.09, cutoff=1400, attack=0.7, release=0.8), 9.1, gain=1.0)
place(pop(520, 980, 0.09, 0.6), 9.36, gain=0.85, pan=-0.2)
place(bell(1318.5, 1.6), 9.38, gain=0.06, pan=-0.2)
place(whoosh(0.4, up=False, amp=0.05), 11.55, gain=0.9, pan=0.1)

# 5. Телеграм
place(swell(0.6, 0.12, 48), 11.62, gain=0.55)
place(thock(0.45, f0=175), 11.95, gain=0.6)
place(pad([110.0, 164.81, 261.63, 392.0, 493.88], 2.7, 0.2, cutoff=2400, attack=0.45, release=1.3), 11.98, gain=1.0)
place(bell(880.0, 2.4), 12.12, gain=0.1, pan=-0.18)
place(bell(1046.5, 2.2), 12.3, gain=0.085, pan=0.18)
place(bell(1318.5, 2.0), 12.48, gain=0.07, pan=-0.1)
# «готово»: восходящее двузвучие на карточке Telegram
place(pluck(659.25, 1.2, 0.9), 12.42, gain=0.16, pan=0.1)
place(pluck(987.77, 1.3, 0.9), 12.55, gain=0.13, pan=-0.1)
place(pluck(220.0, 1.7, 0.8), 12.95, gain=0.14, pan=0.16)
place(pluck(329.63, 1.5, 0.7), 13.3, gain=0.08, pan=-0.16)


# --------------------------------------------------------------------------
# фоновая музыка: 96 BPM, Am9 – Fmaj7 – Cmaj7 – G6, 6 тактов по 2.5 с
# --------------------------------------------------------------------------

music = np.zeros((N, 2), dtype=np.float64)


def place_m(x, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), N - i)
    a = (pan + 1) * np.pi / 4
    music[i:i + n, 0] += x[:n] * gain * np.cos(a)
    music[i:i + n, 1] += x[:n] * gain * np.sin(a)


BAR = 2.5
BPM = 96
BEAT = 60.0 / BPM

chords = [
    (0.0, [110.0, 164.81, 196.0, 246.94, 261.63], 110.0, 164.81),   # Am9
    (2.5, [87.31, 130.81, 164.81, 220.0], 87.31, 130.81),            # Fmaj7
    (5.0, [130.81, 196.0, 246.94, 329.63], 130.81, 196.0),           # Cmaj7
    (7.5, [98.0, 146.83, 246.94, 329.63], 98.0, 196.0),              # G6
    (10.0, [110.0, 164.81, 196.0, 246.94, 261.63], 110.0, 164.81),   # Am9
    (12.5, [87.31, 130.81, 164.81, 220.0], 87.31, 130.81),           # Fmaj7
]

for i, (t0, notes, root, fifth) in enumerate(chords):
    for k, f in enumerate(notes):
        place_m(rhodes(f, 2.6, 0.030 - k * 0.0015), t0 + 0.004 * k, gain=1.0, pan=-0.35 + k * 0.16)
        # мягкий удар на третьей доле
        place_m(rhodes(f, 1.5, 0.013), t0 + 1.25 + 0.004 * k, gain=1.0, pan=-0.35 + k * 0.16)
    place_m(bass(root, 0.55, 0.10), t0, gain=1.0, pan=-0.08)
    place_m(bass(fifth, 0.45, 0.065), t0 + 1.25, gain=1.0, pan=0.08)
    if i >= 1:
        place_m(kick(0.085), t0, gain=1.0, pan=0.0)
        place_m(kick(0.07), t0 + 1.25, gain=1.0, pan=0.0)
    if i >= 2:
        place_m(rim(0.05), t0 + 0.625, gain=1.0, pan=0.2)
        place_m(rim(0.045), t0 + 1.875, gain=1.0, pan=-0.2)
    # шейкер восьмыми с лёгким свингом
    for j in range(8):
        tt = t0 + j * BEAT / 2 + (0.022 if j % 2 else 0.0)
        place_m(shaker(0.013 if j % 2 == 0 else 0.009), tt, gain=1.0, pan=0.28 - 0.56 * (j % 2))

# финальный аккорд-разрешение
for k, f in enumerate([110.0, 164.81, 196.0, 246.94, 261.63]):
    place_m(rhodes(f, 1.9, 0.024), 13.72 + 0.005 * k, gain=1.0, pan=-0.3 + k * 0.15)

music *= 1.55
music = np.stack([hp(music[:, 0], 55), hp(music[:, 1], 55)], axis=1)

# дакинг музыки под фоли
env_sfx = maximum_filter1d(np.max(np.abs(mix), axis=1), size=int(0.12 * SR))
env_sfx = gaussian_filter1d(env_sfx, sigma=0.05 * SR)
duck = 1.0 - 0.5 * np.clip(env_sfx / (np.max(env_sfx) + 1e-9) * 2.2, 0, 1)
music *= duck[:, None]
print('music rms', round(float(20*np.log10(np.sqrt(np.mean(music**2))+1e-12)),1),
      'sfx rms', round(float(20*np.log10(np.sqrt(np.mean(mix**2))+1e-12)),1))
mix += music


# --------------------------------------------------------------------------
# воздух комнаты
# --------------------------------------------------------------------------

room = hp(lp(rng.standard_normal(N), 2400), 120) * 0.004
mod = 0.7 + 0.3 * np.sin(2 * np.pi * np.arange(N) / SR * 0.13 + 1.2)
room *= mod
mix[:, 0] += room * 0.9
mix[:, 1] += np.roll(room, 311) * 0.9


# --------------------------------------------------------------------------
# реверберация: маленькая комната, а не «космос»
# --------------------------------------------------------------------------

def make_ir(seconds=1.5):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.26)[:, None]
    ir = np.stack([lp(ir[:, 0], 5200), lp(ir[:, 1], 5200)], axis=1)
    for d, g in [(0.009, 0.55), (0.017, 0.38), (0.028, 0.26), (0.041, 0.16), (0.057, 0.1)]:
        i = int(d * SR)
        ir[i, 0] += g
        ir[i, 1] += g * 0.9
    ir *= np.linspace(1.0, 0.0, n)[:, None] ** 0.25
    ir /= np.max(np.abs(ir))
    return ir


ir = make_ir(1.0)
wet = np.stack([
    signal.fftconvolve(mix[:, 0], ir[:, 0])[:N],
    signal.fftconvolve(mix[:, 1], ir[:, 1])[:N],
], axis=1)
wet /= max(np.max(np.abs(wet)), 1e-9)
bus = mix + wet * (np.max(np.abs(mix)) * 0.20)
bus *= 1.18


# --------------------------------------------------------------------------
# мастеринг
# --------------------------------------------------------------------------

bus = np.stack([hp(bus[:, 0], 32), hp(bus[:, 1], 32)], axis=1)
# чуть воздуха сверху — чтобы читалось на телефоне
bus += 0.28 * np.stack([hp(bus[:, 0], 3800), hp(bus[:, 1], 3800)], axis=1)

# мягкая компрессия, чтобы звук не «прыгал» в телефоне
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

thr = 0.16
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.045 * SR))
env = gaussian_filter1d(env, sigma=0.018 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 2.4) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]

bus = np.tanh(bus * 1.35) / np.tanh(1.35)

# фейды
fade_in = int(0.012 * SR)
fade_out = int(0.30 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5

peak = np.max(np.abs(bus))
bus = bus / peak * 0.89
# лёгкий фейд в самом конце, чтобы не было щелчка
bus[-48:] *= np.linspace(1, 0, 48)[:, None]

rms = np.sqrt(np.mean(bus ** 2))
print(f'peak {20 * np.log10(np.max(np.abs(bus))):.1f} dBFS · rms {20 * np.log10(rms):.1f} dBFS')

out = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print('wrote', out)
