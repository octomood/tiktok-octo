#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к музыкальному ролику «одно видео» — 20 секунд, 120 BPM, 10 тактов.

Ночной лоу-фай: Rhodes, мягкая бочка, шейкер, бас и тиканье часов. Под бит
идут свайпы, реклама, GIF, таймер сна, статистика и будильник; в 03:01 —
vine boom и скрэтч, в 03:59 — грустный тромбон, в 04:00 — будильник.
Ни одного сэмпла.

    python3 docs/promo/night-audio.py docs/promo/build-night/audio.wav
"""

import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(20261122)

BEAT = 0.5  # 120 BPM
BAR = BEAT * 4

mix = np.zeros((N, 2), dtype=np.float64)     # фоли
music = np.zeros((N, 2), dtype=np.float64)   # музыка


# --------------------------------------------------------------------------
# утилиты
# --------------------------------------------------------------------------

def place(buf, x, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), N - i)
    a = (pan + 1) * np.pi / 4
    buf[i:i + n, 0] += x[:n] * gain * np.cos(a)
    buf[i:i + n, 1] += x[:n] * gain * np.sin(a)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band', output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='low', output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='high', output='sos')
    return signal.sosfilt(sos, x)


def fade(x, a=0.002, r=0.01):
    n = len(x)
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / max(a, 1e-6))
    env *= np.minimum(1.0, (n / SR - t) / max(r, 1e-6))
    return x * env


# --------------------------------------------------------------------------
# инструменты
# --------------------------------------------------------------------------

def pizz(freq, dur=0.32, amp=1.0):
    """Короткое пиццикато: щипок + быстро гаснущие обертоны."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.16), (2.01, 0.42, 0.09), (3.02, 0.18, 0.05), (4.97, 0.08, 0.03)]:
        y += a * np.sin(2 * np.pi * freq * ratio * (1 + rng.normal(0, 0.0004)) * t) * np.exp(-t / tau)
    click = bp(rng.standard_normal(int(0.006 * SR)), 2000, 9000) * np.exp(-np.arange(int(0.006 * SR)) / (0.0012 * SR))
    y[:len(click)] += 0.12 * click
    y *= np.minimum(1.0, t / 0.0015)
    return y * amp / 1.6


def rhodes(freq, dur=2.4, amp=1.0, idx=1.1):
    """Тёплое электропиано для ночного бита."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = idx * np.exp(-t / 0.4) * np.sin(2 * np.pi * freq * 2 * t)
    y = np.sin(2 * np.pi * freq * t + mod)
    y *= np.exp(-t / 1.5) * np.minimum(1.0, t / 0.014)
    y += 0.12 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t / 0.5)
    y *= np.minimum(1.0, (dur - t) / 0.2)
    return y * amp


def wood(freq=760.0, amp=1.0):
    """Деревянный блок — держит комедийный ритм."""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.018)
    y += 0.5 * np.sin(2 * np.pi * freq * 2.7 * t) * np.exp(-t / 0.008)
    y += 0.35 * bp(rng.standard_normal(n), 1800, 6000) * np.exp(-t / 0.004)
    y *= np.minimum(1.0, t / 0.0008)
    return y * amp


def kick(amp=1.0, f0=62.0):
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    f = 38 + f0 * np.exp(-t * 24)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    y += 0.25 * bp(rng.standard_normal(n), 900, 5000) * np.exp(-t / 0.008)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def clap(amp=1.0):
    n = int(0.24 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for d in (0.0, 0.009, 0.019):
        i = int(d * SR)
        burst = bp(rng.standard_normal(n - i), 900, 5200) * np.exp(-np.arange(n - i) / (0.03 * SR))
        y[i:] += burst
    y *= np.minimum(1.0, t / 0.001)
    return y * amp / 2.0


def shaker(amp=1.0):
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 4200, 11000) * np.exp(-t / 0.018)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def rim(amp=1.0):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 1400, 3800) * np.exp(-t / 0.012)
    y += 0.4 * np.sin(2 * np.pi * 620 * t) * np.exp(-t / 0.02)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def hat(amp=1.0, open_=False):
    n = int((0.16 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 6500, 14000) * np.exp(-t / (0.05 if open_ else 0.012))
    y *= np.minimum(1.0, t / 0.0008)
    return y * amp


def bass(freq, dur=0.34, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    y = np.tanh(y * 1.4) * np.exp(-t / 0.18)
    y *= np.minimum(1.0, t / 0.004)
    return y * amp


def boom(amp=1.0, f0=95.0, dur=1.35):
    """Vine boom: низкий удар с падением тона и шумовым хлопком."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 32 + f0 * np.exp(-t * 4.2)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    thump = lp(rng.standard_normal(n), 260) * np.exp(-t / 0.09)
    y = np.tanh((body * 1.25 + thump * 1.1) * 1.6)
    y *= np.minimum(1.0, t / 0.002)
    return y * amp


def riser(dur=1.0, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = rng.standard_normal(n)
    y = bp(noise, 300, 9000) * (p ** 2) * 0.7
    y += np.sin(2 * np.pi * np.cumsum(120 + 700 * p ** 2) / SR) * (p ** 2.4) * 0.3
    return fade(y, 0.02, 0.09) * amp


def whoosh(dur=0.5, amp=1.0, up=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = (t / dur) if up else (1 - t / dur)
    p = p * p * (3 - 2 * p)
    noise = rng.standard_normal(n)
    y = bp(noise, 200, 1200) * (1 - p) ** 2
    y += bp(noise, 1200, 5000) * np.sin(np.pi * p) ** 2
    y += bp(noise, 5000, 12000) * (p ** 2)
    return fade(y, 0.02, 0.08) * amp


def scratch(dur=0.45, amp=1.0):
    """Скрэтч пластинки: рваный шум с быстрым тремоло."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    wob = 0.35 + 0.65 * np.abs(np.sin(2 * np.pi * (8 + 34 * t / dur) * t))
    y = bp(noise, 700, 7000) * wob
    y *= np.exp(-t / 0.34)
    y = np.tanh(y * 2.2)
    return fade(y, 0.004, 0.05) * amp


def error(amp=1.0):
    """Системный «не получилось»: два коротких квадратных сигнала."""
    out = []
    for f in (660.0, 440.0):
        n = int(0.11 * SR)
        t = np.arange(n) / SR
        y = signal.square(2 * np.pi * f * t) * 0.5
        y = lp(y, 2400) * np.minimum(1.0, t / 0.004) * np.minimum(1.0, (0.11 - t) / 0.02)
        out.append(y)
    return np.concatenate(out) * amp


def trombone(amp=1.0):
    """Грустный тромбон: четыре ноты вниз, последняя со «вздохом»."""
    notes = [(220.0, 0.28), (207.65, 0.28), (196.0, 0.28), (185.0, 0.78)]
    total = int(sum(d for _, d in notes) * SR)
    y = np.zeros(total)
    i = 0
    for k, (f, d) in enumerate(notes):
        n = int(d * SR)
        t = np.arange(n) / SR
        slide = 1.0 if k < 3 else 1 - 0.06 * (t / d)
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t)
        saw = 2 * ((f * vib * slide * t) % 1) - 1
        tone = lp(saw, 1250) * 0.6 + np.sin(2 * np.pi * f * vib * slide * t) * 0.5
        env = np.minimum(1.0, t / 0.03) * np.exp(-t / (0.16 if k < 3 else 0.5))
        env *= np.minimum(1.0, (d - t) / 0.05)
        y[i:i + n] += tone * env
        i += n
    return y * amp


def ding(freq=1320.0, dur=0.9, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.3), (2.76, 0.3, 0.16), (5.4, 0.12, 0.08)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    y *= np.minimum(1.0, t / 0.002)
    return y * amp / 1.5


def alarm_beep(amp=1.0, f1=880.0, f2=660.0):
    """Две квадратные ноты будильника."""
    out = []
    for f in (f1, f2):
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        y = signal.square(2 * np.pi * f * t) * 0.32
        y = lp(y, 2600)
        y *= np.minimum(1.0, t / 0.003) * np.minimum(1.0, (0.12 - t) / 0.02)
        out.append(y)
    return np.concatenate(out) * amp


def siren(dur=0.9, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    f = 520 + 260 * np.sin(np.pi * p * 3)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35
    y *= np.minimum(1.0, t / 0.02) * np.minimum(1.0, (dur - t) / 0.1)
    return y * amp


def pop(f0=420.0, f1=900.0, dur=0.1, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    return fade(y, 0.001, 0.01) * amp


def boing(amp=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 280 + 420 * np.sin(np.pi * np.clip(t / 0.18, 0, 1)) + 90 * np.sin(2 * np.pi * 7 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    return fade(y, 0.003, 0.04) * amp


def type_tick(amp=1.0):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 1200, 5500) * np.exp(-t / 0.006)
    y += 0.4 * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.012)
    return fade(y, 0.0006, 0.008) * amp


def fan(dur=2.1, amp=1.0):
    """Ноутбук взлетает: шум вентилятора и низкий гул."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    noise = rng.standard_normal(n)
    y = bp(noise, 700, 7000) * (0.12 + 0.55 * p ** 1.6)
    y += np.sin(2 * np.pi * (96 + 22 * p) * t) * 0.16 * p
    y += np.sin(2 * np.pi * (192 + 40 * p) * t) * 0.06 * p
    y *= 0.9 + 0.1 * np.sin(2 * np.pi * 13 * t)
    return fade(y, 0.3, 0.15) * amp


def sparkle(freqs, amp=1.0, step=0.05):
    out = np.zeros(int(1.2 * SR))
    for k, f in enumerate(freqs):
        d = ding(f, 0.9, 0.5)
        i = int(k * step * SR)
        m = min(len(d), len(out) - i)
        out[i:i + m] += d[:m]
    return out * amp


def chord(freqs, dur=2.6, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        y += np.sin(2 * np.pi * f * t)
        y += 0.3 * np.sin(2 * np.pi * f * 2 * t)
        y += 0.12 * np.sin(2 * np.pi * f * 3 * t)
    y *= np.minimum(1.0, t / 0.02) * np.exp(-t / 1.1)
    return y * amp / len(freqs)


# --------------------------------------------------------------------------
# фоли: таймлайн ролика
# --------------------------------------------------------------------------

place(mix, boom(0.5, 90.0), 0.2, 1.0, 0.0)
place(mix, pop(320, 640, 0.12, 0.4), 0.7, 1.0, -0.2)
place(mix, whoosh(0.35, 0.55), 1.68, 1.0, 0.0)
place(mix, pop(520, 980, 0.09, 0.5), 1.98, 1.0, 0.14)
place(mix, whoosh(0.35, 0.5), 3.68, 1.0, 0.0)
place(mix, pop(560, 1020, 0.09, 0.45), 3.96, 1.0, -0.12)
place(mix, whoosh(0.35, 0.5), 5.68, 1.0, 0.0)
place(mix, pop(600, 1080, 0.09, 0.45), 5.96, 1.0, 0.1)

place(mix, pop(420, 820, 0.1, 0.5), 6.06, 1.0, 0.16)
place(mix, whoosh(0.4, 0.6), 6.88, 1.0, 0.0)

place(mix, pop(480, 900, 0.1, 0.5), 8.06, 1.0, -0.1)
for k in range(3):
    place(mix, type_tick(0.24), 8.45 + k * 0.18, 1.0, 0.12)
place(mix, ding(1318.5, 0.8, 0.3), 9.18, 1.0, 0.14)

place(mix, pop(500, 950, 0.1, 0.5), 10.06, 1.0, 0.1)
place(mix, pop(700, 300, 0.1, 0.5), 10.7, 1.0, 0.18)
place(mix, whoosh(0.35, 0.45, False), 11.44, 1.0, 0.0)

place(mix, scratch(0.5, 0.72), 12.0, 1.0, 0.12)
place(mix, boom(0.34, 140.0), 12.02, 1.0, 0.0)
place(mix, ding(1046.5, 0.6, 0.18), 12.35, 1.0, 0.16)

place(mix, trombone(0.34), 14.08, 1.0, -0.1)
place(mix, wood(380.0, 0.55), 14.3, 1.0, 0.1)
place(mix, ding(880.0, 0.5, 0.14), 15.1, 1.0, 0.0)

place(mix, boom(0.65, 110.0), 16.02, 0.9, 0.0)
for k in range(5):
    place(mix, alarm_beep(0.3), 16.06 + k * 0.4, 1.0, 0.16 * (-1) ** k)
place(mix, siren(0.95, 0.24), 16.2, 1.0, -0.1)
place(mix, whoosh(0.45, 0.55, False), 17.92, 1.0, 0.0)
place(mix, chord([174.61, 220.0, 261.63, 329.63], 2.2, 0.4), 18.02, 1.0, 0.0)
place(mix, ding(1760.0, 1.2, 0.22), 18.34, 1.0, 0.0)
place(mix, pop(900, 1500, 0.07, 0.35), 18.9, 1.0, 0.1)


# --------------------------------------------------------------------------
# музыка: 120 BPM, 10 тактов, ночной лоу-фай Am9 – Fmaj7 – Cmaj7 – G6
# --------------------------------------------------------------------------

CHORDS = [
    (110.00, [220.00, 261.63, 329.63, 246.94]),   # Am9
    (87.31, [174.61, 220.00, 261.63, 329.63]),    # Fmaj7
    (130.81, [196.00, 261.63, 329.63, 392.00]),   # Cmaj7
    (98.00, [196.00, 246.94, 293.66, 392.00]),    # G6
]

HOOK = [440.00, 523.25, 659.25, 783.99, 659.25, 523.25, 440.00, 392.00]


def bar(t0, i, level=1.0, half=False, intense=False):
    root, notes = CHORDS[i % 4]
    for j, f in enumerate(notes):
        place(music, rhodes(f, 2.2, 0.032 * level), t0 + 0.004 * j, 1.0, -0.3 + 0.2 * j)
        if not half:
            place(music, rhodes(f, 1.3, 0.012 * level), t0 + 1.0 + 0.004 * j, 1.0, -0.3 + 0.2 * j)
    place(music, bass(root / 2, 0.5, 0.22 * level), t0, 1.0, 0.0)
    place(music, bass(root / 2, 0.36, 0.12 * level), t0 + 1.0, 1.0, 0.0)
    if not half:
        place(music, kick(0.32 * level), t0, 1.0, 0.0)
        place(music, kick(0.26 * level), t0 + 1.0, 1.0, 0.0)
        place(music, rim(0.11 * level), t0 + 0.5, 1.0, 0.2)
        place(music, rim(0.1 * level), t0 + 1.5, 1.0, -0.2)
    else:
        place(music, kick(0.32 * level), t0, 1.0, 0.0)
        place(music, rim(0.12 * level), t0 + 1.0, 1.0, 0.2)
    for j in range(8 if half else 16):
        step = BAR / (8 if half else 16)
        place(music, shaker(0.017 * level if j % 2 == 0 else 0.011 * level), t0 + j * step, 1.0, 0.26)
    # тиканье часов на каждую долю
    for b in range(4):
        place(music, wood(1180 if b % 2 == 0 else 980, 0.035 * level), t0 + b * BEAT, 1.0, -0.32)
    # мелодия
    if i >= 2 and not half:
        for j in range(8):
            f = HOOK[(j + i) % len(HOOK)]
            place(music, pizz(f, 0.26, 0.045 * level), t0 + j * BEAT / 2, 1.0, 0.16 * (-1) ** j)
    if intense:
        for b in range(4):
            place(music, kick(0.28 * level), t0 + b * BEAT, 1.0, 0.0)
        for b in (1, 3):
            place(music, clap(0.22 * level), t0 + b * BEAT, 1.0, 0.06)
        for j in range(16):
            place(music, hat(0.032 * level, j % 8 == 6), t0 + j * BEAT / 4, 1.0, -0.22)


# такты 1–2: ночь, тихо
bar(0.0, 0, 0.8)
bar(2.0, 1, 0.85)

# такты 3–4: ещё одно
bar(4.0, 2, 0.95)
bar(6.0, 3, 0.98)

# такты 5–6: реклама, GIF, таймер сна
bar(8.0, 4, 0.98)
bar(10.0, 5, 0.95)

# такт 7: 03:01, «ЕЩЁ ОДНО»
bar(12.0, 6, 0.85, intense=True)

# такт 8: 03:59, статистика — полутайм и тромбон
bar(14.0, 7, 0.92, half=True)

# такт 9: 04:00, будильник
bar(16.0, 8, 0.98, intense=True)

# такт 10: «спи» — финальный аккорд без ритма
place(music, chord([174.61, 220.0, 261.63, 329.63], 2.4, 0.5), 18.0, 1.0, 0.0)
place(music, bass(87.31, 1.0, 0.16), 18.0, 1.0, 0.0)

# финальный фейд
i0, i1 = int(19.3 * SR), N
music[i0:i1] *= np.linspace(1, 0, i1 - i0)[:, None] ** 2

music *= 1.9
music = np.stack([hp(music[:, 0], 42), hp(music[:, 1], 42)], axis=1)

# дакинг музыки под фоли
env_sfx = maximum_filter1d(np.max(np.abs(mix), axis=1), size=int(0.12 * SR))
env_sfx = gaussian_filter1d(env_sfx, sigma=0.05 * SR)
duck = 1.0 - 0.5 * np.clip(env_sfx / (np.max(env_sfx) + 1e-9) * 2.4, 0, 1)
music *= duck[:, None]
print('music rms', round(float(20 * np.log10(np.sqrt(np.mean(music ** 2)) + 1e-12)), 1),
      'sfx rms', round(float(20 * np.log10(np.sqrt(np.mean(mix ** 2)) + 1e-12)), 1))
mix += music


# --------------------------------------------------------------------------
# воздух и реверберация
# --------------------------------------------------------------------------

room = hp(lp(rng.standard_normal(N), 2600), 120) * 0.0035
mod = 0.7 + 0.3 * np.sin(2 * np.pi * np.arange(N) / SR * 0.11 + 0.8)
room *= mod
mix[:, 0] += room * 0.9
mix[:, 1] += np.roll(room, 271) * 0.9


def make_ir(seconds=1.15):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.22)[:, None]
    ir = np.stack([lp(ir[:, 0], 5600), lp(ir[:, 1], 5600)], axis=1)
    for d, g in [(0.008, 0.5), (0.016, 0.34), (0.029, 0.22), (0.043, 0.13)]:
        i = int(d * SR)
        ir[i, 0] += g
        ir[i, 1] += g * 0.9
    ir *= np.linspace(1.0, 0.0, n)[:, None] ** 0.3
    ir /= np.max(np.abs(ir))
    return ir


ir = make_ir()
wet = np.stack([
    signal.fftconvolve(mix[:, 0], ir[:, 0])[:N],
    signal.fftconvolve(mix[:, 1], ir[:, 1])[:N],
], axis=1)
wet /= max(np.max(np.abs(wet)), 1e-9)
bus = mix + wet * (np.max(np.abs(mix)) * 0.18)
bus *= 1.12


# --------------------------------------------------------------------------
# мастеринг
# --------------------------------------------------------------------------

bus = np.stack([hp(bus[:, 0], 30), hp(bus[:, 1], 30)], axis=1)
bus += 0.26 * np.stack([hp(bus[:, 0], 3600), hp(bus[:, 1], 3600)], axis=1)

thr = 0.12
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.04 * SR))
env = gaussian_filter1d(env, sigma=0.016 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 4.0) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.6) / np.tanh(1.6)

# фейды
fade_in = int(0.012 * SR)
fade_out = int(0.34 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5

# целевая громкость: около −14 LUFS, пик −1.2 dBFS
rms = np.sqrt(np.mean(bus ** 2))
peak = np.max(np.abs(bus))
target_rms = 0.19
bus *= target_rms / max(rms, 1e-9)
peak = np.max(np.abs(bus))
if peak > 0.87:
    bus *= 0.87 / peak
bus[-48:] *= np.linspace(1, 0, 48)[:, None]

print(f'peak {20 * np.log10(np.max(np.abs(bus))):.1f} dBFS · rms {20 * np.log10(np.sqrt(np.mean(bus ** 2))):.1f} dBFS')

out = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print('wrote', out)
