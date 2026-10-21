"""Synthesize the startup cue: an original score in the Arknights trailer idiom.

No samples and no third-party audio: everything is generated here with numpy.
Style reference (not copied): dark cinematic electronic / orchestral hybrid —
D-minor pad bed, ticking hi-hats, sonar-like beeps, a snare build, a braam
impact on the drop, driving eighth-note bass, rising strings, and a final
impact with piano-bell and choir tail, drenched in a synthetic reverb.

Timeline (base 4.6 s at ~132 BPM, 4/4, D minor):
  0.00  ambient pad + air, sparse ticks, two sonar pings
  1.36  piano motif D5-A4-F4, snare build starts
  1.82  DROP: braam + kick/bass/hats groove over Dm
  2.73  chord move to Bb, string counter-line
  3.18  build: snare roll, filter opening, riser
  4.25  final hit: braam + boom + Dm(add9) choir + D6 bell, tail to 4.7 s

Output: assets/sfx/startup.wav — 44.1 kHz mono 16-bit PCM.
"""

import os
import wave

import numpy as np

SR = 44100
DUR = 4.7
N = int(SR * DUR)
T = np.arange(N) / SR
RNG = np.random.default_rng(20261022)

BPM = 132.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT

MIX = np.zeros(N)
SIDECHAIN_SOURCES = []  # (time, depth) kick/braam hits used for ducking


# --------------------------------------------------------------------- helpers
def add(sig, at, gain=1.0):
    start = int(round(at * SR))
    if start >= N:
        return
    end = min(N, start + len(sig))
    MIX[start:end] += sig[: end - start] * gain


def note_freq(name):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
             "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


def adsr(n, attack, decay, sustain, release):
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    env = np.ones(n) * sustain
    env[: min(n, a)] = np.linspace(0, 1, min(n, a))
    if n > a:
        seg = min(n - a, d)
        env[a : a + seg] = np.linspace(1, sustain, seg)
    if n > a + d:
        env[a + d :] = sustain
    if n > r:
        env[-r:] *= np.linspace(1, 0, r)
    return env


def harm_saw(freq, dur, harmonics=10, detune=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = freq * 2 ** (detune / 1200.0)
    sig = np.zeros(n)
    for k in range(1, harmonics + 1):
        if f * k > SR / 2.2:
            break
        sig += np.sin(2 * np.pi * f * k * t + (k * 0.7)) / k
    return sig


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


def normalize(sig, peak=1.0):
    p = np.max(np.abs(sig)) + 1e-9
    return sig / p * peak


# ------------------------------------------------------------------- instruments
def pad_note(freq, dur, amp, attack=0.35, release=0.6, brightness=1500):
    """String-ish pad: two detuned harmonic saws through a lowpass."""
    sig = harm_saw(freq, dur, harmonics=12, detune=-5) * 0.6
    sig += harm_saw(freq, dur, harmonics=12, detune=+6) * 0.6
    sig = lowpass(sig, brightness, order=2)
    env = adsr(len(sig), attack, 0.2, 0.85, release)
    return normalize(sig * env, amp)


def choir_note(freq, dur, amp):
    sig = harm_saw(freq, dur, harmonics=9, detune=-7) * 0.5
    sig += harm_saw(freq, dur, harmonics=9, detune=8) * 0.5
    sig = bandpass(sig, 300, 2600)
    t = np.arange(len(sig)) / SR
    sig *= 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
    env = adsr(len(sig), 0.5, 0.3, 0.8, 0.5)
    return normalize(sig * env, amp)


def piano_bell(freq, dur, amp):
    """FM-ish bell/piano with decaying partials."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    partials = ((1, 1.0, 1.0), (2.01, 0.5, 0.66), (3.02, 0.28, 0.45),
                (4.05, 0.16, 0.32), (5.1, 0.1, 0.24), (6.2, 0.06, 0.18))
    for mult, pa, decay in partials:
        sig += pa * np.sin(2 * np.pi * freq * mult * t) * np.exp(-t / (decay * dur * 0.55))
    attack = np.clip(t / 0.006, 0, 1)
    return normalize(sig * attack, amp)


def kick(at, amp=0.55):
    n = int(SR * 0.42)
    t = np.arange(n) / SR
    pitch = 118 * np.exp(-t / 0.055) + 42
    sig = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t / 0.16)
    sig += 0.25 * np.exp(-t / 0.01) * noise(0.42)
    add(normalize(sig, 1.0), at, amp)
    SIDECHAIN_SOURCES.append((at, 0.6))


def snare(at, amp=0.22):
    n = int(SR * 0.22)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    crack = bandpass(noise(0.22), 900, 7000) * np.exp(-t / 0.07)
    add(normalize(body + 0.9 * crack, 1.0), at, amp)


def hat(at, amp=0.06, short=True):
    dur = 0.045 if short else 0.12
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = highpass(noise(dur), 6500, order=2) * np.exp(-t / (0.012 if short else 0.05))
    add(normalize(sig, 1.0), at, amp)


def braam(at, notes=("D1", "A1", "D2"), amp=0.5):
    dur = 0.9
    n = int(SR * dur)
    t = np.arange(n) / SR
    bend = 1.0 + 0.14 * np.exp(-t / 0.12)
    sig = np.zeros(n)
    for name in notes:
        f = note_freq(name)
        for detune, level in ((-8, 0.5), (0, 0.7), (9, 0.5)):
            ff = f * 2 ** (detune / 1200.0) * bend
            sig += level * np.sin(2 * np.pi * np.cumsum(ff) / SR)
    sig = lowpass(sig, 900, order=2)
    sig = np.tanh(sig * 2.2)
    env = adsr(n, 0.01, 0.25, 0.45, 0.6)
    add(normalize(sig * env, 1.0), at, amp)
    SIDECHAIN_SOURCES.append((at, 0.35))


def bass_note(freq, dur, amp=0.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    sig = lowpass(sig, 900, order=2)
    env = adsr(n, 0.006, 0.06, 0.55, 0.06)
    return normalize(sig * env, amp)


def riser(start, dur, amp=0.12, f0=260, f1=1400, hp0=300, hp1=7000):
    n = int(SR * dur)
    t = np.arange(n) / SR
    progress = t / dur
    freq = f0 * (f1 / f0) ** progress
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t))
    low = np.cumsum(freq * 0.5) / SR
    tone += 0.35 * np.sin(2 * np.pi * low) + 0.18 * np.sin(4 * np.pi * low)
    tone = normalize(tone, 1.0) * progress ** 1.4
    sweep = bandpass(noise(dur), 400, 9000)
    sweep = normalize(sweep, 1.0) * progress ** 2
    add(0.55 * tone + 0.45 * sweep, start, amp)


def sonar_ping(at, freq=1046.5, amp=0.055):
    """Musical ping with a long tail, tuned into the key."""
    n = int(SR * 1.3)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.20)
    sig += 0.3 * np.sin(2 * np.pi * freq * 1.5 * t) * np.exp(-t / 0.28)
    tail = np.zeros(n)
    d = int(0.19 * SR)
    tail[d:] = sig[:-d] * 0.32
    add(normalize(sig + tail, 1.0), at, amp)


def ui_tick(at, amp=0.02):
    n = int(SR * 0.012)
    t = np.arange(n) / SR
    sig = bandpass(noise(0.012), 2600, 5200) * np.exp(-t / 0.004)
    add(normalize(sig, 1.0), at, amp)


def stamp(at, amp=0.2):
    n = int(SR * 0.16)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (150 * np.exp(-t / 0.03) + 70) * t) * np.exp(-t / 0.05)
    slap = bandpass(noise(0.16), 700, 2600) * np.exp(-t / 0.03)
    add(normalize(body + 0.7 * slap, 1.0), at, amp)
    SIDECHAIN_SOURCES.append((at, 0.2))


# ------------------------------------------------------------------ arrangement
BEAT = 60.0 / 138.0          # 138 BPM: two bars fit the 4.6 s storyboard
DROP = 1.74                  # hologram lock-on lands here
BAR = 4 * BEAT

dm = ("D3", "F3", "A3")

# --- intro pad (Dm) with slow swell + air
for name in dm:
    add(pad_note(note_freq(name), DUR - 0.5, 0.10, attack=1.0, release=0.8, brightness=900), 0.0)
add(pad_note(note_freq("D5"), 1.85, 0.030, attack=0.8, release=0.6, brightness=4000), 0.0)
add(pad_note(note_freq("A5"), 1.85, 0.018, attack=1.0, release=0.6, brightness=5000), 0.2)

bed = lowpass(noise(DUR), 320, order=3)
bed = normalize(bed, 1.0) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.12 * T + 0.7))
bed_env = np.clip(T / 0.8, 0, 1) * np.clip((DUR - T) / 0.5, 0, 1)
add(bed * bed_env, 0.0, 0.032)

# --- sonar pings + UI ticks + piano motif over the hologram
for at, f in ((0.62, note_freq("A5")), (1.06, note_freq("D6"))):
    sonar_ping(at, f, 0.048)
for at in (0.18, 0.31, 0.42, 0.55, 0.66, 0.80, 0.95, 1.12, 1.30):
    ui_tick(at, 0.016)
add(piano_bell(note_freq("D5"), 1.1, 0.105), 0.92)
add(piano_bell(note_freq("A4"), 0.9, 0.080), 1.14)
add(piano_bell(note_freq("F4"), 0.8, 0.075), 1.34)

# --- snare build into the drop
for i in range(7):
    snare(1.06 + i * (BEAT / 4), 0.045 + 0.02 * i)
riser(0.98, 0.76, amp=0.09, f0=180, f1=880, hp0=200, hp1=5200)

# --- the drop
braam(DROP, amp=0.42)
kick(DROP, 0.62)
add(choir_note(note_freq("D4"), 1.7, 0.055), DROP)

# groove: kicks on the beat through the operator-file section
kick_times = [DROP + i * BEAT for i in range(6)]
for at in kick_times:
    kick(at, 0.52)
for i in range(0, 11):
    hat(DROP + i * BEAT / 2, 0.042 if i % 2 else 0.055, short=(i % 2 == 1))
for at in (DROP + BEAT, DROP + 3 * BEAT, DROP + 5 * BEAT):
    snare(at, 0.16)

# bass eighth notes: Dm bar then Bb bar
bass_pattern = [
    ("D2", 0.0), ("D2", 0.5), ("D3", 1.0), ("D2", 1.5),
    ("F2", 2.0), ("D2", 2.5), ("A2", 3.0), ("D2", 3.5),
    ("Bb2", 4.0), ("Bb2", 4.5), ("F2", 5.0), ("Bb2", 5.5),
]
for name, beat in bass_pattern:
    add(bass_note(note_freq(name), BEAT / 2 * 0.88, 0.21), DROP + beat * BEAT)

# pad chords moving Dm → Bb
add(pad_note(note_freq("D3"), BAR, 0.15, attack=0.05, release=0.35, brightness=1400), DROP)
add(pad_note(note_freq("A3"), BAR, 0.11, attack=0.05, release=0.35, brightness=1400), DROP)
add(pad_note(note_freq("Bb2"), BEAT * 2.0, 0.15, attack=0.05, release=0.3, brightness=1700), DROP + 4 * BEAT)
add(pad_note(note_freq("F3"), BEAT * 2.0, 0.11, attack=0.05, release=0.3, brightness=1700), DROP + 4 * BEAT)

# rising string counter-line towards the lockup
for name, at, dur in (("A4", 2.95, 0.7), ("Bb4", 3.35, 0.7), ("D5", 3.72, 0.85), ("F5", 4.02, 0.8)):
    add(pad_note(note_freq(name), dur, 0.07, attack=0.08, release=0.2, brightness=4200), at)

# quiet 16th arp plucks from the drop onwards
arp_notes = ["D5", "F5", "A5", "D6", "A5", "F5"]
for i in range(20):
    add(piano_bell(note_freq(arp_notes[i % len(arp_notes)]), 0.32, 0.026), DROP + i * (BEAT / 4))

# picture-synced accents
stamp(3.08, 0.19)
for at in (2.32, 2.46, 2.60, 2.74, 2.88, 3.02):
    ui_tick(at, 0.011)

# --- build to the final hit
riser(3.30, 0.95, amp=0.11, f0=220, f1=1200, hp0=250, hp1=8000)
for i in range(9):
    snare(3.42 + i * BEAT / 5, 0.05 + 0.016 * i)

# --- final hit at 4.25 s: braam + boom + choir(add9) + bell
braam(4.25, notes=("D1", "A1", "D2", "F2"), amp=0.62)
kick(4.25, 0.78)
SIDECHAIN_SOURCES.append((4.25, 0.5))
for name, amp in (("D4", 0.115), ("F4", 0.09), ("A4", 0.09), ("E5", 0.065), ("D5", 0.065)):
    add(choir_note(note_freq(name), 0.95, amp), 4.25)
add(piano_bell(note_freq("D6"), 1.0, 0.155), 4.25)
add(piano_bell(note_freq("A5"), 0.9, 0.075), 4.33)
add(piano_bell(note_freq("F5"), 0.8, 0.055), 4.40)

# ------------------------------------------------------------------ mix + space
duck = np.ones(N)
for at, depth in SIDECHAIN_SOURCES:
    start = int(at * SR)
    if start >= N:
        continue
    length = min(N - start, int(0.3 * SR))
    seg = np.arange(length) / SR
    duck[start:start + length] -= depth * np.exp(-seg / 0.11)

mix = MIX * np.clip(duck, 0.25, 1.0)

# synthetic reverb: decaying lowpassed noise impulse, convolution via FFT
ir_len = int(SR * 1.1)
ir_t = np.arange(ir_len) / SR
ir = RNG.standard_normal(ir_len) * np.exp(-ir_t / 0.28)
ir = lowpass(ir, 3800, order=2)
ir[: int(0.012 * SR)] = 0
ir = normalize(ir, 1.0)

nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.fft.irfft(np.fft.rfft(mix, nfft) * np.fft.rfft(ir, nfft), n=nfft)[:N]
wet = wet / (np.max(np.abs(wet)) + 1e-9)
mix = normalize(mix, 0.82) + wet * 0.22

# gentle glue + soft clip + fades
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix *= np.clip(T / 0.008, 0, 1)
mix *= np.clip((DUR - T) / 0.22, 0, 1)
mix = normalize(mix, 0.86)
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
print(f"peak {np.max(np.abs(mix)):.3f}  rms {np.sqrt(np.mean(mix ** 2)):.4f}")

for start in np.arange(0, DUR, 0.25):
    seg = mix[int(start * SR) : int(min(DUR, start + 0.25) * SR)]
    print(f"  {start:4.2f}s rms {np.sqrt(np.mean(seg ** 2)):.3f}  peak {np.max(np.abs(seg)):.2f}")
