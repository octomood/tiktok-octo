#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к ролику «dot matrix» — 10 секунд, 120 BPM, 5 тактов.

Точки включаются и печатают логотип, глитч, сборка, выключение панели и
финал с QR. Ни одного сэмпла: тики, колокольчики, пэд, райзер, импакт.

    python3 docs/promo/matrix-audio.py docs/promo/build-matrix/audio.wav
"""

import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 10.0
N = int(SR * DUR)
rng = np.random.default_rng(20261121)

BEAT = 0.5  # 120 BPM
BAR = BEAT * 4


LOCK = 2.05    # логотип собрался
GLITCH0 = 3.14
GLITCH1 = 3.4
OUT0 = 4.4     # панель гаснет
CTA = 5.9      # финал с QR

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

def tick(freq=3200.0, amp=1.0):
    """Тик светодиодной панели: щелчок + короткий тон."""
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.008)
    y += 0.7 * bp(rng.standard_normal(n), 2600, 9000) * np.exp(-t / 0.0022)
    return y * amp / 1.7


def bell(freq, dur=1.2, amp=1.0):
    """Колокольчик для аккордов сборки и финала."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.55), (2.01, 0.36, 0.3), (3.99, 0.16, 0.16), (6.03, 0.07, 0.09)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    y *= np.minimum(1.0, t / 0.004)
    return y * amp / 1.8


def pluck(freq, dur=0.34, amp=1.0):
    """Короткий щипок для арпеджио."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.2), (2.0, 0.4, 0.1), (3.01, 0.15, 0.05)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    return fade(y * np.minimum(1.0, t / 0.002), 0.002, 0.06) * amp / 1.6


def pad(freqs, dur, amp=1.0, attack=0.35):
    """Тёплый пэд: расстроенные пилы через мягкий фильтр."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.0018, 0.0, 0.0021):
            ph = rng.uniform(0, 2 * np.pi)
            y += signal.sawtooth(2 * np.pi * f * (1 + det) * t + ph) * 0.32
    y = lp(y, 1400, order=2)
    env = np.minimum(1.0, t / attack) * np.minimum(1.0, (dur - t) / 0.5)
    return y * env * amp / len(freqs)


def kick(amp=1.0, f0=62.0):
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    f = 38 + f0 * np.exp(-t * 24)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    y += 0.25 * bp(rng.standard_normal(n), 900, 5000) * np.exp(-t / 0.008)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def snare(amp=1.0):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 1400, 8500) * np.exp(-t / 0.05)
    y += 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    return y * amp / 1.5


def riser(dur, amp=1.0):
    """Шум, у которого открывается и ползёт вверх полоса."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 12
    for k in range(steps):
        a, b = int(n * k / steps), int(n * (k + 1) / steps)
        if b <= a:
            continue
        lo = 300 * (1 + 0.22 * k)
        hi = 1200 * (1 + 0.34 * k)
        out[a:b] = bp(y[a:b], lo, min(hi, 16000))
    env = (t / dur) ** 1.7
    return out * env * amp / 2.0


def powerdown(dur, amp=1.0):
    """Панель гаснет: сползающий тон и закрывающийся фильтр."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 640 * np.exp(-t * 1.35) + 46
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y += 0.35 * np.sin(2 * np.pi * np.cumsum(f * 0.5) / SR)
    noise = lp(rng.standard_normal(n), 3000)
    env = np.exp(-t / 0.55) * np.minimum(1.0, (dur - t) / 0.08)
    return (y * 0.8 + noise * 0.35) * env * amp


def impact(amp=1.0):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    f = 30 + 70 * np.exp(-t * 9)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.32)
    y += 0.4 * lp(rng.standard_normal(n), 2400) * np.exp(-t / 0.09)
    y += 0.3 * bp(rng.standard_normal(n), 3000, 11000) * np.exp(-t / 0.03)
    return y * amp


# --------------------------------------------------------------------------
# партитура
# --------------------------------------------------------------------------

# включение панели
place(mix, lp(rng.standard_normal(int(0.25 * SR)), 4500) * np.exp(-np.arange(int(0.25 * SR)) / (0.05 * SR)), 0.02, 0.25)
for k in range(7):
    place(mix, tick(2400 + 260 * k, 0.5), 0.03 + k * 0.032 + rng.uniform(0, 0.01), 0.16, rng.uniform(-0.4, 0.4))

# печать логотипа: тики идут вместе с фронтом развёртки 0.36…2.05
for k in range(46):
    u = k / 45
    tt = 0.36 + (2.05 - 0.36) * u + rng.uniform(-0.004, 0.004)
    place(mix, tick(2500 + 1900 * u, 0.8), tt, 0.1 + 0.05 * u, np.cos(u * np.pi) * 0.55)

# замок логотипа
for i, f in enumerate([880.0, 1318.5, 1760.0]):
    place(mix, bell(f, 1.1, 0.55), LOCK, 0.22, -0.35 + i * 0.35)

# глитч
for k in range(5):
    seg = rng.standard_normal(int(0.028 * SR))
    seg = np.repeat(seg[::8], 8)[: len(seg)]
    place(mix, bp(seg, 250, 7000) * np.exp(-np.arange(len(seg)) / (0.01 * SR)), GLITCH0 + k * 0.045, 0.3, rng.uniform(-0.6, 0.6))
place(mix, powerdown(0.16, 0.4), GLITCH0 + 0.01, 0.5)

# подложка между сборкой логотипа и выключением
place(music, pad([220.0, 261.63, 329.63], 2.4, 0.45, attack=0.5), LOCK + 0.05, 0.4)
place(music, pad([110.0, 130.81], 2.4, 0.4, attack=0.6), LOCK + 0.05, 0.3)

# сборка перед выключением: снейр-ролл и райзер
for k in range(12):
    u = k / 11
    place(mix, snare(0.5 + 0.5 * u), 3.42 + u * 0.9, 0.14 + 0.18 * u, 0.1 * np.sin(k))
place(mix, riser(1.0, 0.55), 3.4, 0.85)

# панель гаснет
place(mix, powerdown(1.35, 0.7), OUT0 + 0.02, 0.55)
for k in range(16):
    u = k / 15
    place(mix, tick(3000 - 1400 * u, 0.7), OUT0 + 0.05 + u * 0.95, 0.1 * (1 - u), 0.4 - 0.8 * u)

# финал: импакт и тёплый аккорд
place(mix, impact(0.9), CTA, 0.55)
music_chord = [220.0, 261.63, 329.63, 392.0]  # Am(add9)
place(music, pad(music_chord, 3.4, 0.5, attack=0.22), CTA + 0.02, 0.8)
place(music, pad([110.0, 130.81], 3.4, 0.4, attack=0.3), CTA + 0.02, 0.6)

# музыка: бочка и арпеджио
for k in range(8):  # 0.5…4.0
    place(music, kick(0.9), 0.5 + k * 0.5, 0.5)
for k in range(4):  # финальная часть, мягче
    place(music, kick(0.6, f0=54.0), CTA + 0.05 + k * 0.5, 0.5)

for k in range(24):
    tt = 0.5 + k * BEAT * 0.5  # восьмые
    if tt > 9.2:
        break
    f = [220.0, 261.63, 329.63, 440.0, 392.0, 329.63][k % 6]
    g = 0.16 if tt < OUT0 else 0.11
    place(music, pluck(f * 2, 0.3, 0.8), tt, g, 0.35 * np.sin(k * 1.7))

# финальный аккорд
for i, f in enumerate([523.25, 659.25, 784.0]):
    place(mix, bell(f, 1.4, 0.6), 9.15 + i * 0.05, 0.16, -0.3 + i * 0.3)

# --------------------------------------------------------------------------
# реверб, мастеринг
# --------------------------------------------------------------------------

def make_ir(seconds=1.0):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.2)[:, None]
    ir = np.stack([lp(ir[:, 0], 5200), lp(ir[:, 1], 5200)], axis=1)
    for d, g in [(0.007, 0.5), (0.014, 0.34), (0.026, 0.22)]:
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
bus = mix + wet * (np.max(np.abs(mix)) * 0.22)
bus += music

bus = np.stack([hp(bus[:, 0], 32), hp(bus[:, 1], 32)], axis=1)
bus += 0.22 * np.stack([hp(bus[:, 0], 3800), hp(bus[:, 1], 3800)], axis=1)

thr = 0.12
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.04 * SR))
env = gaussian_filter1d(env, sigma=0.016 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 4.0) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.5) / np.tanh(1.5)

fade_in = int(0.01 * SR)
fade_out = int(0.3 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5

rms = np.sqrt(np.mean(bus ** 2))
bus *= 0.205 / max(rms, 1e-9)
peak = np.max(np.abs(bus))
if peak > 0.87:
    bus *= 0.87 / peak
bus[-32:] *= np.linspace(1, 0, 32)[:, None]

print(f'peak {20 * np.log10(np.max(np.abs(bus))):.1f} dBFS · rms {20 * np.log10(np.sqrt(np.mean(bus ** 2))):.1f} dBFS')

out = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print('wrote', out)
