#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к 5-секундной рекламе TikTok octo.

Голос — записанный/синтезированный файл vo.wav (48 кГц, моно).
Музыка и фоли — синтез, как в остальных роликах: 96 BPM, Am9 → Fmaj7,
лёгкий грув и акценты на появление стикера и CTA.
"""

import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

SR = 48000
DUR = 5.0
N = int(SR * DUR)
rng = np.random.default_rng(1711)

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


def thock(amp=1.0, f0=200.0):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = 52 + f0 * np.exp(-t * 10)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    knock = bp(rng.standard_normal(n), 500, 2600) * np.exp(-t / 0.012) * 0.55
    sub = np.sin(2 * np.pi * 58 * t) * np.exp(-t / 0.14) * 0.22
    y = body * 0.8 + knock + sub
    y *= np.minimum(1.0, t / 0.0015)
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


def bell(freq, dur=1.8, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 1.2), (2.76, 0.34, 0.7), (5.4, 0.16, 0.4)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    y *= np.minimum(1.0, t / 0.003)
    y *= np.minimum(1.0, (dur - t) / 0.3)
    return y * amp / 1.6


def pluck(freq, dur=1.2, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, a, tau in [(1.0, 1.0, 0.8), (2.01, 0.3, 0.45), (3.02, 0.15, 0.3)]:
        y += a * np.sin(2 * np.pi * freq * ratio * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    y *= np.minimum(1.0, (dur - t) / 0.1)
    return y * amp / 1.6


def rhodes(freq, dur=2.0, amp=1.0, idx=1.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = idx * np.exp(-t / 0.4) * np.sin(2 * np.pi * freq * 2 * t)
    y = np.sin(2 * np.pi * freq * t + mod)
    y *= np.exp(-t / 1.3) * np.minimum(1.0, t / 0.012)
    y += 0.12 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t / 0.4)
    return y * amp


def bass(freq, dur=0.5, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2 * t))
    y *= np.exp(-t / 0.16) * np.minimum(1.0, t / 0.006)
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


def pop(f0=520.0, f1=980.0, dur=0.1, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    y *= np.minimum(1.0, t / 0.002)
    return y * amp


# --------------------------------------------------------------------------
# фоли 5-секундного ролика
# --------------------------------------------------------------------------

# стикер влетает
place(mix, thock(0.85, f0=150), 0.17, gain=0.9)
place(mix, bp(rng.standard_normal(int(0.08 * SR)), 1200, 6000) * np.exp(-np.arange(int(0.08 * SR)) / (0.012 * SR)) * 0.5, 0.17, gain=0.6)
place(mix, bass(55.0, 0.5, 0.5), 0.17, gain=0.8)

# переход к CTA
place(mix, whoosh(0.45, up=False, amp=0.16), 2.38, gain=0.9, pan=0.15)
place(mix, thock(0.5, f0=230), 2.62, gain=0.7)
place(mix, pop(520, 980, 0.09, 0.6), 2.62, gain=0.9, pan=0.1)

# финальный акцент
place(mix, bell(880.0, 1.6), 4.28, gain=0.1, pan=-0.1)
place(mix, pluck(659.25, 1.0, 1.0), 4.32, gain=0.1, pan=0.1)

# --------------------------------------------------------------------------
# музыка: 2 такта по 2.5 с
# --------------------------------------------------------------------------

chords = [
    (0.0, [110.0, 164.81, 196.0, 246.94, 261.63], 110.0, 164.81),  # Am9
    (2.5, [87.31, 130.81, 164.81, 220.0], 87.31, 130.81),           # Fmaj7
]

for i, (t0, notes, root, fifth) in enumerate(chords):
    for k, f in enumerate(notes):
        place(music, rhodes(f, 2.4, 0.028 - k * 0.0012), t0 + 0.003 * k, gain=1.0, pan=-0.3 + k * 0.15)
    place(music, bass(root, 0.55, 0.10), t0, gain=1.0, pan=-0.05)
    place(music, bass(fifth, 0.45, 0.06), t0 + 1.25, gain=1.0, pan=0.05)
    place(music, kick(0.085), t0, gain=1.0)
    place(music, kick(0.07), t0 + 1.25, gain=1.0)
    for j in range(8):
        place(music, shaker(0.012 if j % 2 == 0 else 0.008), t0 + j * 0.3125 + (0.02 if j % 2 else 0), gain=1.0, pan=0.25 - 0.5 * (j % 2))

# маримба-риф для энергии
for i, f in enumerate([220.0, 261.63, 329.63, 440.0, 392.0, 329.63]):
    place(music, pluck(f, 0.9, 0.9), 0.55 + i * 0.3125, gain=0.08, pan=-0.2 + (i % 2) * 0.4)

# финальный аккорд-разрешение
for k, f in enumerate([110.0, 164.81, 196.0, 246.94, 261.63]):
    place(music, rhodes(f, 1.4, 0.02), 4.05 + 0.004 * k, gain=1.0, pan=-0.25 + k * 0.13)

# --------------------------------------------------------------------------
# голос
# --------------------------------------------------------------------------

vo_path = sys.argv[1] if len(sys.argv) > 1 else 'vo.wav'
vo_sr, vo = wavfile.read(vo_path)
vo = vo.astype(np.float64) / 32768.0
if vo.ndim > 1:
    vo = vo.mean(axis=1)
if vo_sr != SR:
    vo = signal.resample_poly(vo, SR, vo_sr)
vo = hp(vo, 90)
vo = lp(vo, 12000)
vo = np.tanh(vo * 1.15) / np.tanh(1.15)

voice = np.zeros(N)
start = int(0.30 * SR)
n = min(len(vo), N - start)
voice[start:start + n] = vo[:n]
# короткий «рупор», чтобы голос не звучал сухо
ir_n = int(0.35 * SR)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / (0.09 * SR))
ir = lp(ir, 5000)
ir /= np.max(np.abs(ir))
wet = signal.fftconvolve(voice, ir)[:N]
voice = voice + wet * 0.12
voice *= 0.9 / max(np.max(np.abs(voice)), 1e-9)
mix_voice = np.stack([voice, np.roll(voice, 80) * 0.98], axis=1)

# --------------------------------------------------------------------------
# микс
# --------------------------------------------------------------------------

music *= 1.5
music = np.stack([hp(music[:, 0], 55), hp(music[:, 1], 55)], axis=1)

# дакинг музыки под фоли и голос
env_sfx = maximum_filter1d(np.max(np.abs(mix), axis=1), size=int(0.12 * SR))
env_sfx = gaussian_filter1d(env_sfx, sigma=0.05 * SR)
duck = 1.0 - 0.5 * np.clip(env_sfx / (np.max(env_sfx) + 1e-9) * 2.2, 0, 1)

env_vo = maximum_filter1d(np.abs(voice), size=int(0.15 * SR))
env_vo = gaussian_filter1d(env_vo, sigma=0.06 * SR)
duck_vo = 1.0 - 0.42 * np.clip(env_vo / (np.max(env_vo) + 1e-9) * 2.0, 0, 1)

music *= (duck * duck_vo)[:, None]

bus = mix + music + mix_voice

# реверб маленькой комнаты
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
bus = bus + wet * (np.max(np.abs(bus)) * 0.16)

# воздух сверху
bus += 0.22 * np.stack([hp(bus[:, 0], 3800), hp(bus[:, 1], 3800)], axis=1)

# компрессор
thr = 0.16
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.045 * SR))
env = gaussian_filter1d(env, sigma=0.018 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 2.3) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.4) / np.tanh(1.4)

fade = int(0.28 * SR)
bus[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.4
bus[:int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]

peak = np.max(np.abs(bus))
bus = bus / peak * 0.78

out = sys.argv[2] if len(sys.argv) > 2 else 'audio-5s.wav'
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print(f'peak {20*np.log10(np.max(np.abs(bus))):.1f} dBFS · rms {20*np.log10(np.sqrt(np.mean(bus**2))):.1f} dBFS · {out}')
