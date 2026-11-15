"""Postal assets v2 (retro layer): 16x16-grid pixel sprites authored as text, written as one SVG sheet.
Run: python3 -I tools/build_postal_assets_v2.py

Output (served by tools/serve_cards.py):
  cards/assets/postal/sprites.svg    v1 symbols (copied unchanged) + the new ones below
  cards/assets/postal/manifest.json  ids, sizes, roles, animation frame lists

New sprites are drawn on a 16x16 grid and displayed at integer scale (x3 = 48, x4 = 64), which is
what gives the NES/SNES look. Terrain tiles use CSS variables so one tile set serves every world:
  --w-ground --w-ground-d --w-ground-l --w-path --w-path-d --w-path-l --w-sky --w-sky-l
(each has a fallback colour, so a tile also works with no variables set).
"""
from pathlib import Path
import json, re
ROOT = Path(__file__).resolve().parent.parent
V1 = ROOT / 'assets/post-office/v1'
OUT = ROOT / 'cards/assets/postal'
OUT.mkdir(parents=True, exist_ok=True)

# One palette for everything. Project colours first, retro extras after. Variable colours are world-themed.
PAL = {
    'k': '#233F3A', 't': '#387D74', 'T': '#25594F', 'l': '#77B4A0', 'c': '#FFF0CA', 'w': '#FBF7EA',
    'r': '#CC6651', 'R': '#9E4A3C', 'p': '#E89AA8', 'g': '#EAB65C', 'G': '#B88636', 'y': '#F6DE9A',
    's': '#E8B78B', 'b': '#98664B', 'B': '#6E4733', 'u': '#927BAB', 'U': '#6A5683', 'v': '#B4A0C8',
    'a': '#7BC4D0', 'A': '#4F9AA8', 'e': '#BDE4DD', 'n': '#A7B7AC', 'N': '#7C9487', 'm': '#D8E0D1',
    'o': '#86B682', 'O': '#5C976E', 'j': '#AED099', 'd': '#DEC995', 'D': '#BEAA79', 'f': '#F3E0B0',
    'i': '#E8F4F8', 'I': '#C3DCE6', 'M': '#2D3A6B',
    'H': 'var(--w-ground,#86B682)', 'h': 'var(--w-ground-d,#5C976E)', 'J': 'var(--w-ground-l,#AED099)',
    'P': 'var(--w-path,#DEC995)', 'q': 'var(--w-path-d,#BEAA79)', 'Q': 'var(--w-path-l,#F3E0B0)',
    'S': 'var(--w-sky,#9FD3E8)', 'Z': 'var(--w-sky-l,#D6EEF7)',
}
SYM = {}          # id -> (size, body, role)
SIZE = 16

def check(rows, w=SIZE, h=SIZE, name=''):
    assert len(rows) == h, f'{name}: {len(rows)} rows'
    for i, r in enumerate(rows):
        assert len(r) == w, f'{name}: row {i} has {len(r)} chars: {r!r}'
        for ch in r:
            assert ch == '.' or ch in PAL, f'{name}: unknown colour {ch!r}'
    return rows

def sym(half, name=''):
    """Rows given as the left 8 columns; the right half is the mirror image."""
    return check([r + r[::-1] for r in half], name=name)

def blit(rows, glyph, x, y):
    rows = [list(r) for r in rows]
    for dy, g in enumerate(glyph):
        for dx, ch in enumerate(g):
            if ch != '.': rows[y + dy][x + dx] = ch
    return [''.join(r) for r in rows]

def blank(): return ['.' * SIZE for _ in range(SIZE)]

def to_svg(rows):
    out = []
    for y, row in enumerate(rows):
        x = 0
        while x < SIZE:
            ch = row[x]
            if ch == '.': x += 1; continue
            x2 = x
            while x2 < SIZE and row[x2] == ch: x2 += 1
            out.append(f'<rect x="{x}" y="{y}" width="{x2 - x}" height="1" fill="{PAL[ch]}"/>')
            x = x2
    return ''.join(out)

def add(id, rows, role, size=SIZE):
    SYM[id] = (size, to_svg(rows), role)

# ---------- pads for the map: a square-ish stepping stone with an icon ----------
def pad(fill, shade, border='k'):
    rows = blank(); rows = [list(r) for r in rows]
    insets = [3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3]
    for i, ins in enumerate(insets):
        y = i + 1
        for x in range(ins, SIZE - ins):
            edge = i in (0, len(insets) - 1) or x in (ins, SIZE - ins - 1)
            rows[y][x] = border if edge else fill
        if i == len(insets) - 3:                       # darker band near the bottom gives the pad some thickness
            for x in range(ins + 1, SIZE - ins - 1): rows[y][x] = shade
    return [''.join(r) for r in rows]

ENV = ["kkkkkkkkkk", "kwwwwwwwwk", "kwkwwwwkwk", "kwwkwwkwwk", "kwwwkkwwwk", "kkkkkkkkkk"]
CHECK = ["......t", ".....tt", "t...tt.", "tt.tt..", ".ttt...", "..t...."]
LOCK = ["..kkk..", ".k...k.", ".k...k.", "kkkkkkk", "kgggggk", "kggkggk", "kgggggk", "kkkkkkk"]
EXCL = ["kk", "kk", "kk", "kk", "..", "kk", "kk"]
add('stone-open', blit(pad('c', 'y'), ENV, 3, 4), 'map')
add('stone-done', blit(pad('j', 'o'), CHECK, 4, 4), 'map')
add('stone-locked', blit(pad('m', 'n'), LOCK, 4, 3), 'map')
add('stone-blocked', blit(pad('v', 'u'), EXCL, 7, 4), 'map')

# ---------- enemies and friends (2 animation frames each) ----------
add('monster-a', sym(["........", "..U.....", "..uU....", "...uUUUU", "..Uuuuuu", ".Uuuwwuu", ".Uuukwuu", ".Uuuwwuu", ".Uuuuuuu",
                      ".Uuurrrr", ".UuuuRRR", "..Uuuuuu", "..UUuuuu", "...kUU..", "..kkk...", "........"], 'monster-a'), 'enemy')
add('monster-b', sym(["........", "..U.....", "..uU....", "...uUUUU", "..Uuuuuu", ".Uuuwwuu", ".Uuukwuu", ".Uuuwwuu", ".Uuuuuuu",
                      ".Uuukkkk", ".UuuukRR", "..Uuuuuu", "..UUuuuu", "...UUk..", "...kkk..", "........"], 'monster-b'), 'enemy')
add('bat-a', sym(["........", ".....U..", "U....UU.", "UU...UuU", "UuU.UwkU", "UuuUUuuu", "UuuuUuvv", ".UuuuUvv", "..UuuuUu", "...UUuUu", "....UUUU", "......UU",
                  "........", "........", "........", "........"], 'bat-a'), 'enemy')
add('bat-b', sym(["........", ".....U..", ".....UU.", ".....UuU", "....UwkU", "UU.UUuuu", "UuUUuuvv", "UuuUUuvv", ".UuuuUuu", "..UUuuUu", "...UUUUU", "......UU",
                  "........", "........", "........", "........"], 'bat-b'), 'enemy')

# ---------- items and rewards ----------
add('mushroom', sym(["........", "....kkkk", "..kkrrrr", ".krrrrcc", "krrcrrcc", "krrcrrrr", "krrrrrrr", "kRRRRRRR", "kkkkkkkk", "....kccc", "....kccc",
                     "....kccc", "....kkcc", ".....kkk", "........", "........"], 'mushroom'), 'item')
add('fire-flower', sym(["........", "....kkkk", "..kkkrrr", ".krrrrgg", ".krrggyy", ".krgyyky", ".krggyyy", ".kkrrggg", "..kkkrrr", "......kt", "...kk.kt",
                        "..kllkkt", "..kkllkt", "......kt", "....kkkk", "........"], 'fire-flower'), 'item')
add('crown', sym(["........", "........", "..k....k", "..kk..kk", ".kggk.kg", ".kggkkgg", ".kgggggg", ".kggyggr", ".kgggggg", ".kGGGGGG", ".kkkkkkk", "........",
                  "........", "........", "........", "........"], 'crown'), 'item')
add('padlock', blit(blank(), LOCK, 4, 4), 'ui')
add('check', blit(blank(), CHECK, 4, 5), 'ui')

def disc(cx, cy, r, fill, edge, shine):
    rows = [list(x) for x in blank()]
    for y in range(SIZE):
        for x in range(SIZE):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= r * r: rows[y][x] = edge if d > (r - 1) ** 2 + 0.5 else fill
    rows[cy - 2][cx - 2] = shine; rows[cy - 3][cx - 1] = shine
    return [''.join(x) for x in rows]

def medal(fill, edge, shine):
    rows = disc(8, 9, 5, fill, edge, shine)
    rows = blit(rows, ["rr..rr", "rr..rr", ".rrrr.", "..rr.."], 5, 0)
    return rows
add('medal-bronze', medal('b', 'B', 'g'), 'ui')
add('medal-silver', medal('m', 'N', 'w'), 'ui')
add('medal-gold', medal('g', 'G', 'y'), 'ui')

SPARK_A = ["...g...", "...g...", "..gyg..", "ggyyygg", "..gyg..", "...g...", "...g..."]
SPARK_B = ["g.....g", ".g...g.", "..g.g..", "...y...", "..g.g..", ".g...g.", "g.....g"]
add('sparkle-a', blit(blank(), SPARK_A, 4, 4), 'fx')
add('sparkle-b', blit(blank(), SPARK_B, 4, 4), 'fx')

# ---------- map flag (2 frames) ----------
def flag(frame):
    rows = blank()
    pole = ["k"] * 12
    rows = blit(rows, [[c] for c in pole], 3, 2) if False else rows
    rows = [list(r) for r in rows]
    for y in range(2, 14): rows[y][3] = 'k'
    for x in (2, 3, 4): rows[14][x] = 'k'
    cloth = (["rrrrrrr", "rrrrrrrrr", "rrrrrrr", "rrrrr"] if frame == 'a' else ["rrrrrr", "rrrrrrrr", "rrrrrrrr", "rrrrrr"])
    for dy, c in enumerate(cloth):
        for dx, ch in enumerate(c): rows[2 + dy][4 + dx] = ch if dy not in (3,) or dx < len(c) else ch
    return [''.join(r) for r in rows]
add('flag-a', flag('a'), 'map'); add('flag-b', flag('b'), 'map')

# ---------- terrain (variable colours; 16x16, shown at x4 = 64) ----------
def tile(base, marks):
    rows = [[base] * SIZE for _ in range(SIZE)]
    for ch, pts in marks.items():
        for x, y in pts: rows[y][x] = ch
    return [''.join(r) for r in rows]

TUFT = lambda ch, ox, oy: [(ox, oy + 2), (ox + 1, oy + 1), (ox + 1, oy + 2), (ox + 2, oy)]
add('t-grass', tile('H', {'J': TUFT('J', 3, 2) + TUFT('J', 10, 9) + [(14, 3), (2, 12)], 'h': [(8, 5), (9, 5), (9, 6), (1, 8), (2, 8), (6, 13), (7, 13), (13, 14), (14, 14)]}), 'terrain')
add('t-sand', tile('d', {'f': [(3, 3), (4, 3), (11, 7), (12, 7), (7, 12), (8, 12), (2, 9)], 'D': [(8, 2), (9, 2), (1, 6), (14, 11), (5, 14), (6, 14), (12, 3)]}), 'terrain')
add('t-snow', tile('i', {'I': [(3, 4), (4, 4), (4, 5), (10, 9), (11, 9), (11, 10), (6, 13), (7, 13), (13, 2), (14, 2)], 'w': [(8, 3), (2, 10), (12, 13)]}), 'terrain')
add('t-path', tile('P', {'Q': [(3, 3), (4, 3), (11, 8), (12, 8), (7, 12), (8, 12), (13, 2)], 'q': [(8, 2), (9, 2), (1, 7), (2, 7), (13, 12), (5, 14), (6, 14)]}), 'terrain')
add('t-stone', tile('n', {'N': [(0, 5), (1, 5), (2, 5), (3, 6), (4, 6), (8, 12), (9, 12), (10, 13), (11, 13), (6, 2), (7, 2), (7, 3)], 'm': [(11, 3), (12, 3), (2, 10), (3, 10)]}), 'terrain')
wave_a = [(2, 3), (3, 3), (4, 3), (9, 4), (10, 4), (3, 10), (4, 10), (5, 10), (11, 11), (12, 11), (13, 11)]
wave_b = [(x + 3 if x + 3 < SIZE else x - 13, y) for x, y in wave_a]
add('t-water-a', tile('a', {'e': wave_a, 'A': [(8, 14), (9, 14), (1, 7), (2, 7), (13, 6)]}), 'terrain')
add('t-water-b', tile('a', {'e': wave_b, 'A': [(8, 14), (9, 14), (1, 7), (2, 7), (13, 6)]}), 'terrain')
CLOUD = ["....wwww........", "..wwwwwwww......", ".wwwwwwwwwww....", "wwwwwwwwwwwwww..", "IIIIIIIIIIIIII.."]
cloud = [list('S' * SIZE) for _ in range(SIZE)]
for dy, r in enumerate(CLOUD):
    for dx, ch in enumerate(r):
        if ch != '.': cloud[2 + dy][dx] = ch
for dy, r in enumerate(CLOUD):
    for dx, ch in enumerate(r):
        if ch != '.': cloud[9 + dy][(dx + 7) % SIZE] = ch
add('t-cloud', [''.join(r) for r in cloud], 'terrain')
add('t-night', tile('M', {'y': [(3, 3), (11, 6), (6, 12), (14, 13)], 'w': [(8, 2), (1, 9)], 'v': [(13, 2), (4, 7)]}), 'terrain')

# ---------- write the sheet and manifest ----------
v1 = (V1 / 'sprites.svg').read_text(encoding='utf-8')
v1_symbols = re.findall(r'<symbol id="[^"]+" viewBox="[^"]+">.*?</symbol>', v1, flags=re.S)
manifest = json.loads((V1 / 'manifest.json').read_text(encoding='utf-8'))
new_syms = ''.join(f'<symbol id="{i}" viewBox="0 0 {s} {s}">{b}</symbol>' for i, (s, b, r) in SYM.items())
(OUT / 'sprites.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><defs>' + ''.join(v1_symbols) + new_syms + '</defs></svg>', encoding='utf-8')
manifest['version'] = 'postal-v2'
manifest['gridNote'] = 'v2 symbols are 16x16 grids; show at integer scale (x3 = 48, x4 = 64). t-* terrain tiles read --w-* CSS variables.'
for i, (s, b, r) in SYM.items(): manifest['symbols'][i] = {'size': s, 'role': r, 'grid': 16}
manifest['animations'].update({
    'monster': {'idle': ['monster-a', 'monster-b']}, 'bat': {'flap': ['bat-a', 'bat-b']}, 'flag': {'wave': ['flag-a', 'flag-b']},
    'sparkle': {'twinkle': ['sparkle-a', 'sparkle-b']}, 'water': {'ripple': ['t-water-a', 't-water-b']}})
manifest['worldVars'] = ['--w-ground', '--w-ground-d', '--w-ground-l', '--w-path', '--w-path-d', '--w-path-l', '--w-sky', '--w-sky-l']
for k in ('music', 'sfx'): manifest.pop(k, None)              # v1 audio files stay in assets/post-office/v1; v2 audio is built by tools/build_postal_music.py
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'v2 sheet: {len(v1_symbols)} v1 + {len(SYM)} new symbols')
