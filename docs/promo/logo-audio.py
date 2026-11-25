#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к квадратному логотипу «dot matrix» — 6 секунд, 1080×1080.

Панель включается: реле, низкий гул, щелчки точек вместе с развёрткой.
В 2.05 логотип собирается — тёплый аккорд и стеклянный пинг. В 3.14 короткий
цифровой сбой, дальше волна выключения и тишина. Ни одного сэмпла.

    python3 docs/promo/logo-audio.py docs/promo/build-logo/audio.wav
"""

import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 6.0
N = int(SR * DUR)
rng = np.random.default_rng(20261121)

LOCK = 2.05    # логотип собрался
GLITCH = 3.14  # сбой строк
OUT = 4.42     # волна выключения

mix = np.zeros((N, 2), dtype=np.float64)


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
    if x.ndim == 2:
        buf[i:i + n] += x[:n] * gain
        return
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


def env_exp(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1.0, t / max(attack, 1e-5)) * np.exp(-t / decay)


# --------------------------------------------------------------------------
# инструменты
# --------------------------------------------------------------------------

def relay(amp=1.0):
    """Щелчок реле при включении панели."""
    n = int(0.06 * SR)
    x = bp(rng.standard_normal(n), 1400, 7200) * env_exp(n, 0.0008, 0.012)
    t = np.arange(n) / SR
    x += 0.5 * np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.008)
    return x * amp


def thud(amp=1.0, f0=78.0, dur=0.7):
    """Низкий толчок питания."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (0.6 + 0.4 * np.exp(-t / 0.09))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    x += 0.16 * rng.standard_normal(n) * np.exp(-t / 0.03)
    return lp(x, 220) * amp


def tick(freq=560.0, amp=1.0):
    """Щелчок матричной точки: шумовой срез и короткий тон."""
    n = int(0.045 * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1800, 9000) * np.exp(-t / 0.005)
    x += 0.7 * np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.016)
    return x * amp


def blip(freq=880.0, dur=0.05, amp=1.0, bits=4):
    """Цифровой писк, намеренно грязный — для глитча."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * freq * t)) * 0.6
    x += 0.4 * np.sin(2 * np.pi * freq * 2 * t)
    x = np.round(x * (2 ** bits - 1)) / (2 ** bits - 1)
    x *= env_exp(n, 0.001, 0.02)
    return lp(hp(x, 180), 5200) * amp


def voice(freq, dur, amp=1.0, attack=0.012, decay=0.55, detune=0.0):
    """Мягкий стеклянный голос: синус с обертонами и биениями."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    x = (
        np.sin(2 * np.pi * f * t)
        + 0.32 * np.sin(2 * np.pi * f * 2 * t)
        + 0.1 * np.sin(2 * np.pi * f * 3 * t)
    )
    return x * env_exp(n, attack, decay) * amp


def chord(freqs, dur=1.9, amp=0.15):
    """Аккорд сборки — тёплый, без резкого удара."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for i, f in enumerate(freqs):
        a = amp / (1 + 0.25 * i)
        out[:, 0] += voice(f, dur, a, attack=0.016, decay=0.62, detune=-0.0012)
        out[:, 1] += voice(f, dur, a, attack=0.018, decay=0.6, detune=0.0012)
    return out


def riser(dur=0.35, amp=1.0):
    """Короткий подъём перед сборкой."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f = 180 * (1 + 7 * u ** 2)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    x += bp(rng.standard_normal(n), 600, 5000) * 0.35
    x *= np.linspace(0, 1, n) ** 1.6
    return fade(x, 0.01, 0.05) * amp


def air(dur=2.2, amp=1.0):
    """Тихий «воздух» панели: фильтрованный шум под гул."""
    n = int(dur * SR)
    x = bp(rng.standard_normal(n), 2400, 7800)
    x *= np.minimum(1.0, np.arange(n) / (0.4 * SR)) * np.minimum(
        1.0, (n - np.arange(n)) / (0.5 * SR)
    )
    return x * amp


def make_ir(seconds=0.95):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.2)[:, None]
    ir = np.stack([lp(ir[:, 0], 5200), lp(ir[:, 1], 5200)], axis=1)
    for d, g in [(0.007, 0.55), (0.015, 0.36), (0.026, 0.24), (0.041, 0.14)]:
        i = int(d * SR)
        ir[i, 0] += g
        ir[i, 1] += g * 0.9
    ir *= np.linspace(1.0, 0.0, n)[:, None] ** 0.3
    ir /= np.max(np.abs(ir))
    return ir


# --------------------------------------------------------------------------
# сцена
# --------------------------------------------------------------------------

# питание
place(mix, relay(), 0.02, 0.28, -0.15)
place(mix, thud(0.9, 74), 0.03, 0.38)

# гул панели и «воздух»
n_hum = int(2.5 * SR)
t_hum = np.arange(n_hum) / SR
hum = np.zeros((n_hum, 2))
for f, a in [(50, 1.0), (100, 0.34), (150, 0.16)]:
    ph = rng.uniform(0, 2 * np.pi)
    vib = 1 + 0.002 * np.sin(2 * np.pi * 0.7 * t_hum + ph)
    hum[:, 0] += a * np.sin(2 * np.pi * f * t_hum * vib + ph)
    hum[:, 1] += a * np.sin(2 * np.pi * f * t_hum * vib * 1.0008 + ph)
hum *= (np.minimum(1.0, t_hum / 0.5) * np.minimum(1.0, (2.5 - t_hum) / 1.1))[:, None]
mix[:len(hum)] += 0.05 * hum
place(mix, air(2.2, 0.05), 0.1)
place(mix, air(1.5, 0.03), 3.1)

# щелчки точек: развёртка идёт справа налево по кадру
for i in range(20):
    t0 = 0.42 + i * 0.079
    pan = 0.55 - i * (1.1 / 19)
    place(mix, tick(360 + i * 27, 0.55 + 0.25 * rng.random()), t0, 0.09, pan)

# подъём и сборка
place(mix, riser(0.34, 0.3), LOCK - 0.35, 0.5, 0.0)
place(mix, chord([523.25, 659.25, 783.99, 1046.5]), LOCK)
place(mix, voice(130.81, 1.2, 0.22, attack=0.01, decay=0.5), LOCK, 0.5, 0.0)
place(mix, voice(2093, 0.8, 0.06, attack=0.004, decay=0.18), LOCK, 0.25, 0.2)
place(mix, thud(0.5, 58, 0.5), LOCK, 0.35)

# цифровой сбой
for i, f in enumerate([920, 640, 1180, 470]):
    place(mix, blip(f, 0.05, 0.2), GLITCH + i * 0.058, 0.35, -0.4 + 0.25 * i)

# волна выключения: обратный ряд щелчков
for i in range(15):
    t0 = OUT + 0.12 + i * 0.074
    pan = -0.5 + i * (1.0 / 14)
    place(mix, tick(700 - i * 30, 0.5), t0, 0.13 * (1 - i / 22), pan)

place(mix, thud(0.4, 52, 0.6), 5.48, 0.24)

# --------------------------------------------------------------------------
# реверб и мастеринг
# --------------------------------------------------------------------------

ir = make_ir()
wet = np.stack([
    signal.fftconvolve(mix[:, 0], ir[:, 0])[:N],
    signal.fftconvolve(mix[:, 1], ir[:, 1])[:N],
], axis=1)
wet /= max(np.max(np.abs(wet)), 1e-9)
bus = mix + wet * (np.max(np.abs(mix)) * 0.16)

bus = np.stack([hp(bus[:, 0], 32), hp(bus[:, 1], 32)], axis=1)

thr = 0.1
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.04 * SR))
env = gaussian_filter1d(env, sigma=0.016 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 4.0) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.5) / np.tanh(1.5)

fade_in = int(0.01 * SR)
fade_out = int(0.3 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5

# целевая громкость: около −14 LUFS, пик −1.2 dBFS
rms = np.sqrt(np.mean(bus ** 2))
bus *= 0.19 / max(rms, 1e-9)
peak = np.max(np.abs(bus))
if peak > 0.87:
    bus *= 0.87 / peak
bus[-48:] *= np.linspace(1, 0, 48)[:, None]

print(
    f'peak {20 * np.log10(np.max(np.abs(bus))):.1f} dBFS · '
    f'rms {20 * np.log10(np.sqrt(np.mean(bus ** 2))):.1f} dBFS'
)

out = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print('wrote', out)
