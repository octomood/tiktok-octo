#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Звук к ролику «color drop» — 10 секунд, 1080×1920.

Плакатный бит 112.5 BPM: саб-удар на появлении слова, два «капли» на плашках
цветов, колокольчик на звезде, подъём и большой аккорд на финале с QR.
Ни одного сэмпла — только синтез.

    python3 docs/promo/drop-audio.py docs/promo/build-drop/audio.wav
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

BEAT = 60.0 / 112.5  # 0.5333 с
SLAM = 1.0667        # слово встаёт в кадр
IMPACT = 6.4         # финал с QR
BREAK0 = 5.867       # пауза перед финалом
BREAK1 = IMPACT

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


def sweep(f0, f1, dur, decay, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / max(decay, 1e-4))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return x * env_exp(n, 0.0015, decay * 1.4) * amp


# --------------------------------------------------------------------------
# инструменты
# --------------------------------------------------------------------------

def boom(amp=1.0, f0=92.0, f1=38.0, dur=1.1):
    """Сабы: низкий удар с коротким щелчком."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sweep(f0, f1, dur, 0.16, 1.0)
    x += 0.25 * rng.standard_normal(n) * np.exp(-t / 0.012)
    return lp(x, 240) * amp


def paper(amp=1.0, dur=0.16):
    """Шлепок плаката: широкий шум и сухой хлопок."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 260, 6200) * np.exp(-t / 0.035)
    x += 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.025)
    return fade(x, 0.001, 0.02) * amp


def plop(f0=920.0, f1=210.0, amp=1.0):
    """Капля краски: падение тона и мокрый щелчок."""
    n = int(0.26 * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.028)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.075)
    x += 0.28 * bp(rng.standard_normal(n), 700, 3400) * np.exp(-t / 0.012)
    return fade(x, 0.001, 0.03) * amp


def kick(amp=1.0):
    return boom(amp, 150.0, 46.0, 0.42)


def clap(amp=1.0):
    n = int(0.3 * SR)
    x = np.zeros(n)
    for d in (0.0, 0.011, 0.023):
        i = int(d * SR)
        m = n - i
        t = np.arange(m) / SR
        x[i:] += bp(rng.standard_normal(m), 850, 2600) * np.exp(-t / 0.028)
    x += 0.4 * hp(rng.standard_normal(n), 1800) * np.exp(-np.arange(n) / SR / 0.012)
    return x * amp


def hat(open_=False, amp=1.0):
    n = int((0.11 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7200)
    x += 0.35 * np.sin(2 * np.pi * 9800 * t) * np.exp(-t / 0.02)
    return x * np.exp(-t / (0.06 if open_ else 0.018)) * amp


def bass(freq, dur, amp=1.0):
    """Саб-бас с мягкой атакой и лёгким перегрузом."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(2 * np.pi * freq * 2 * t)
    x = np.tanh(x * 1.6) / np.tanh(1.6)
    env = np.minimum(1.0, t / 0.012) * np.exp(-t / (dur * 0.55))
    return x * env * amp


def stab(freqs, dur=1.5, amp=0.14, attack=0.006, decay=0.5):
    """Аккорд-штамп: плотный, короткий, с расстройкой по каналам."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for i, f in enumerate(freqs):
        a = amp / (1 + 0.3 * i)
        for ch, det in ((0, -0.0016), (1, 0.0016)):
            t = np.arange(n) / SR
            ff = f * (1 + det)
            y = (
                np.sin(2 * np.pi * ff * t)
                + 0.4 * np.sin(2 * np.pi * ff * 2 * t)
                + 0.14 * np.sin(2 * np.pi * ff * 3 * t)
            )
            out[:, ch] += y * env_exp(n, attack, decay) * a
    return out


def bell(freq, dur=1.8, amp=1.0):
    """Стеклянный колокольчик: негармонические обертоны."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for ratio, a, d in ((1.0, 1.0, 0.62), (2.01, 0.5, 0.4), (2.98, 0.3, 0.26), (4.21, 0.16, 0.16)):
        x += a * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / d)
    return x * np.minimum(1.0, t / 0.002) * amp


def riser(dur=0.55, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    x = np.sin(2 * np.pi * np.cumsum(180 * (1 + 16 * u ** 2)) / SR) * 0.35
    x += bp(rng.standard_normal(n), 500, 9000) * 0.5
    x *= u ** 1.5
    return fade(x, 0.01, 0.02) * amp


def air(dur=2.0, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 2200, 9000)
    x *= np.minimum(1.0, t / 0.6) * np.minimum(1.0, (dur - t) / 0.7)
    return x * amp


def make_ir(seconds=1.05):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / 0.24)[:, None]
    ir = np.stack([lp(ir[:, 0], 5600), lp(ir[:, 1], 5600)], axis=1)
    for d, g in [(0.009, 0.6), (0.019, 0.4), (0.031, 0.25), (0.049, 0.14)]:
        i = int(d * SR)
        ir[i, 0] += g
        ir[i, 1] += g * 0.92
    ir *= np.linspace(1.0, 0.0, n)[:, None] ** 0.3
    ir /= np.max(np.abs(ir))
    return ir


# --------------------------------------------------------------------------
# сцена
# --------------------------------------------------------------------------

# вступление: низкий «дроп» краски и воздух
place(mix, boom(0.55, 210.0, 44.0, 1.4), 0.02, 0.4)
place(mix, air(1.6, 0.05), 0.0)

# плашка версии выпрыгивает
place(mix, paper(0.9), 0.5, 0.55, -0.05)
place(mix, plop(760, 300, 0.8), 0.47, 0.35, -0.1)

# слово встаёт: удар, хлопок и аккорд
place(mix, boom(1.0, 120.0, 36.0, 1.3), SLAM, 0.62)
place(mix, paper(1.0, 0.22), SLAM, 0.5)
place(mix, stab([220.0, 261.63, 329.63, 440.0], 1.9, 0.16, decay=0.62), SLAM, 0.62)
place(mix, bell(1046.5, 1.2, 0.16), SLAM, 0.18, 0.25)
place(mix, air(1.2, 0.05), SLAM, 0.35)

# две капли на плашках цветов
place(mix, plop(1000, 240, 1.0), 1.84, 0.42, -0.35)
place(mix, plop(720, 170, 1.0), 2.1, 0.4, 0.35)

# звезда: колокольчик и шлейф
place(mix, bell(1318.5, 2.0, 0.2), 2.6, 0.34, 0.1)
place(mix, bell(1760.0, 1.4, 0.08), 2.68, 0.2, -0.2)
place(mix, air(1.8, 0.04), 2.5, 0.4)

# --------------------------------------------------------------------------
# бит 112.5 BPM от удара до конца, с паузой перед финалом
# --------------------------------------------------------------------------

chords = [
    (0, [220.0, 261.63, 329.63, 392.0]),   # Am7
    (4, [174.61, 220.0, 261.63, 349.23]),  # F
    (8, [261.63, 329.63, 392.0, 523.25]),  # C
    (12, [196.0, 246.94, 293.66, 392.0]),  # G
]

for bar, freqs in chords:
    t0 = SLAM + bar * BEAT
    place(mix, stab(freqs, 1.7, 0.055, attack=0.01, decay=0.55), t0, 0.75, 0.0)
    place(mix, bass(freqs[0] / 2, 1.9, 0.5), t0, 0.62)

beat = 0
while True:
    t0 = SLAM + beat * BEAT
    if t0 > 9.62:
        break
    if not (BREAK0 - 1e-6 <= t0 < BREAK1):
        place(mix, kick(0.9), t0, 0.5)
        if beat % 2 == 1:
            place(mix, clap(0.8), t0, 0.3, 0.05)
        place(mix, hat(False, 0.7), t0 + BEAT / 2, 0.13, -0.3)
        place(mix, hat(beat % 4 == 3, 0.8), t0 + BEAT / 2, 0.09, 0.3)
    beat += 1

# заполнение перед финалом
place(mix, riser(0.62, 0.55), BREAK1 - 0.62, 0.5)
place(mix, air(0.8, 0.05), BREAK0, 0.5)

# финал: удар, большой аккорд и искры
place(mix, boom(1.0, 130.0, 40.0, 1.5), IMPACT, 0.7)
place(mix, paper(0.9, 0.26), IMPACT, 0.42)
place(mix, stab([261.63, 329.63, 392.0, 523.25, 659.25], 2.4, 0.15, decay=0.8), IMPACT, 0.8)
place(mix, bell(2093.0, 1.6, 0.07), IMPACT + 0.02, 0.22, -0.2)
place(mix, bell(1568.0, 1.8, 0.06), IMPACT + 0.1, 0.18, 0.25)
place(mix, air(2.2, 0.05), IMPACT, 0.4)

# мелкие искры на финале
for i, f in enumerate([2637.0, 3136.0, 2349.0, 3520.0]):
    place(mix, bell(f, 0.9, 0.05), 7.1 + i * 0.34, 0.16, -0.4 + 0.26 * i)

# последний низкий удар в конце
place(mix, boom(0.5, 90.0, 36.0, 1.4), 9.42, 0.4)

# --------------------------------------------------------------------------
# реверб и мастеринг
# --------------------------------------------------------------------------

ir = make_ir()
wet = np.stack([
    signal.fftconvolve(mix[:, 0], ir[:, 0])[:N],
    signal.fftconvolve(mix[:, 1], ir[:, 1])[:N],
], axis=1)
wet /= max(np.max(np.abs(wet)), 1e-9)
bus = mix + wet * (np.max(np.abs(mix)) * 0.14)

bus = np.stack([hp(bus[:, 0], 32), hp(bus[:, 1], 32)], axis=1)

thr = 0.1
env = maximum_filter1d(np.max(np.abs(bus), axis=1), size=int(0.04 * SR))
env = gaussian_filter1d(env, sigma=0.016 * SR)
gain = np.where(env > thr, (thr + (env - thr) / 4.0) / np.maximum(env, 1e-9), 1.0)
bus *= gain[:, None]
bus = np.tanh(bus * 1.45) / np.tanh(1.45)

fade_in = int(0.012 * SR)
fade_out = int(0.35 * SR)
bus[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bus[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.4

# целевая громкость: около −14 LUFS, пик не выше −1 dBFS
rms = np.sqrt(np.mean(bus ** 2))
bus *= 0.2 / max(rms, 1e-9)
peak = np.max(np.abs(bus))
if peak > 0.89:
    bus *= 0.89 / peak
bus[-48:] *= np.linspace(1, 0, 48)[:, None]

print(
    f'peak {20 * np.log10(np.max(np.abs(bus))):.1f} dBFS · '
    f'rms {20 * np.log10(np.sqrt(np.mean(bus ** 2))):.1f} dBFS'
)

out = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
wavfile.write(out, SR, (bus * 32767).astype(np.int16))
print('wrote', out)
