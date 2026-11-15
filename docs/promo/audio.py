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

# 1. Бренд
place(thock(0.55, f0=150), 0.48, gain=0.85)
place(bell(1318.5, 2.2), 0.05, gain=0.05, pan=0.15)
place(swell(0.5, 0.10, 58), 0.05, gain=0.5)
place(whoosh(0.6, up=True, amp=0.06), 0.32, gain=0.9, pan=-0.2)
place(whoosh(0.6, up=True, amp=0.045), 0.62, gain=0.9, pan=0.25)
place(pluck(110.0, 1.9, 0.9), 0.44, gain=0.32, pan=-0.1)
place(pluck(164.81, 1.7, 0.9), 0.76, gain=0.22, pan=0.1)
place(pluck(220.0, 1.5, 0.85), 1.02, gain=0.18, pan=-0.06)
place(bell(659.25, 2.4), 1.12, gain=0.10, pan=0.2)
place(pluck(261.63, 1.4, 0.8), 1.38, gain=0.13, pan=0.12)
place(pluck(329.63, 1.4, 0.8), 1.7, gain=0.09, pan=-0.12)
place(swell(0.55, 0.12, 50), 1.95, gain=0.5)
place(whoosh(0.45, up=False, amp=0.05), 2.2, gain=0.9, pan=0.2)

# 2. Окно на десктопе
place(whoosh(0.55, up=True, amp=0.06), 2.4, gain=0.9, pan=-0.15)
place(thock(0.62, f0=245), 3.14, gain=0.95)
place(pluck(220.0, 1.6, 0.9), 3.16, gain=0.24, pan=-0.12)
place(bell(987.77, 2.0), 3.22, gain=0.06, pan=0.25)
for i, dt in enumerate([2.98, 3.08, 3.18, 3.28, 3.38]):
    place(tick(2100 + i * 90, 0.085 + rng.uniform(-0.01, 0.01)), dt, gain=0.95, pan=-0.3 + i * 0.14)
place(pluck(329.63, 1.5, 0.75), 3.46, gain=0.12, pan=0.15)
place(pluck(392.0, 1.3, 0.7), 4.06, gain=0.08, pan=-0.18)
# курсор: клик по «поверх всех»
place(tick(1750, 0.5), 4.43, gain=0.35, pan=0.05)
place(keytap(0.55, 1200), 4.44, gain=0.9, pan=0.06)
place(bell(1174.66, 1.6), 4.47, gain=0.075, pan=0.12)
place(whoosh(0.4, up=False, amp=0.05), 5.34, gain=0.9, pan=0.15)
place(whoosh(0.45, up=True, amp=0.055), 5.5, gain=0.9, pan=-0.1)

# 3. Поверх всех окон
place(thock(0.5, f0=225), 6.16, gain=0.8)
place(bell(880.0, 2.4), 6.2, gain=0.10, pan=0.2)
place(pad([110.0, 164.81, 220.0], 2.3, 0.10, cutoff=1400, attack=0.8, release=0.9), 6.3, gain=1.0)
place(tick(1900, 0.06), 6.6, gain=0.7, pan=-0.25)
place(whoosh(0.4, up=False, amp=0.05), 8.14, gain=0.9, pan=-0.15)
place(whoosh(0.4, up=True, amp=0.05), 8.3, gain=0.9, pan=0.15)

# 4. Клавиатура
place(pad([110.0, 164.81, 261.63], 3.0, 0.075, cutoff=1100, attack=0.6, release=0.7), 8.5, gain=1.0)
for i, dt in enumerate([8.46, 8.53, 8.6, 8.67]):
    place(tick(2500 + i * 70, 0.05), dt, gain=0.55, pan=-0.3 + i * 0.2)
for i, dt in enumerate([9.28, 9.86, 10.44, 11.0]):
    place(keytap(0.7, 1350 + i * 60), dt, gain=0.85, pan=-0.28 + i * 0.18)
    place(tick(2200 + i * 80, 0.04), dt + 0.005, gain=0.45, pan=-0.28 + i * 0.18)
place(swell(0.7, 0.13, 45), 11.25, gain=0.55)
place(whoosh(0.4, up=False, amp=0.05), 11.55, gain=0.85, pan=0.1)

# 5. Финал
place(thock(0.42, f0=175), 12.02, gain=0.55)
place(pad([110.0, 164.81, 261.63, 392.0, 493.88], 2.8, 0.21, cutoff=2400, attack=0.5, release=1.3), 12.05, gain=1.0)
place(bell(880.0, 2.6), 12.2, gain=0.10, pan=-0.18)
place(bell(1046.5, 2.4), 12.4, gain=0.085, pan=0.18)
place(bell(1318.5, 2.2), 12.6, gain=0.07, pan=-0.1)
place(pluck(220.0, 1.8, 0.8), 12.95, gain=0.15, pan=0.16)
place(pluck(329.63, 1.6, 0.7), 13.3, gain=0.08, pan=-0.16)


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
