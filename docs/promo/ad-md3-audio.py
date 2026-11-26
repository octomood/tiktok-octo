#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к 10-секундному рекламному ролику TikTok octo (Material Design 3).
Синтез 48 кГц стерео, нормализация около -14 LUFS, пик <= -1 dBFS.
"""

import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 10.0
N = int(SR * DUR)
rng = np.random.default_rng(20261125)

BEAT = 60.0 / 112.5  # 0.5333 с
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
    a = (pan + 1) * np.pi / 4
    buf[i:i + n, 0] += x[:n] * gain * np.cos(a)
    buf[i:i + n, 1] += x[:n] * gain * np.sin(a)


def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='low', output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype='high', output='sos')
    return signal.sosfilt(sos, x)


def env_exp(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1.0, t / max(attack, 1e-5)) * np.exp(-t / decay)


def boom(dur, f0, f1, decay):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(np.sin(ph) * 1.4) * env_exp(n, 0.004, decay)


def kick():
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 46.0 + 115.0 * np.exp(-t / 0.024)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = lp(rng.normal(0, 0.25, n), 2400) * np.exp(-t / 0.006)
    return (np.sin(ph) * env_exp(n, 0.002, 0.11) + click) * 0.9


def clap():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    nz = hp(lp(rng.normal(0, 1, n), 5500), 900)
    return nz * env_exp(n, 0.002, 0.045) * 0.6


def hat(open_hat=False):
    n = int((0.14 if open_hat else 0.05) * SR)
    t = np.arange(n) / SR
    nz = hp(rng.normal(0, 1, n), 6500)
    return nz * env_exp(n, 0.001, 0.045 if open_hat else 0.014) * 0.35


def stab(freqs, dur, decay=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.0, 0.004):
            sig += np.sin(2 * np.pi * f * (1 + det) * t)
            sig += 0.35 * np.sin(4 * np.pi * f * (1 + det) * t)
    sig /= len(freqs) * 3
    return lp(sig, 3800) * env_exp(n, 0.012, decay)


def bass(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(4 * np.pi * freq * t)
    return lp(np.tanh(sig * 1.3), 260) * env_exp(n, 0.008, dur * 0.55)


def bell(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2.0 * t)
    return sig * env_exp(n, 0.003, dur * 0.28)


def whoosh(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = lp(hp(rng.normal(0, 1, n), 300), 3600)
    env = np.sin(np.pi * t / dur) ** 1.6
    return nz * env * 0.28


# 0.0s: мягкий старт бренда
place(mix, boom(0.8, 110, 44, 0.35), 0.1, 0.55)
place(mix, bell(880.0, 0.9), 0.12, 0.18, -0.2)
place(mix, bell(1318.5, 0.9), 0.22, 0.16, 0.2)

# 1.8s, 3.3s, 4.8s: смена карточек фич
for tc in (1.8, 3.3, 4.8):
    place(mix, whoosh(0.28), tc - 0.12, 0.7)
    place(mix, bell(1174.66, 0.7), tc, 0.16, 0.15)

# Основной грув (1.8 .. 6.1) и финал (6.4 .. 9.6)
chords = [
    (1.8, [220.0, 261.63, 329.63, 392.0]),
    (3.3, [174.61, 220.0, 261.63, 349.23]),
    (4.8, [261.63, 329.63, 392.0, 523.25]),
    (6.4, [261.63, 329.63, 392.0, 523.25, 659.25]),
]
for t0, freqs in chords:
    d = 2.8 if t0 >= 6.4 else 1.45
    place(mix, stab(freqs, d, 0.65 if t0 >= 6.4 else 0.42), t0, 0.72)
    place(mix, bass(freqs[0] / 2, d), t0, 0.6)

t = 1.8
step = 0
while t < 9.55:
    if not (6.05 <= t < 6.4):
        place(mix, kick(), t, 0.52)
        if step % 2 == 1:
            place(mix, clap(), t, 0.32, 0.05)
        place(mix, hat(step % 4 == 3), t + BEAT / 2, 0.16, -0.25 if step % 2 == 0 else 0.25)
    t += BEAT
    step += 1

# Riser перед CTA (6.4s)
place(mix, whoosh(0.55), 5.88, 0.95)
place(mix, boom(1.1, 130.0, 42.0, 0.55), 6.4, 0.75)
place(mix, bell(1567.98, 1.4), 6.42, 0.2, -0.2)
place(mix, bell(2093.0, 1.4), 6.5, 0.18, 0.22)

# Мастеринг
bus = np.stack([hp(mix[:, 0], 32), hp(mix[:, 1], 32)], axis=1)
thr = 0.12
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.04 * SR))
env = gaussian_filter1d(env, sigma=0.016 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 4.0) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.35) / np.tanh(1.35)

fade_in = int(0.015 * SR)
fade_out = int(0.35 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.4

rms = np.sqrt(np.mean(bus ** 2))
bus *= 0.2 / max(rms, 1e-9)
peak = np.max(np.abs(bus))
if peak > 0.89:
    bus *= 0.89 / peak

out_path = sys.argv[1]
wavfile.write(out_path, SR, (np.clip(bus, -1.0, 1.0) * 32767.0).astype(np.int16))
print(f'audio ok: {out_path}')
