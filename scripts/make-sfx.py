"""Synthesize the selectable startup scores (no samples, no third-party audio).

Four original cues share the same 4.6 s storyboard timeline so any of them can
score the same animation; the settings page picks one or turns sound off:

  deepsea    "深海回响"   Arknights trailer idiom: D-minor pad, ticking hats,
                          snare build, braam drop, driving electro groove, choir tail.
  orchestral "凛冬管弦"   orchestral-leaning: bowed strings, timpani, brass stabs,
                          strings ostinato and a big choir/brass finale.
  neon       "霓虹脉冲"   industrial electronic: 150 BPM, four-on-the-floor kick,
                          saw bass 16ths, filtered arp, glitch accents, sub drop.
  calm       "静海氛围"   no drums: warm pad, piano-bell motif, sonar pings and a
                          soft final chord for a quiet startup.

Output: assets/sfx/{deepsea,orchestral,neon,calm}.wav — 32 kHz mono 16-bit PCM.
Everything is generated with numpy; styles are referenced, not copied.
"""

import os
import wave

import numpy as np

SR = 32000
DUR = 4.7
N = int(SR * DUR)
T = np.arange(N) / SR
RNG = np.random.default_rng(20261023)

MIX = np.zeros(N)
SIDECHAIN = []  # (time, depth)


def reset():
    global MIX, SIDECHAIN, RNG
    MIX = np.zeros(N)
    SIDECHAIN = []
    RNG = np.random.default_rng(20261023)


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
        sig += np.sin(2 * np.pi * f * k * t + k * 0.7) / k
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
    return sig / (np.max(np.abs(sig)) + 1e-9) * peak


# ------------------------------------------------------------------ instruments
def pad_note(freq, dur, amp, attack=0.35, release=0.6, brightness=1500, vib=0.0):
    sig = harm_saw(freq, dur, harmonics=12, detune=-5) * 0.6
    sig += harm_saw(freq, dur, harmonics=12, detune=6) * 0.6
    if vib:
        t = np.arange(len(sig)) / SR
        sig = lowpass(sig, brightness, order=2) * (1 + vib * np.sin(2 * np.pi * 5.3 * t))
    else:
        sig = lowpass(sig, brightness, order=2)
    env = adsr(len(sig), attack, 0.2, 0.85, release)
    return normalize(sig * env, amp)


def string_note(freq, dur, amp=0.05, brightness=3200):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = harm_saw(freq, dur, harmonics=11, detune=-6) * 0.55
    sig += harm_saw(freq, dur, harmonics=11, detune=5) * 0.55
    sig = lowpass(sig, brightness, order=2) * (1 + 0.005 * np.sin(2 * np.pi * 5.6 * t))
    env = adsr(n, 0.035, 0.06, 0.8, 0.08)
    return normalize(sig * env, amp)


def choir_note(freq, dur, amp):
    sig = harm_saw(freq, dur, harmonics=9, detune=-7) * 0.5
    sig += harm_saw(freq, dur, harmonics=9, detune=8) * 0.5
    sig = bandpass(sig, 300, 2600)
    t = np.arange(len(sig)) / SR
    sig *= 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
    env = adsr(len(sig), 0.45, 0.3, 0.8, 0.5)
    return normalize(sig * env, amp)


def piano_bell(freq, dur, amp):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for mult, pa, decay in ((1, 1.0, 1.0), (2.01, 0.5, 0.66), (3.02, 0.28, 0.45),
                            (4.05, 0.16, 0.32), (5.1, 0.1, 0.24), (6.2, 0.06, 0.18)):
        sig += pa * np.sin(2 * np.pi * freq * mult * t) * np.exp(-t / (decay * dur * 0.55))
    return normalize(sig * np.clip(t / 0.006, 0, 1), amp)


def kick(at, amp=0.55):
    n = int(SR * 0.42)
    t = np.arange(n) / SR
    pitch = 118 * np.exp(-t / 0.055) + 42
    sig = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t / 0.16)
    sig += 0.25 * np.exp(-t / 0.01) * noise(0.42)
    add(normalize(sig), at, amp)
    SIDECHAIN.append((at, 0.6))


def snare(at, amp=0.22):
    n = int(SR * 0.22)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    crack = bandpass(noise(0.22), 900, 7000) * np.exp(-t / 0.07)
    add(normalize(body + 0.9 * crack), at, amp)


def clap(at, amp=0.12):
    n = int(SR * 0.12)
    t = np.arange(n) / SR
    sig = bandpass(noise(0.12), 900, 5000) * np.exp(-t / 0.045)
    for d in (0.011, 0.022):
        idx = int(d * SR)
        sig[idx:] += bandpass(noise(0.12 - d), 900, 5000) * np.exp(-t[: len(sig) - idx] / 0.03) * 0.7
    add(normalize(sig), at, amp)


def hat(at, amp=0.06, short=True):
    dur = 0.045 if short else 0.12
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = highpass(noise(dur), 6500) * np.exp(-t / (0.012 if short else 0.05))
    add(normalize(sig), at, amp)


def braam(at, notes=("D1", "A1", "D2"), amp=0.5, drive=2.2, cutoff=900):
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
    sig = np.tanh(lowpass(sig, cutoff) * drive)
    env = adsr(n, 0.01, 0.25, 0.45, 0.6)
    add(normalize(sig * env), at, amp)
    SIDECHAIN.append((at, 0.35))


def brass_stab(at, notes=("D2", "A2", "D3"), amp=0.26):
    dur = 0.6
    n = int(SR * dur)
    t = np.arange(n) / SR
    bend = 1.0 + 0.05 * np.exp(-t / 0.05)
    sig = np.zeros(n)
    for name in notes:
        f = note_freq(name)
        for detune in (-7, 0, 8):
            phase = 2 * np.pi * np.cumsum(f * 2 ** (detune / 1200.0) * bend) / SR
            for k in range(1, 10):
                if f * k > SR / 2.2:
                    break
                sig += np.sin(k * phase + k * 0.7) / k
    sig = np.tanh(lowpass(sig, 1900) * 1.6)
    env = adsr(n, 0.015, 0.12, 0.55, 0.3)
    add(normalize(sig * env), at, amp)


def bass_note(freq, dur, amp=0.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    sig = lowpass(sig, 900)
    return normalize(sig * adsr(n, 0.006, 0.06, 0.55, 0.06), amp)


def saw_bass(freq, dur, amp=0.2, cutoff=700):
    sig = harm_saw(freq, dur, harmonics=8, detune=-4) + harm_saw(freq, dur, harmonics=8, detune=4)
    sig = lowpass(sig, cutoff)
    return normalize(sig * adsr(len(sig), 0.004, 0.04, 0.6, 0.04), amp)


def riser(start, dur, amp=0.12, f0=260, f1=1400):
    n = int(SR * dur)
    t = np.arange(n) / SR
    progress = t / dur
    freq = f0 * (f1 / f0) ** progress
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t))
    low = np.cumsum(freq * 0.5) / SR
    tone += 0.35 * np.sin(2 * np.pi * low) + 0.18 * np.sin(4 * np.pi * low)
    tone = normalize(tone) * progress ** 1.4
    sweep = normalize(bandpass(noise(dur), 400, 9000)) * progress ** 2
    add(0.55 * tone + 0.45 * sweep, start, amp)


def sonar_ping(at, freq=1046.5, amp=0.055):
    n = int(SR * 1.3)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.2)
    sig += 0.3 * np.sin(2 * np.pi * freq * 1.5 * t) * np.exp(-t / 0.28)
    tail = np.zeros(n)
    d = int(0.19 * SR)
    tail[d:] = sig[:-d] * 0.32
    add(normalize(sig + tail), at, amp)


def ui_tick(at, amp=0.02):
    n = int(SR * 0.012)
    t = np.arange(n) / SR
    sig = bandpass(noise(0.012), 2600, 5200) * np.exp(-t / 0.004)
    add(normalize(sig), at, amp)


def stamp(at, amp=0.2):
    n = int(SR * 0.16)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (150 * np.exp(-t / 0.03) + 70) * t) * np.exp(-t / 0.05)
    slap = bandpass(noise(0.16), 700, 2600) * np.exp(-t / 0.03)
    add(normalize(body + 0.7 * slap), at, amp)
    SIDECHAIN.append((at, 0.2))


def timpani(at, freq=82.0, amp=0.35):
    n = int(SR * 0.8)
    t = np.arange(n) / SR
    pitch = freq * np.exp(-t / 0.09) + freq * 0.55
    sig = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t / 0.18)
    sig += 0.2 * np.sin(2 * np.pi * np.cumsum(pitch * 1.5) / SR) * np.exp(-t / 0.1)
    sig += 0.12 * lowpass(noise(0.8), 400) * np.exp(-t / 0.05)
    add(normalize(sig), at, amp)


def cymbal(at, amp=0.09, dur=0.9):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = highpass(noise(dur), 4500) * np.exp(-t / 0.28)
    sig += 0.4 * bandpass(noise(dur), 2500, 7000) * np.exp(-t / 0.16)
    add(normalize(sig), at, amp)


def sub_drop(at, f0=70.0, f1=28.0, dur=0.6, amp=0.4):
    n = int(SR * dur)
    t = np.arange(n) / SR
    pitch = f1 + (f0 - f1) * np.exp(-t / 0.13)
    sig = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-t / 0.3)
    add(normalize(sig), at, amp)
    SIDECHAIN.append((at, 0.5))


def glitch_blip(at, amp=0.03, dur=0.03):
    n = int(SR * dur)
    t = np.arange(n) / SR
    freq = RNG.uniform(600, 2400)
    sig = np.sign(np.sin(2 * np.pi * freq * t)) * np.exp(-t / 0.012)
    add(normalize(bandpass(sig, 500, 5000)), at, amp)


# ------------------------------------------------------------------ finalizing
def finalize(peak=0.86, wet=0.22):
    duck = np.ones(N)
    for at, depth in SIDECHAIN:
        start = int(at * SR)
        if start >= N:
            continue
        length = min(N - start, int(0.3 * SR))
        seg = np.arange(length) / SR
        duck[start:start + length] -= depth * np.exp(-seg / 0.11)

    mix = MIX * np.clip(duck, 0.25, 1.0)

    ir_len = int(SR * 1.1)
    ir_t = np.arange(ir_len) / SR
    ir = RNG.standard_normal(ir_len) * np.exp(-ir_t / 0.28)
    ir = lowpass(ir, 3800)
    ir[: int(0.012 * SR)] = 0
    ir = normalize(ir)
    nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
    wet_sig = np.fft.irfft(np.fft.rfft(mix, nfft) * np.fft.rfft(ir, nfft), n=nfft)[:N]
    wet_sig = normalize(wet_sig)

    mix = normalize(mix, 1.0 - wet) + wet_sig * wet
    mix = np.tanh(mix * 1.25) / np.tanh(1.25)
    mix *= np.clip(T / 0.008, 0, 1)
    mix *= np.clip((DUR - T) / 0.22, 0, 1)
    return normalize(mix, peak)


def write_wav(name, mix):
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sfx")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{name}.wav")
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print(f"{name:10s} {os.path.getsize(path) // 1024:4d} KiB  peak {np.max(np.abs(mix)):.2f}  rms {np.sqrt(np.mean(mix ** 2)):.3f}")
    return path


# ---------------------------------------------------------------- 1. deepsea
def arrange_deepsea():
    BEAT = 60.0 / 138.0
    DROP = 1.74
    BAR = 4 * BEAT
    for name in ("D3", "F3", "A3"):
        add(pad_note(note_freq(name), DUR - 0.5, 0.10, attack=1.0, release=0.8, brightness=900), 0.0)
    add(pad_note(note_freq("D5"), 1.85, 0.030, attack=0.8, release=0.6, brightness=4000), 0.0)
    add(pad_note(note_freq("A5"), 1.85, 0.018, attack=1.0, release=0.6, brightness=5000), 0.2)
    bed = normalize(lowpass(noise(DUR), 320, order=3)) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.12 * T + 0.7))
    add(bed * np.clip(T / 0.8, 0, 1) * np.clip((DUR - T) / 0.5, 0, 1), 0.0, 0.032)
    for at, f in ((0.62, note_freq("A5")), (1.06, note_freq("D6"))):
        sonar_ping(at, f, 0.048)
    for at in (0.18, 0.31, 0.42, 0.55, 0.66, 0.80, 0.95, 1.12, 1.30):
        ui_tick(at, 0.016)
    add(piano_bell(note_freq("D5"), 1.1, 0.105), 0.92)
    add(piano_bell(note_freq("A4"), 0.9, 0.080), 1.14)
    add(piano_bell(note_freq("F4"), 0.8, 0.075), 1.34)
    for i in range(7):
        snare(1.06 + i * BEAT / 4, 0.045 + 0.02 * i)
    riser(0.98, 0.76, 0.09, 180, 880)
    braam(DROP, amp=0.42)
    kick(DROP, 0.62)
    add(choir_note(note_freq("D4"), 1.7, 0.055), DROP)
    for i in range(6):
        kick(DROP + i * BEAT, 0.52)
    for i in range(11):
        hat(DROP + i * BEAT / 2, 0.042 if i % 2 else 0.055, short=(i % 2 == 1))
    for at in (DROP + BEAT, DROP + 3 * BEAT, DROP + 5 * BEAT):
        snare(at, 0.16)
    bass_pattern = [("D2", 0.0), ("D2", 0.5), ("D3", 1.0), ("D2", 1.5), ("F2", 2.0), ("D2", 2.5),
                    ("A2", 3.0), ("D2", 3.5), ("Bb2", 4.0), ("Bb2", 4.5), ("F2", 5.0), ("Bb2", 5.5)]
    for name, beat in bass_pattern:
        add(bass_note(note_freq(name), BEAT / 2 * 0.88, 0.21), DROP + beat * BEAT)
    add(pad_note(note_freq("D3"), BAR, 0.15, attack=0.05, release=0.35, brightness=1400), DROP)
    add(pad_note(note_freq("A3"), BAR, 0.11, attack=0.05, release=0.35, brightness=1400), DROP)
    add(pad_note(note_freq("Bb2"), BEAT * 2.0, 0.15, attack=0.05, release=0.3, brightness=1700), DROP + 4 * BEAT)
    add(pad_note(note_freq("F3"), BEAT * 2.0, 0.11, attack=0.05, release=0.3, brightness=1700), DROP + 4 * BEAT)
    for name, at, dur in (("A4", 2.95, 0.7), ("Bb4", 3.35, 0.7), ("D5", 3.72, 0.85), ("F5", 4.02, 0.8)):
        add(pad_note(note_freq(name), dur, 0.07, attack=0.08, release=0.2, brightness=4200), at)
    arp = ["D5", "F5", "A5", "D6", "A5", "F5"]
    for i in range(20):
        add(piano_bell(note_freq(arp[i % len(arp)]), 0.32, 0.026), DROP + i * (BEAT / 4))
    stamp(3.08, 0.19)
    for at in (2.32, 2.46, 2.60, 2.74, 2.88, 3.02):
        ui_tick(at, 0.011)
    riser(3.30, 0.95, 0.11, 220, 1200)
    for i in range(9):
        snare(3.42 + i * BEAT / 5, 0.05 + 0.016 * i)
    braam(4.25, ("D1", "A1", "D2", "F2"), amp=0.62)
    kick(4.25, 0.78)
    for name, amp in (("D4", 0.115), ("F4", 0.09), ("A4", 0.09), ("E5", 0.065), ("D5", 0.065)):
        add(choir_note(note_freq(name), 0.95, amp), 4.25)
    add(piano_bell(note_freq("D6"), 1.0, 0.155), 4.25)
    add(piano_bell(note_freq("A5"), 0.9, 0.075), 4.33)
    add(piano_bell(note_freq("F5"), 0.8, 0.055), 4.40)


# -------------------------------------------------------------- 2. orchestral
def arrange_orchestral():
    for name in ("D3", "F3", "A3"):
        add(pad_note(note_freq(name), DUR - 0.5, 0.095, attack=0.9, release=0.8, brightness=1100, vib=0.004), 0.0)
    add(pad_note(note_freq("D2"), DUR - 0.8, 0.075, attack=1.1, release=0.9, brightness=700), 0.0)
    add(choir_note(note_freq("D4"), 2.0, 0.035), 0.3)
    bed = normalize(lowpass(noise(DUR), 280, order=3))
    add(bed * np.clip(T / 1.0, 0, 1) * np.clip((DUR - T) / 0.5, 0, 1), 0.0, 0.022)
    for name, at, amp in (("D5", 0.85, 0.10), ("A4", 1.10, 0.082), ("F4", 1.35, 0.078)):
        add(piano_bell(note_freq(name), 1.1, amp), at)
    for i in range(6):
        snare(1.18 + i * 0.06, 0.045 + 0.012 * i)
    riser(1.10, 0.5, 0.07, 200, 800)
    # drop: timpani + brass + cymbal
    timpani(1.60, note_freq("D2"), 0.36)
    brass_stab(1.60, ("D2", "A2", "D3"), 0.26)
    cymbal(1.60, 0.075)
    add(choir_note(note_freq("D4"), 1.3, 0.055), 1.60)
    # strings ostinato
    ostinato = ["D4", "F4", "A4", "F4", "D4", "F4", "A4", "F4",
                "Bb3", "D4", "F4", "D4", "Bb3", "D4", "F4", "D4",
                "C4", "E4", "G4", "E4", "C4", "E4", "G4", "E4"]
    for i, name in enumerate(ostinato):
        add(string_note(note_freq(name), 0.22, 0.048), 1.60 + i * 0.25)
    # cello bass half notes
    for name, at in (("D2", 1.60), ("A2", 2.40), ("Bb2", 3.20), ("F2", 4.00)):
        add(pad_note(note_freq(name), 0.85, 0.13, attack=0.04, release=0.1, brightness=600), at)
    for at in (1.60, 2.60, 3.60):
        timpani(at, note_freq("D2"), 0.22)
    brass_stab(2.60, ("Bb2", "F3", "Bb3"), 0.20)
    brass_stab(3.40, ("C3", "G3", "C4"), 0.20)
    for name, at in (("Bb3", 2.70), ("D4", 2.70), ("F4", 2.70)):
        add(choir_note(note_freq(name), 1.0, 0.045), at)
    for name, at, amp in (("D4", 3.50, 0.05), ("F4", 3.75, 0.05), ("A4", 4.00, 0.06)):
        add(string_note(note_freq(name), 0.5, amp), at)
    riser(3.30, 0.95, 0.09, 190, 900)
    for i in range(10):
        snare(3.15 + i * 0.095, 0.04 + 0.014 * i)
    # finale
    timpani(4.25, note_freq("D2"), 0.42)
    brass_stab(4.25, ("D2", "A2", "D3", "F3"), 0.34)
    cymbal(4.25, 0.10)
    for name, amp in (("D4", 0.10), ("F4", 0.085), ("A4", 0.085), ("E5", 0.06), ("D5", 0.06)):
        add(choir_note(note_freq(name), 0.9, amp), 4.25)
    add(piano_bell(note_freq("D6"), 0.9, 0.10), 4.25)
    add(pad_note(note_freq("D2"), 0.45, 0.12, attack=0.01, release=0.3, brightness=500), 4.25)


# ------------------------------------------------------------------- 3. neon
def arrange_neon():
    BEAT = 60.0 / 150.0
    for f, amp in ((36.71, 0.09), (73.42, 0.05)):
        n = int(SR * (DUR - 0.4))
        t = np.arange(n) / SR
        add(np.sin(2 * np.pi * f * t) * np.clip(t / 0.6, 0, 1) * np.clip((DUR - 0.4 - t) / 0.4, 0, 1), 0.0, amp)
    # filtered arp intro (16ths)
    intro_notes = ["D4", "F4", "A4", "D5", "A4", "F4", "D4", "A4"]
    for i in range(14):
        dur = 0.1
        sig = harm_saw(note_freq(intro_notes[i % len(intro_notes)]), dur, harmonics=7)
        cutoff = 900 + 2200 * (i / 14)
        sig = normalize(lowpass(sig, cutoff) * adsr(len(sig), 0.004, 0.05, 0.3, 0.03), 0.03)
        add(sig, 0.15 + i * 0.1)
    for at in (0.52, 0.88, 1.18):
        glitch_blip(at, 0.035)
    riser(0.90, 0.6, 0.09, 300, 1600)
    for i in range(5):
        snare(1.15 + i * 0.07, 0.05 + 0.015 * i)
    clap(1.42, 0.08)
    # drop
    DROP = 1.50
    kick(DROP, 0.6)
    sub_drop(DROP, 88, 36, 0.4, 0.30)
    braam(DROP, ("D1", "A1"), 0.30, drive=2.8, cutoff=1200)
    for i in range(7):
        kick(DROP + i * BEAT, 0.5)
    for i in range(14):
        hat(DROP + i * BEAT / 2, 0.035 if i % 2 else 0.05, short=(i % 2 == 1))
    for at in (DROP + 2 * BEAT, DROP + 4 * BEAT, DROP + 6 * BEAT):
        clap(at, 0.10)
    bass_seq = ["D2", "D2", "D3", "D2", "D2", "D3", "D2", "A2",
                "Bb2", "Bb2", "Bb3", "Bb2", "Bb2", "Bb3", "F2", "A2"]
    for i in range(16):
        add(saw_bass(note_freq(bass_seq[i]), 0.1, 0.19, 700 + 500 * (i % 4 == 0)), DROP + i * 0.1)
    # high arp over the groove
    arp = ["D5", "F5", "A5", "D6"]
    for i in range(18):
        add(piano_bell(note_freq(arp[i % 4]), 0.22, 0.024), DROP + i * 0.1)
    # chord stabs
    for at, notes in ((DROP, ("D3", "F3", "A3")), (DROP + 2.8, ("Bb2", "D3", "F3")), (DROP + 4.4, ("C3", "E3", "G3"))):
        for name in notes:
            add(pad_note(note_freq(name), 0.5, 0.07, attack=0.005, release=0.2, brightness=2600), at)
    riser(3.30, 0.95, 0.10, 320, 1800)
    for at in (3.55, 3.85, 4.10):
        glitch_blip(at, 0.03)
    # finale
    kick(4.25, 0.75)
    sub_drop(4.25, 110, 30, 0.5, 0.45)
    braam(4.25, ("D1", "A1", "D2"), 0.42, drive=3.2, cutoff=1400)
    cymbal(4.25, 0.08)
    for i, at in enumerate((4.34, 4.44, 4.54)):
        glitch_blip(at, 0.03 - i * 0.006)


# ------------------------------------------------------------------- 4. calm
def arrange_calm():
    for name, amp in (("D3", 0.060), ("F3", 0.050), ("A3", 0.045), ("E4", 0.035)):
        add(pad_note(note_freq(name), DUR - 0.3, amp, attack=1.3, release=0.9, brightness=900, vib=0.003), 0.0)
    add(pad_note(note_freq("D2"), DUR - 0.5, 0.045, attack=0.8, release=0.9, brightness=500), 0.0)
    bed = normalize(lowpass(noise(DUR), 240, order=3))
    add(bed * np.clip(T / 1.2, 0, 1) * np.clip((DUR - T) / 0.6, 0, 1), 0.0, 0.028)
    for name, at, amp in (("D5", 0.55, 0.085), ("A4", 1.05, 0.075), ("F4", 1.55, 0.065),
                          ("E4", 2.05, 0.06), ("D4", 2.55, 0.07), ("A4", 3.05, 0.05)):
        add(piano_bell(note_freq(name), 1.1, amp), at)
    for at, f in ((0.90, note_freq("A5")), (1.80, note_freq("D6"))):
        sonar_ping(at, f, 0.032)
    for at in (0.35, 0.72, 1.22):
        ui_tick(at, 0.008)
    riser(3.45, 0.70, 0.032, 300, 900)
    add(piano_bell(note_freq("D6"), 0.9, 0.085), 4.25)
    add(piano_bell(note_freq("A5"), 0.8, 0.045), 4.33)
    for name, amp in (("D4", 0.04), ("F4", 0.035), ("A4", 0.035)):
        add(choir_note(note_freq(name), 0.45, amp), 4.25)
    add(pad_note(note_freq("D2"), 0.45, 0.09, attack=0.01, release=0.3, brightness=450), 4.25)


VARIANTS = {
    "deepsea": (arrange_deepsea, 0.86, 0.22),
    "orchestral": (arrange_orchestral, 0.85, 0.26),
    "neon": (arrange_neon, 0.87, 0.18),
    "calm": (arrange_calm, 0.58, 0.34),
}


def main():
    for name, (fn, peak, wet) in VARIANTS.items():
        reset()
        fn()
        mix = finalize(peak=peak, wet=wet)
        write_wav(name, mix)


if __name__ == "__main__":
    main()

