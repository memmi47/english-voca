"""Chiptune music and sound effects for the postal game, written as note data (not audio files).
Run: python3 -I tools/build_postal_music.py

Output
  cards/assets/postal/music/<id>.json   note data played by cards/js/chip.js (Web Audio: pulse 12.5/25/50 %, triangle, noise)
  cards/assets/postal/sfx.json          short effects (pitch slides, noise bursts)
  assets/post-office/v2/midi/<id>.mid   the same notes as a Standard MIDI File, for editing in any DAW

Why data instead of audio: loops have no gap (a rendered AAC adds a short silence), the files are a few KB, tempo and
volume can change at run time, and the music can be ducked under the word voice. Compositions are original.
Authoring format: bars of "NOTE:beats" tokens, e.g. "E5:1 G5:.5 R:.5" (R = rest, C4 = MIDI 60).
"""
from pathlib import Path
import json, re, struct
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'cards/assets/postal'
MID = ROOT / 'assets/post-office/v2/midi'
(OUT / 'music').mkdir(parents=True, exist_ok=True); MID.mkdir(parents=True, exist_ok=True)

PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(name):
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name); assert m, name
    return 12 * (int(m.group(3)) + 1) + PC[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]

def parse(bars):
    """list of bar strings -> [(beat, dur, midi)] ; every bar must add up to 4 beats."""
    out = []; t = 0.0
    for i, bar in enumerate(bars):
        total = 0.0
        for tok in bar.split():
            n, d = tok.split(':'); d = float(d)
            if n != 'R': out.append((t + total, d, midi(n)))
            total += d
        assert abs(total - 4) < 1e-9, f'bar {i + 1} adds up to {total}: {bar}'
        t += 4
    return out

TRIAD = {'': (0, 4, 7), 'm': (0, 3, 7)}
def chord(name, octave):
    m = re.fullmatch(r'([A-G][#b]?)(m?)', name); root = midi(m.group(1) + str(octave)); return [root + i for i in TRIAD[m.group(2)]]

def bass(chords, style):
    out = []
    for i, c in enumerate(chords):
        r, _, f = chord(c, 2); b = i * 4
        if r < 38: r += 12; f += 12                       # keep the bass above E2 so the triangle stays audible
        if style == 'walk':   out += [(b, .9, r), (b + 1, .9, f), (b + 2, .9, r), (b + 3, .9, f)]
        elif style == 'pulse': out += [(b + k * .5, .4, r + (12 if k % 2 else 0)) for k in range(8)]
        elif style == 'half':  out += [(b, 1.9, r), (b + 2, 1.9, f)]
        elif style == 'drive': out += [(b + k * .5, .45, r) for k in range(8)]
    return out

def arp(chords, style):
    out = []
    for i, c in enumerate(chords):
        a, t, f = chord(c, 4); b = i * 4
        seq = {'up': [a, t, f, a + 12, f, t, a, t], 'bounce': [a, f, t, f, a, f, t, a + 12], 'sparse': [a, None, f, None, t, None, f, None]}[style]
        for k, n in enumerate(seq):
            if n is not None: out.append((b + k * .5, .35, n))
    return out

def drums(pattern, bars):
    """16 steps per bar: k kick, s snare, h hat, . nothing. Noise channel note value: 0 kick, 1 snare, 2 hat."""
    out = []
    for bar in range(bars):
        for i, ch in enumerate(pattern):
            if ch in 'ksh': out.append((bar * 4 + i * .25, .12, {'k': 0, 's': 1, 'h': 2}[ch]))
    return out

def shift(notes, beats): return [(t + beats, d, n) for t, d, n in notes]
def up(notes, semis, cap=88): return [(t, d, n + semis if n + semis <= cap else n) for t, d, n in notes]

TRACKS = {}
def track(id, title, bpm, A, B, chordsA, chordsB, bass_style, arp_style, drum_pat, lead_wave='p25', var=12, lead_gain=.26, arp_gain=.12, bass_gain=.34, drum_gain=.14, echo=False):
    melA, melB = parse(A), parse(B)
    assert len(A) == 8 and len(B) == 8 and len(chordsA) == 8 and len(chordsB) == 8
    chords = chordsA + chordsB + chordsA
    lead = melA + shift(melB, 32) + shift(up(melA, var) if var else melA, 64)
    ch = [{'id': 'lead', 'wave': lead_wave, 'gain': lead_gain, 'env': [.004, .09, .7, .03], 'notes': lead},
          {'id': 'arp', 'wave': 'p12', 'gain': arp_gain, 'env': [.003, .06, .45, .02], 'notes': arp(chords, arp_style)},
          {'id': 'bass', 'wave': 'tri', 'gain': bass_gain, 'env': [.004, .05, .9, .03], 'notes': bass(chords, bass_style)}]
    if drum_pat: ch.append({'id': 'drums', 'wave': 'noise', 'gain': drum_gain, 'env': [.001, .05, 0, .01], 'notes': drums(drum_pat, 24)})
    if echo:                                           # a quiet delayed copy of the lead gives bell-like tracks some space
        ch.insert(1, {'id': 'echo', 'wave': 'p12', 'gain': lead_gain * .35, 'env': [.003, .12, .3, .05], 'notes': shift(lead, .75)})
    TRACKS[id] = {'id': id, 'title': title, 'bpm': bpm, 'beatsPerBar': 4, 'bars': 24, 'loop': True, 'norm': 1.0, 'channels': ch}

# ---- 1. meadow (continent 1, bright and simple) -------------------------------------------------------------
track('meadow', '새싹 들판', 112,
      ['E5:1 G5:.5 E5:.5 C5:1 E5:1', 'E5:1 C5:.5 E5:.5 A4:1 C5:1', 'F5:1 A5:.5 F5:.5 C5:1 F5:1', 'D5:1 G5:1 B4:1 D5:1',
       'E5:1 G5:.5 E5:.5 C6:1 G5:1', 'G5:1 E5:.5 G5:.5 B5:1 G5:1', 'A5:1 F5:.5 A5:.5 C6:1 A5:1', 'B5:.5 A5:.5 G5:1 F5:1 D5:1'],
      ['A5:1.5 G5:.5 F5:1 C5:1', 'B5:1.5 A5:.5 G5:1 D5:1', 'G5:1 B5:1 E6:1 B5:1', 'C6:1.5 B5:.5 A5:1 E5:1',
       'F5:.5 A5:.5 C6:1 A5:.5 F5:.5 A5:1', 'G5:.5 B5:.5 D6:1 B5:.5 G5:.5 B5:1', 'E6:1.5 D6:.5 C6:1 G5:1', 'D6:1 B5:1 G5:1 D5:1'],
      ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'], ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G'],
      'walk', 'up', 'k...h...s...h...')

# ---- 2. sea (continent 2, rolling) --------------------------------------------------------------------------
track('sea', '굽이굽이 바다', 96,
      ['B4:.5 D5:.5 G5:1 D5:.5 B4:.5 D5:1', 'B4:.5 E5:.5 G5:1 E5:.5 B4:.5 E5:1', 'C5:.5 E5:.5 G5:1 E5:.5 C5:.5 E5:1', 'D5:.5 F#5:.5 A5:1 F#5:.5 D5:.5 A4:1',
       'G5:1 B5:.5 A5:.5 G5:1 D5:1', 'F#5:1 D5:.5 F#5:.5 B5:1 F#5:1', 'E5:1 G5:.5 E5:.5 C6:1 G5:1', 'A5:.5 G5:.5 F#5:1 E5:1 D5:1'],
      ['A5:1.5 G5:.5 E5:1 C5:1', 'F#5:1.5 E5:.5 D5:1 A4:1', 'B5:1 A5:.5 G5:.5 D6:1 B5:1', 'G5:1 E5:.5 G5:.5 B5:1 G5:1',
       'C6:1 B5:.5 A5:.5 E5:1 A5:1', 'D6:1 C6:.5 A5:.5 F#5:1 A5:1', 'B5:1.5 A5:.5 G5:1 D5:1', 'A5:1 F#5:1 D5:1 A4:1'],
      ['G', 'Em', 'C', 'D', 'G', 'Bm', 'C', 'D'], ['Am', 'D', 'G', 'Em', 'Am', 'D', 'G', 'D'],
      'walk', 'bounce', 'k...h...s...h.h.', lead_wave='p50', lead_gain=.22)

# ---- 3. sky (continent 3, airy bells) -----------------------------------------------------------------------
track('sky', '별빛 하늘', 88,
      ['F#5:1 A5:1 D6:2', 'E6:1 C#6:1 A5:2', 'D6:1 B5:1 F#5:2', 'B5:1 D6:1 B5:2', 'F#5:.5 A5:.5 D6:1 F#6:1 D6:1',
       'E6:.5 C#6:.5 A5:1 C#6:1 E6:1', 'D6:.5 B5:.5 F#5:1 B5:1 D6:1', 'B5:1 A5:1 G5:1 A5:1'],
      ['G5:1 B5:1 E6:2', 'E6:1 A5:1 C#6:2', 'D6:1 F#6:1 A6:2', 'F#6:1 D6:1 B5:2', 'G5:.5 B5:.5 D6:1 G6:1 D6:1',
       'A5:.5 C#6:.5 E6:1 A6:1 E6:1', 'F#6:1 D6:1 A5:1 D6:1', 'C#6:1 E6:1 A5:2'],
      ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G'], ['Em', 'A', 'D', 'Bm', 'G', 'A', 'D', 'A'],
      'half', 'sparse', None, lead_wave='p12', var=0, lead_gain=.24, arp_gain=.10, echo=True)

# ---- 4. study (while a card is on screen: sparse, quiet, never competes with the word voice) -----------------
track('study', '카드 공부', 80,
      ['E5:2 C5:2', 'C5:2 A4:2', 'E5:2 G5:2', 'D5:2 B4:2', 'A5:2 E5:2', 'A5:2 F5:2', 'G5:2 E5:2', 'D5:3 R:1'],
      ['D5:2 F5:2', 'A5:2 F5:2', 'E5:2 G5:2', 'D5:2 B4:2', 'F5:2 A5:2', 'C6:2 A5:2', 'E5:2 C5:2', 'B4:2 G#4:2'],
      ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], ['Dm', 'F', 'C', 'G', 'Dm', 'F', 'Am', 'E'],
      'half', 'sparse', None, lead_wave='p25', var=0, lead_gain=.20, arp_gain=.08, bass_gain=.26)

# ---- 5. castle (tests: steady and a little serious, still friendly) -----------------------------------------
track('castle', '성 시험', 124,
      ['E5:.5 E5:.5 G5:.5 B5:.5 A5:.5 G5:.5 E5:1', 'E5:.5 E5:.5 G5:.5 C6:.5 B5:.5 G5:.5 E5:1', 'D5:.5 D5:.5 G5:.5 B5:.5 A5:.5 G5:.5 D5:1',
       'F#5:.5 A5:.5 D6:.5 A5:.5 F#5:.5 A5:.5 D5:1', 'B5:1 G5:.5 B5:.5 E6:1 B5:1', 'C6:1 G5:.5 C6:.5 E6:1 C6:1',
       'B5:1 D6:.5 B5:.5 G5:1 D6:1', 'A5:.5 F#5:.5 A5:.5 D6:.5 F#6:1 D6:1'],
      ['G5:1 C6:1 E6:1 C6:1', 'A5:1 D6:1 F#6:1 D6:1', 'G5:1 B5:1 E6:1 B5:1', 'F#5:1 B5:1 D6:1 B5:1',
       'E6:.5 D6:.5 C6:.5 B5:.5 C6:1 G5:1', 'F#6:.5 E6:.5 D6:.5 C#6:.5 D6:1 A5:1', 'D#6:1 F#6:1 B5:1 D#6:1', 'B5:2 F#6:1 D#6:1'],
      ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], ['C', 'D', 'Em', 'Bm', 'C', 'D', 'B', 'B'],
      'drive', 'bounce', 'k.h.s.h.k.h.s.hk', lead_wave='p25', lead_gain=.24)

# ---- 6. play (the optional play houses: bouncy) -------------------------------------------------------------
track('play', '놀이집', 138,
      ['A5:.5 A5:.5 C6:.5 A5:.5 F5:.5 A5:.5 C6:1', 'G5:.5 G5:.5 E5:.5 G5:.5 C6:.5 G5:.5 E5:1', 'F5:.5 F5:.5 A5:.5 D6:.5 C6:.5 A5:.5 F5:1',
       'D6:.5 D6:.5 C6:.5 Bb5:.5 A5:.5 F5:.5 D5:1', 'A5:.5 C6:.5 F6:1 E6:.5 C6:.5 A5:1', 'G5:.5 C6:.5 E6:1 D6:.5 C6:.5 G5:1',
       'Bb5:.5 D6:.5 F6:1 D6:.5 Bb5:.5 F5:1', 'G5:.5 A5:.5 Bb5:.5 C6:.5 D6:1 E6:1'],
      ['D6:1 A5:.5 D6:.5 F6:1 D6:1', 'D6:1 F6:.5 D6:.5 Bb5:1 D6:1', 'C6:1 A5:.5 C6:.5 F6:1 C6:1', 'E6:1 G6:.5 E6:.5 C6:1 G5:1',
       'F6:.5 E6:.5 D6:.5 C6:.5 D6:1 A5:1', 'D6:.5 C6:.5 Bb5:.5 A5:.5 Bb5:1 F5:1', 'G5:.5 C6:.5 E6:.5 G6:.5 E6:1 C6:1', 'E6:1 D6:1 C6:1 G5:1'],
      ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'], ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'C'],
      'pulse', 'bounce', 'k.hhs.h.k.hhs.hh', lead_wave='p50', lead_gain=.22)

# ---- short jingles (not looped) ----------------------------------------------------------------------------
def jingle(id, title, bpm, lead, harm=None, bass_notes=None, lead_wave='p50'):
    ch = [{'id': 'lead', 'wave': lead_wave, 'gain': .28, 'env': [.003, .08, .75, .04], 'notes': parse_free(lead)}]
    if harm: ch.append({'id': 'harm', 'wave': 'p25', 'gain': .14, 'env': [.003, .06, .6, .03], 'notes': parse_free(harm)})
    if bass_notes: ch.append({'id': 'bass', 'wave': 'tri', 'gain': .32, 'env': [.003, .05, .9, .03], 'notes': parse_free(bass_notes)})
    length = max(t + d for c in ch for t, d, _ in c['notes'])
    TRACKS[id] = {'id': id, 'title': title, 'bpm': bpm, 'beatsPerBar': 4, 'bars': length / 4, 'loop': False, 'norm': 1.0, 'channels': ch}

def parse_free(s):
    out = []; t = 0.0
    for tok in s.split():
        n, d = tok.split(':'); d = float(d)
        if n != 'R': out.append((t, d, midi(n)))
        t += d
    return out

jingle('clear', '칸 클리어', 150, 'C5:.5 E5:.5 G5:.5 C6:1.5 G5:.5 C6:2', 'E5:.5 G5:.5 C6:.5 E6:1.5 E5:.5 G6:2', 'C3:1 G3:1 C3:1 C3:2')
jingle('victory', '성 통과', 132, 'C5:.5 E5:.5 G5:.5 C6:1 R:.5 G5:.5 B5:.5 D6:.5 G6:2 R:.5 E6:.5 D6:.5 C6:.5 G5:.5 C6:3',
       'E5:.5 G5:.5 C6:.5 E6:1 R:.5 B5:.5 D6:.5 G6:.5 B6:2 R:.5 G6:.5 F6:.5 E6:.5 C6:.5 E6:3', 'C3:2 G3:2 C3:1 G3:1 C3:4')
jingle('bat', '박쥐 경고', 120, 'E5:.25 Eb5:.25 D5:.25 Db5:.25 C5:.5 R:.25 C5:.25 B4:.5 R:.25 G4:.25', None, 'C3:1 G2:1', lead_wave='p25')
jingle('item', '아이템 획득', 160, 'G5:.25 C6:.25 E6:.25 G6:.75', 'C5:.25 E5:.25 G5:.25 C6:.75')
jingle('key', '열쇠 획득', 140, 'C6:.25 E6:.25 G6:.25 C7:1', 'E5:.25 G5:.25 C6:.25 E6:1', 'C3:.5 C3:1.25')
jingle('grade', '등급 상승', 150, 'E5:.25 G5:.25 C6:.5', 'C5:.25 E5:.25 G5:.5')

# ---------- sound effects: events (time s, duration s, start MIDI, end MIDI, wave, gain) ----------
S = {}
def ev(id, *events): S[id] = [dict(zip(('t', 'd', 'a', 'b', 'w', 'g'), e)) for e in events]
ev('tap', (0, .05, 76, 76, 'p25', .5))
ev('step', (0, .04, 52, 50, 'tri', .6), (.05, .04, 55, 53, 'tri', .5))
ev('flip', (0, .06, 72, 79, 'p25', .5), (.06, .05, 79, 84, 'p25', .4))
ev('correct', (0, .07, 79, 79, 'p50', .55), (.07, .12, 86, 86, 'p50', .55))
ev('retry', (0, .09, 64, 60, 'p50', .5), (.09, .12, 60, 55, 'p50', .5))
ev('miss', (0, .16, 62, 52, 'tri', .7))
ev('hit', (0, .05, 84, 70, 'noise', .5), (0, .08, 67, 55, 'p25', .45))
ev('big-hit', (0, .10, 88, 60, 'noise', .6), (0, .12, 72, 48, 'p50', .5), (.08, .14, 55, 43, 'tri', .6))
ev('boss-down', (0, .08, 79, 79, 'p50', .5), (.08, .08, 84, 84, 'p50', .5), (.16, .08, 88, 88, 'p50', .5), (.24, .22, 91, 91, 'p50', .55), (.0, .3, 90, 40, 'noise', .35))
ev('combo', (0, .06, 84, 84, 'p12', .45), (.06, .06, 88, 88, 'p12', .45), (.12, .10, 91, 91, 'p12', .5))
ev('stamp', (0, .06, 52, 40, 'tri', .8), (.0, .05, 70, 50, 'noise', .5), (.08, .14, 79, 79, 'p50', .4))
ev('mail', (0, .05, 79, 79, 'p25', .5), (.05, .10, 84, 84, 'p25', .5))
ev('shield', (0, .10, 67, 79, 'p50', .5), (.10, .16, 79, 79, 'p50', .5))
ev('flame', (0, .22, 60, 88, 'noise', .4), (0, .22, 64, 83, 'p25', .45))
ev('lightning-end', (0, .12, 79, 79, 'p50', .5), (.12, .12, 74, 74, 'p50', .5), (.24, .22, 67, 67, 'p50', .55))
ev('gate', (0, .10, 72, 72, 'p50', .5), (.10, .10, 76, 76, 'p50', .5), (.20, .10, 79, 79, 'p50', .5), (.30, .30, 84, 84, 'p50', .55))

# ---------- write JSON ----------
def rnd(notes): return [[round(t, 3), round(d, 3), n] for t, d, n in sorted(notes)]
for id, t in TRACKS.items():
    for c in t['channels']: c['notes'] = rnd(c['notes'])
    (OUT / 'music' / f'{id}.json').write_text(json.dumps(t, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(OUT / 'sfx.json').write_text(json.dumps(S, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(OUT / 'music' / 'index.json').write_text(json.dumps({id: {'title': t['title'], 'loop': t['loop'], 'bpm': t['bpm'], 'seconds': round(t['bars'] * 4 * 60 / t['bpm'], 1)} for id, t in TRACKS.items()}, ensure_ascii=False, indent=1), encoding='utf-8')

# ---------- Standard MIDI File (format 1): tempo track + one track per channel; noise -> GM drums on channel 10 ----------
def vlq(n):
    b = [n & 127]; n >>= 7
    while n: b.insert(0, (n & 127) | 128); n >>= 7
    return bytes(b)
PROG = {'p12': 80, 'p25': 80, 'p50': 80, 'tri': 38}; DRUM = {0: 36, 1: 38, 2: 42}; TPQ = 480
def mtrk(events):
    events.sort(key=lambda e: (e[0], e[1])); data = b''; last = 0
    for t, _, msg in events: data += vlq(t - last) + msg; last = t
    data += b'\x00\xff\x2f\x00'; return b'MTrk' + struct.pack('>I', len(data)) + data
for id, t in TRACKS.items():
    tracks = [mtrk([(0, 0, b'\xff\x51\x03' + int(60_000_000 / t['bpm']).to_bytes(3, 'big')), (0, 0, b'\xff\x03' + bytes([len(id)]) + id.encode())])]
    for i, c in enumerate(t['channels']):
        ch = 9 if c['wave'] == 'noise' else min(i, 8)
        ev_ = [] if ch == 9 else [(0, 0, bytes([0xC0 | ch, PROG[c['wave']]]))]
        for beat, dur, n in c['notes']:
            note = DRUM[n] if ch == 9 else n; on = round(beat * TPQ); off = on + max(1, round(dur * TPQ))
            ev_ += [(on, 1, bytes([0x90 | ch, note, 96])), (off, 0, bytes([0x80 | ch, note, 0]))]
        tracks.append(mtrk(ev_))
    (MID / f'{id}.mid').write_bytes(b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), TPQ) + b''.join(tracks))
for id, t in TRACKS.items():
    n = sum(len(c['notes']) for c in t['channels'])
    print(f"{id:8s} {t['bpm']:3d} bpm  {t['bars'] * 4 * 60 / t['bpm']:5.1f}s  {len(t['channels'])} ch  {n} notes  {'loop' if t['loop'] else 'once'}")
print(len(S), 'sound effects')
