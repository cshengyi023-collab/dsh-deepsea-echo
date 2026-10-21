"""Synthesize the startup sound design for the animation (no samples, pure math).

The cue follows the same timeline as the storyboard (base 4.6 s):
  terminal boot → sonar pings → hologram materialize → hard cut → operator file
  → stamp → riser → final boom + chime → tail.

Output: assets/sfx/startup.wav — 32 kHz mono 16-bit PCM (~300 KiB), embedded into
lib/client.js as a data URI by scripts/build.mjs.
"""

import os
import wave

import numpy as np

SR = 32000
DUR = 4.7
N = int(SR * DUR)
T = np.arange(N) / SR
RNG = np.random.default_rng(20261021)
MIX = np.zeros(N, dtype=np.float64)


def add(sig, at, gain=1.0):
    start = int(round(at * SR))
    if start >= N:
        return
    end = min(N, start + len(sig))
    MIX[start:end] += sig[: end - start] * gain


def env_exp(n, decay, attack=0.002):
    a = np.clip(np.arange(n) / max(1, int(attack * SR)), 0, 1)
    d = np.exp(-np.arange(n) / (decay * SR))
    return a * d


def sine(freq, dur, phase=0.0):
    n = int(SR * dur)
    return np.sin(2 * np.pi * freq * np.arange(n) / SR + phase)


def fft_filter(sig, curve):
    spec = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(len(sig), 1 / SR)
    return np.fft.irfft(spec * curve(freqs), n=len(sig))


def lowpass(sig, cutoff, order=2):
    return fft_filter(sig, lambda f: 1.0 / np.sqrt(1.0 + (f / cutoff) ** (2 * order)))


def highpass(sig, cutoff, order=2):
    return fft_filter(sig, lambda f: 1.0 / np.sqrt(1.0 + (cutoff / np.maximum(f, 1e-6)) ** (2 * order)))


def bandpass(sig, low, high):
    return lowpass(highpass(sig, low), high)


def noise(dur):
    return RNG.standard_normal(int(SR * dur))


def click(dur=0.03, freq=2400, amp=0.05, decay=0.008):
    sig = bandpass(noise(dur), freq * 0.6, freq * 1.6)
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * env_exp(len(sig), decay)
    return sig * amp


# ---------------------------------------------------------------- ambience bed
ocean = lowpass(noise(DUR), 260, order=3)
ocean = ocean / (np.max(np.abs(ocean)) + 1e-9)
lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * T + 1.2)
bed = ocean * lfo
fade_in = np.clip(T / 0.7, 0, 1)
fade_out = np.clip((DUR - T) / 0.7, 0, 1)
add(bed * fade_in * fade_out, 0, 0.055)

# ------------------------------------------------------------------ sub drone
drone = 0.7 * sine(42, DUR) + 0.25 * sine(63, DUR, 0.7) + 0.12 * sine(84, DUR, 1.9)
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.17 * T + 0.4)
drone_env = np.clip(T / 0.9, 0, 1) * np.clip((4.4 - T) / 0.6, 0, 1)
# swell just before the hard cut, duck after it
drone_env *= np.where(T < 2.0, 1.0 + 0.35 * np.clip((T - 1.4) / 0.6, 0, 1), 0.55)
add(drone * drone_env, 0, 0.10)

# ------------------------------------------------------------- boot log ticks
tick_times = [0.22, 0.39, 0.47, 0.56, 0.66, 0.79, 0.90, 0.99, 1.08, 1.18, 1.30, 1.42]
for i, at in enumerate(tick_times):
    add(click(0.02, 2600 + (i % 3) * 300, 0.028, 0.006), at)
# a couple of deeper terminal beeps
for at, f in ((0.62, 1320), (1.22, 990)):
    beep = sine(f, 0.11) * env_exp(int(0.11 * SR), 0.05, 0.004)
    add(beep, at, 0.035)

# ------------------------------------------------------------------ sonar pings
def ping(freq, dur=1.0, amp=0.085):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.22)
    sig += 0.35 * np.sin(2 * np.pi * freq * 0.5 * t) * np.exp(-t / 0.35)
    tail = np.zeros(n)
    delay = int(0.16 * SR)
    tail[delay:] = sig[:-delay] * 0.3
    return (sig + tail) * amp


for at, f in ((1.02, 1040), (1.42, 940), (1.82, 1180)):
    add(ping(f), at)

# -------------------------------------------------------- hologram materialize
mat_n = int(SR * 0.85)
mat_t = np.arange(mat_n) / SR
sweep = bandpass(noise(0.85), 320, 5200) * (mat_t / 0.85) ** 1.5
sweep = sweep / (np.max(np.abs(sweep)) + 1e-9)
add(sweep, 1.08, 0.05)
shimmer = 0.5 * sine(660, 0.85) + 0.3 * sine(990, 0.85, 1.1) + 0.2 * sine(1320, 0.85, 2.2)
shimmer *= 0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * mat_t))
shimmer *= np.clip(mat_t / 0.3, 0, 1) * np.clip((0.85 - mat_t) / 0.15, 0, 1)
add(shimmer, 1.08, 0.035)
for at in (1.16, 1.34, 1.53, 1.71):
    add(click(0.018, 1800, 0.05, 0.005), at)
    add(click(0.012, 3400, 0.03, 0.004), at + 0.004)

# --------------------------------------------------------- the hard cut (2.0 s)
n = int(SR * 0.6)
t = np.arange(n) / SR
thud = np.sin(2 * np.pi * (120 * np.exp(-t / 0.12) + 34) * t) * np.exp(-t / 0.22)
add(thud, 1.98, 0.42)
add(lowpass(noise(0.35), 700) * env_exp(int(0.35 * SR), 0.10), 1.98, 0.10)

# ------------------------------------------------------------- operator file
for at in (2.32, 2.42, 2.52, 2.62, 2.72, 2.82, 2.92, 3.02):
    add(click(0.016, 2800, 0.022, 0.005), at)
for at, f in ((2.58, 1760), (2.84, 1560)):
    add(sine(f, 0.06) * env_exp(int(0.06 * SR), 0.02, 0.002), at, 0.02)
# AUTHORIZED stamp at 3.08
add(bandpass(noise(0.09), 500, 1700) * env_exp(int(0.09 * SR), 0.03, 0.001), 3.08, 0.16)
add(np.sin(2 * np.pi * 150 * np.arange(int(0.2 * SR)) / SR) * env_exp(int(0.2 * SR), 0.05, 0.001), 3.08, 0.12)

# ------------------------------------------------------------------- riser
r_n = int(SR * (4.22 - 3.55))
r_t = np.arange(r_n) / SR
rise_freq = 180 * (700 / 180) ** (r_t / r_t[-1])
rise_phase = 2 * np.pi * np.cumsum(rise_freq) / SR
riser = 0.55 * np.sin(rise_phase) + 0.25 * np.sin(2 * rise_phase + 0.5)
riser *= (r_t / r_t[-1]) ** 1.6
add(riser, 3.55, 0.075)
add(bandpass(noise(4.22 - 3.55), 400, 4200) * (r_t / r_t[-1]) ** 2.0, 3.55, 0.045)

# --------------------------------------------------------- final hit + chime
t_hit = 4.24
n = int(SR * 0.5)
t = np.arange(n) / SR
boom = np.sin(2 * np.pi * (95 * np.exp(-t / 0.18) + 30) * t) * np.exp(-t / 0.30)
add(boom, t_hit, 0.55)
add(lowpass(noise(0.5), 900) * env_exp(int(0.5 * SR), 0.18), t_hit, 0.12)

for freq, amp, decay, detune in (
    (880, 0.085, 1.15, 0.0),
    (1320, 0.06, 0.95, 0.4),
    (1760, 0.045, 0.8, -0.3),
    (2200, 0.03, 0.65, 0.2),
    (2640, 0.022, 0.55, -0.5),
):
    n = int(SR * (DUR - t_hit))
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * (freq + detune) * t) * np.exp(-t / decay)
    sig += 0.3 * np.sin(2 * np.pi * (freq * 2.01) * t) * np.exp(-t / (decay * 0.6))
    add(sig, t_hit, amp)

shimmer_n = int(SR * 0.45)
shimmer_sig = highpass(noise(0.45), 2600) * env_exp(shimmer_n, 0.12)
shimmer_sig = shimmer_sig / (np.max(np.abs(shimmer_sig)) + 1e-9)
add(shimmer_sig, t_hit, 0.035)

# -------------------------------------------------------------- master chain
mix = np.tanh(MIX * 1.15) / np.tanh(1.15)
mix *= np.clip(T / 0.006, 0, 1)  # 6 ms de-click
mix *= np.clip((DUR - T) / 0.18, 0, 1)  # tail fade
peak = np.max(np.abs(mix)) + 1e-9
mix = mix / peak * 0.89
pcm = (mix * 32767).astype(np.int16)

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sfx")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "startup.wav")
with wave.open(out_path, "wb") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes(pcm.tobytes())

print(f"wrote {out_path}  {DUR}s  {SR}Hz mono  {os.path.getsize(out_path) // 1024} KiB")
print(f"peak {np.max(np.abs(mix)):.3f}  rms {np.sqrt(np.mean(mix ** 2)):.4f}  zero_crossings {np.sum(np.abs(np.diff(np.sign(mix))) > 0)}")
