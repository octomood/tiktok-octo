#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Звук к минутному релизному ролику TikTok octo 1.0.

60 секунд: фоновая музыка (96 BPM, 24 такта), голос по главам,
переходные whoosh'и и мягкий финальный аккорд.
"""

import os
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(1010)

BASE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(BASE, 'build-release', 'vo')

NO_VOICE = '--no-voice' in sys.argv
mix = np.zeros((N, 2), dtype=np.float64)
music = np.zeros((N, 2), dtype=np.float64)


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


def rhodes(freq, dur=2.2, amp=1.0, idx=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = idx * np.exp(-t / 0.45) * np.sin(2 * np.pi * freq * 2 * t)
    y = np.sin(2 * np.pi * freq * t + mod)
    y *= np.exp(-t / 1.4) * np.minimum(1.0, t / 0.014)
    y += 0.1 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t / 0.45)
    return y * amp


def bass(freq, dur=0.55, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(2 * np.pi * freq * 2 * t)
    y *= np.exp(-t / 0.18) * np.minimum(1.0, t / 0.006)
    return y * amp


def kick(amp=1.0, f0=70.0):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 42 + f0 * np.exp(-t * 22)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    y *= np.minimum(1.0, t / 0.002)
    return y * amp


def shaker(amp=1.0):
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 4200, 11000) * np.exp(-t / 0.018)
    y *= np.minimum(1.0, t / 0.001)
    return y * amp


def whoosh(dur=0.5, up=True, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    lo = bp(noise, 180, 700)
    mid = bp(noise, 700, 2400)
    hi = bp(noise, 2400, 8500)
    p = t / dur
    if not up:
        p = 1 - p
    p = p * p * (3 - 2 * p)
    y = lo * np.clip(1 - p * 1.6, 0, 1) * 0.9
    y += mid * np.clip(1 - np.abs(p - 0.45) * 2.6, 0, 1) * 0.75
    y += hi * np.clip(p * 1.3 - 0.3, 0, 1) * 0.55
    y *= np.sin(np.pi * (t / dur) ** 0.8) ** 1.4
    return y * amp


def bell(freq, dur=2.0, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 1.4), (2.76, 0.32, 0.8), (5.4, 0.14, 0.45)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    y *= np.minimum(1.0, t / 0.003) * np.minimum(1.0, (dur - t) / 0.4)
    return y * amp / 1.6


def pluck(freq, dur=1.0, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.7), (2.01, 0.3, 0.4), (3.02, 0.14, 0.25)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    y *= np.minimum(1.0, (dur - t) / 0.08)
    return y * amp / 1.6


def thock(amp=1.0, f0=200.0):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = 52 + f0 * np.exp(-t * 10)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    knock = bp(rng.standard_normal(n), 500, 2600) * np.exp(-t / 0.012) * 0.5
    y = body * 0.8 + knock
    y *= np.minimum(1.0, t / 0.0015)
    return y * amp


# --------------------------------------------------------------------------
# музыка: 24 такта по 2.5 с
# --------------------------------------------------------------------------

CHORDS = [
    ([110.0, 164.81, 196.0, 246.94, 261.63], 110.0, 164.81),  # Am9
    ([87.31, 130.81, 164.81, 220.0], 87.31, 130.81),           # Fmaj7
    ([130.81, 196.0, 246.94, 329.63], 130.81, 196.0),          # Cmaj7
    ([98.0, 146.83, 246.94, 329.63], 98.0, 196.0),             # G6
]

for bar in range(24):
    t0 = bar * 2.5
    notes, root, fifth = CHORDS[bar % 4]
    for k, f in enumerate(notes):
        place(music, rhodes(f, 2.4, 0.026 - k * 0.0012), t0 + 0.003 * k, gain=1.0, pan=-0.3 + k * 0.15)
    if bar >= 2:
        place(music, bass(root, 0.55, 0.09), t0, gain=1.0, pan=-0.05)
        place(music, bass(fifth, 0.45, 0.05), t0 + 1.25, gain=1.0, pan=0.05)
    if 2 <= bar < 19:
        place(music, kick(0.075), t0, gain=1.0)
        place(music, kick(0.06), t0 + 1.25, gain=1.0)
    for j in range(8):
        amp = 0.010 if bar < 19 else 0.007
        place(music, shaker(amp if j % 2 == 0 else amp * 0.7), t0 + j * 0.3125 + (0.02 if j % 2 else 0), gain=1.0, pan=0.25 - 0.5 * (j % 2))

# арпеджио поверх аккордов
for bar in range(24):
    notes, root, fifth = CHORDS[bar % 4]
    for j in range(4):
        f = notes[(j + bar) % len(notes)] * 2
        place(music, pluck(f, 0.8, 0.5), bar * 2.5 + j * 0.625 + 0.02, gain=0.05, pan=-0.25 + 0.5 * (j % 2))

# финальный аккорд
for k, f in enumerate([110.0, 164.81, 196.0, 246.94, 261.63]):
    place(music, rhodes(f, 4.0, 0.028), 55.5 + 0.004 * k, gain=1.0, pan=-0.25 + k * 0.13)

# --------------------------------------------------------------------------
# переходы и акценты
# --------------------------------------------------------------------------

place(mix, thock(0.8, f0=150), 0.12, gain=0.8)
for t0 in [3.5, 8.7, 13.9, 19.1, 24.3, 29.5, 34.7, 39.9, 45.1, 50.3]:
    place(mix, whoosh(0.45, up=False, amp=0.05), t0 - 0.22, gain=0.9, pan=0.1)
place(mix, whoosh(0.5, up=False, amp=0.06), 55.15, gain=0.9, pan=-0.1)
place(mix, thock(0.55, f0=170), 55.5, gain=0.6)
place(mix, bell(880.0, 2.2), 55.55, gain=0.1, pan=0.1)

# --------------------------------------------------------------------------
# голос
# --------------------------------------------------------------------------

VOICE_TIMES = [
    (0.30, 'v00'), (5.25, 'v01'), (11.55, 'v02'), (17.85, 'v03'),
    (24.15, 'v04'), (30.45, 'v05'), (36.75, 'v06'), (43.05, 'v07'),
    (49.35, 'v08'), (55.50, 'v09'),
]

voice_bus = np.zeros(N)
if not NO_VOICE:
    for t0, name in VOICE_TIMES:
        path = os.path.join(VO, name + '.wav')
        if not os.path.exists(path):
            print('missing', path)
            continue
        sr, data = wavfile.read(path)
        data = data.astype(np.float64) / 32768.0
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr != SR:
            data = signal.resample_poly(data, SR, sr)
        data = hp(data, 90)
        data = lp(data, 12000)
        data = np.tanh(data * 1.15) / np.tanh(1.15)
        data /= max(np.max(np.abs(data)), 1e-9)
        i = int(t0 * SR)
        n = min(len(data), N - i)
        voice_bus[i:i + n] += data[:n] * 0.9

    # короткий рупор
    ir_n = int(0.35 * SR)
    ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / (0.09 * SR))
    ir = lp(ir, 5000)
    ir /= np.max(np.abs(ir))
    wet = signal.fftconvolve(voice_bus, ir)[:N]
    voice_bus = voice_bus + wet * 0.1
    voice_bus *= 0.9 / max(np.max(np.abs(voice_bus)), 1e-9)
    voice_st = np.stack([voice_bus, np.roll(voice_bus, 60) * 0.98], axis=1)


# --------------------------------------------------------------------------
# микс
# --------------------------------------------------------------------------

music *= 1.5 if NO_VOICE else 1.5
music = np.stack([hp(music[:, 0], 55), hp(music[:, 1], 55)], axis=1)

env_sfx = maximum_filter1d(np.max(np.abs(mix), axis=1), size=int(0.12 * SR))
env_sfx = gaussian_filter1d(env_sfx, sigma=0.05 * SR)
duck = 1.0 - 0.5 * np.clip(env_sfx / (np.max(env_sfx) + 1e-9) * 2.2, 0, 1)

env_vo = maximum_filter1d(np.abs(voice_bus), size=int(0.15 * SR)) if not NO_VOICE else np.zeros(N)
env_vo = gaussian_filter1d(env_vo, sigma=0.06 * SR)
duck_vo = 1.0 if NO_VOICE else 1.0 - 0.45 * np.clip(env_vo / (np.max(env_vo) + 1e-9) * 2.0, 0, 1)

music *= (duck * duck_vo)[:, None]
if NO_VOICE:
    music *= 1.6
    bus = mix + music
bus = mix + music + (voice_st if not NO_VOICE else 0)

# реверб комнаты
n_ir = int(0.9 * SR)
t = np.arange(n_ir) / SR
room = rng.standard_normal((n_ir, 2)) * np.exp(-t / 0.24)[:, None]
room = np.stack([lp(room[:, 0], 5000), lp(room[:, 1], 5000)], axis=1)
room /= np.max(np.abs(room))
wet = np.stack([
    signal.fftconvolve(bus[:, 0], room[:, 0])[:N],
    signal.fftconvolve(bus[:, 1], room[:, 1])[:N],
], axis=1)
wet /= max(np.max(np.abs(wet)), 1e-9)
bus = bus + wet * (np.max(np.abs(bus)) * 0.14)

# воздух и компрессор
bus += 0.2 * np.stack([hp(bus[:, 0], 3800), hp(bus[:, 1], 3800)], axis=1)
thr = 0.16
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.045 * SR))
env = gaussian_filter1d(env, sigma=0.018 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 2.3) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.35) / np.tanh(1.35)

fade = int(0.5 * SR)
bus[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
bus[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]

peak = np.max(np.abs(bus))
bus = bus / peak * 0.9

args = [a for a in sys.argv[1:] if not a.startswith('--')]
out = args[0] if args else os.path.join(BASE, 'build-release', 'audio.wav')
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print(f'peak {20*np.log10(np.max(np.abs(bus))):.1f} dBFS · rms {20*np.log10(np.sqrt(np.mean(bus**2))):.1f} dBFS · {out}')
