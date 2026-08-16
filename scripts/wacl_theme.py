"""
The WACL Theme — an original composition for the league, generated as MIDI.

    python scripts/wacl_theme.py

D Dorian throughout (the B-natural over a minor home is the signature colour).
128 BPM x 48 bars of 4/4 = 90.000 seconds exactly, built to loop: the final
bars strip back to the bare bass engine that bar 1 opens with, so the seam is
inaudible. Six sections of eight bars each:

    A  bass engine + sparse kick          D  + lead melody
    B  + full drums                       E  peak: pads, octave arp double
    C  + 16th-note arpeggio               F  strip down to the engine

Composed for this script: the two-bar bass ostinato, the i-IV (Dm7 -> G) arp
engine, and the eight-bar lead are original. Writes public/media/wacl-theme.mid.
"""

from __future__ import annotations

import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public/media/wacl-theme.mid"

PPQ = 480
SIXTEENTH = PPQ // 4
BAR = PPQ * 4
BARS = 48
TOTAL = BARS * BAR
TEMPO_US = 468_750  # 128 BPM -> 48 bars = 90.000 s

# D dorian pitches (MIDI): D2=38 E2=40 F2=41 G2=43 A2=45 B2=47 C3=48 D3=50
D2, E2, F2, G2, A2, B2, C3, D3 = 38, 40, 41, 43, 45, 47, 48, 50


def vlq(value: int) -> bytes:
    out = [value & 0x7F]
    while value := value >> 7:
        out.append(0x80 | (value & 0x7F))
    return bytes(reversed(out))


class Track:
    def __init__(self, name: str, channel: int = 0, program: int | None = None):
        self.events: list[tuple[int, int, bytes]] = []  # (tick, order, bytes)
        self.channel = channel
        self.meta(0, 0x03, name.encode())
        if program is not None:
            self.events.append((0, 0, bytes([0xC0 | channel, program])))

    def meta(self, tick: int, kind: int, payload: bytes) -> None:
        self.events.append((tick, 0, bytes([0xFF, kind, len(payload)]) + payload))

    def note(self, tick: int, pitch: int, length: int, velocity: int) -> None:
        end = min(tick + length, TOTAL)
        self.events.append((tick, 1, bytes([0x90 | self.channel, pitch, velocity])))
        self.events.append((end, 0, bytes([0x80 | self.channel, pitch, 0])))

    def chunk(self) -> bytes:
        self.events.append((TOTAL, 2, bytes([0xFF, 0x2F, 0x00])))
        self.events.sort(key=lambda e: (e[0], e[1]))
        data, clock = b"", 0
        for tick, _, payload in self.events:
            data += vlq(tick - clock) + payload
            clock = tick
        return b"MTrk" + struct.pack(">I", len(data)) + data


def section(bar: int) -> int:
    return bar // 8  # 0..5 -> A..F


# ---- conductor --------------------------------------------------------------
conductor = Track("WACL Theme - original composition, D Dorian, 90s loop")
conductor.meta(0, 0x51, struct.pack(">I", TEMPO_US)[1:])
conductor.meta(0, 0x58, bytes([4, 2, 24, 8]))
for i, label in enumerate([b"A engine", b"B drums", b"C arp", b"D lead", b"E peak", b"F strip"]):
    conductor.meta(i * 8 * BAR, 0x06, label)

# ---- bass engine: original two-bar ostinato ---------------------------------
# (start-16th, pitch, len-16ths) over two bars; B-natural stamps the Dorian.
OSTINATO = [
    (0, D2, 2), (3, D2, 1), (4, D3, 2), (6, D2, 1), (8, F2, 2), (11, D2, 1),
    (12, G2, 2), (14, A2, 2),
    (16, D2, 2), (19, D2, 1), (20, C3, 2), (22, B2, 2), (24, A2, 2),
    (27, G2, 1), (28, F2, 2), (30, E2, 2),
]
BASS_VEL = [78, 86, 92, 98, 108, 90]
bass = Track("Bass engine (synth bass)", channel=0, program=38)
for bar in range(0, BARS, 2):
    vel = BASS_VEL[section(bar)]
    accent = bar % 8 == 6  # every phrase-end, punch the octave
    for start, pitch, length in OSTINATO:
        tick = bar * BAR + start * SIXTEENTH
        if accent and start >= 28:
            pitch = D3
        bass.note(tick, pitch, length * SIXTEENTH - 10, vel + (6 if start == 0 else 0))

# ---- drums ------------------------------------------------------------------
KICK, SNARE, CH_HAT, OP_HAT = 36, 38, 42, 46
drums = Track("Drums (909-style)", channel=9)
for bar in range(BARS):
    sec = section(bar)
    base = bar * BAR
    if sec == 0:
        beats = [0, 2]
    elif sec == 5:
        beats = [0, 2] if bar < 44 else [0] if bar < 46 else []
    else:
        beats = [0, 1, 2, 3]
    for beat in beats:
        drums.note(base + beat * PPQ, KICK, 60, 104)
    if 1 <= sec <= 4:
        for eighth in range(8):
            drums.note(base + eighth * (PPQ // 2), CH_HAT, 40, 52 + 8 * (eighth % 2))
        if sec >= 2:
            for beat in (1, 3):
                drums.note(base + beat * PPQ, SNARE, 60, 78)
        if sec >= 3:
            for beat in (1, 3):
                drums.note(base + beat * PPQ + PPQ // 2, OP_HAT, 50, 58)
    if sec == 5 and bar < 44:
        for eighth in range(8):
            drums.note(base + eighth * (PPQ // 2), CH_HAT, 40, max(20, 48 - (bar - 40) * 8))

# ---- arpeggio: i -> IV engine (Dm7 / G9), one bar each ----------------------
D4, F4, A4, C5, E5 = 62, 65, 69, 72, 76
G4, B4, D5, F5, A5 = 67, 71, 74, 77, 81
ARP_ODD = [D4, F4, A4, C5, E5, C5, A4, F4]
ARP_EVEN = [G4, B4, D5, F5, A5, F5, D5, B4]
ARP_VEL = {2: 72, 3: 80, 4: 92, 5: 64}
arp = Track("Arpeggio 16ths (saw lead)", channel=1, program=81)
arp_hi = Track("Arp octave double (peak only)", channel=4, program=82)
for bar in range(16, 44):
    sec = section(bar)
    pattern = ARP_ODD if bar % 2 == 0 else ARP_EVEN
    vel = ARP_VEL[sec]
    for i in range(16):
        tick = bar * BAR + i * SIXTEENTH
        arp.note(tick, pattern[i % 8], SIXTEENTH - 15, vel + (5 if i % 4 == 0 else 0))
        if sec == 4:
            arp_hi.note(tick, pattern[i % 8] + 12, SIXTEENTH - 15, 68)

# ---- lead: original eight-bar phrase, sections D and E ----------------------
H, Q = PPQ * 2, PPQ  # half, quarter
PHRASE = [  # (bar-offset, beat, pitch, length)
    (0, 0, A4, H + Q), (0, 3, G4, Q),
    (1, 0, B4, H), (1, 2, A4, H),
    (2, 0, C5, H + Q), (2, 3, D5, Q),
    (3, 0, A4, PPQ * 4),
    (4, 0, F4, H), (4, 2, G4, H),
    (5, 0, A4, H), (5, 2, B4, H),
    (6, 0, C5, H), (6, 2, B4, Q), (6, 3, G4, Q),
    (7, 0, A4, PPQ * 4),
]
lead = Track("Lead melody", channel=2, program=87)
for pass_start, vel in ((24, 84), (32, 96)):
    for bar_off, beat, pitch, length in PHRASE:
        lead.note((pass_start + bar_off) * BAR + beat * PPQ, pitch, length - 30, vel)

# ---- pads: peak section only ------------------------------------------------
pad = Track("Warm pad (peak)", channel=3, program=89)
for bar in range(32, 40):
    chord = (50, 53, 57, 60) if bar % 2 == 0 else (43, 47, 50, 53)  # Dm7 / G
    for pitch in chord:
        pad.note(bar * BAR, pitch, BAR - 40, 58)

# ---- write ------------------------------------------------------------------
tracks = [conductor, bass, drums, arp, lead, pad, arp_hi]
header = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), PPQ)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(header + b"".join(track.chunk() for track in tracks))
seconds = TOTAL / PPQ * TEMPO_US / 1_000_000
print(f"{OUT.name}: {len(tracks)} tracks, {BARS} bars, {seconds:.3f}s at 128 BPM")
