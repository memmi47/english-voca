"""Check the default silhouettes and primary colors from the generated C-019 and C-023 (왕짐) sprites."""
from collections import Counter
from itertools import combinations
from math import dist
from pathlib import Path
from xml.etree import ElementTree

ASSETS = Path(__file__).resolve().parents[1] / "cards/assets/postal"
INK = "#233F3A"


def sprites(path):
    return {s.attrib["id"]: s for s in ElementTree.parse(path).findall(".//{*}symbol")}


def pixels(symbol):
    drawn = {}
    for rect in symbol:
        assert rect.tag.endswith("rect"), (symbol.attrib["id"], rect.tag)
        x, y, w, h = (int(rect.attrib[k]) for k in ("x", "y", "width", "height"))
        assert 0 <= x < x+w <= 48 and 0 <= y < y+h <= 48, symbol.attrib
        for row in range(y, y+h):
            for col in range(x, x+w):
                drawn[col, row] = rect.attrib["fill"].upper()
    return drawn


def mask_at_map_size(drawn):
    return {(x, y) for y in range(80) for x in range(80)
            if ((2*x+1)*48//160, (2*y+1)*48//160) in drawn}


def carry_pixels(symbol):
    # 왕짐 reach past the 48 box on purpose (the symbols show overflow); keep them near the courier.
    drawn = {}
    for rect in symbol:
        x, y, w, h = (int(rect.attrib[k]) for k in ("x", "y", "width", "height"))
        assert -16 <= x and x+w <= 72 and -16 <= y and y+h <= 48, symbol.attrib
        for col in range(x, x+w):
            drawn[col, y] = rect.attrib["fill"].upper()
    return drawn


def carry_mask_at_map_size(drawn):
    return {(x, y) for y in range(-30, 80) for x in range(-30, 125)
            if ((2*x+1)*48//160, (2*y+1)*48//160) in drawn}


def check_carries():
    sheet = sprites(ASSETS / "carry/sprites.svg")
    keys = sorted({name.split("-")[2] for name in sheet if name.startswith("c023-carry-")})
    assert len(keys) == 8, keys
    measured = []
    for key in keys:
        drawn = {}
        for part in ("back", "front"):
            base = sheet.get(f"c023-carry-{key}-{part}-0")
            if base is None:
                continue
            layer = carry_pixels(base)
            for tone in (1, 2):
                variant = carry_pixels(sheet[f"c023-carry-{key}-{part}-{tone}"])
                assert variant.keys() == layer.keys(), (key, part, tone)
            drawn.update(layer)
        assert any(carry_pixels(sheet[f"c023-carry-{key}-{part}-{tone}"]) != carry_pixels(sheet[f"c023-carry-{key}-{part}-0"])
                   for part in ("back", "front") if f"c023-carry-{key}-{part}-0" in sheet for tone in (1, 2)), key
        assert f"c023-carry-{key}-icon" in sheet, key
        colors = Counter(c for c in drawn.values() if c != INK)
        measured.append((key, carry_mask_at_map_size(drawn), oklab(colors.most_common(1)[0][0])))
    pairs = compare(measured, .12)
    shape = min(pairs, key=lambda pair: pair[0])
    color = min(pairs, key=lambda pair: pair[1])
    print(f"carry: {len(pairs)} pairs, min shape {shape[0]:.2%} ({shape[2]}, {shape[3]}), "
          f"min color {color[1]:.4f} ({color[2]}, {color[3]})")
    return len(pairs)


def oklab(hex_color):
    def linear(n):
        s = n / 255
        return s / 12.92 if s <= .04045 else ((s + .055) / 1.055)**2.4

    r, g, b = [linear(int(hex_color[i:i+2], 16)) for i in (1, 3, 5)]
    l = (.4122214708*r + .5363325363*g + .0514459929*b)**(1/3)
    m = (.2119034982*r + .6806995451*g + .1073969566*b)**(1/3)
    s = (.0883024619*r + .2817188376*g + .6299787005*b)**(1/3)
    return (.2104542553*l + .793617785*m - .0040720468*s,
            1.9779984951*l - 2.428592205*m + .4505937099*s,
            .0259040371*l + .7827717662*m - .808675766*s)


def compare(items, color_floor):
    comparisons = []
    for (a, ma, ca), (b, mb, cb) in combinations(items, 2):
        shape = 1 - len(ma & mb)/len(ma | mb)
        color = dist(ca, cb)
        comparisons.append((shape, color, a, b))
        assert shape >= .25 and color >= color_floor, comparisons[-1]
    return comparisons


def main():
    new = sprites(ASSETS / "item-tiers/sprites.svg")
    prior = sprites(ASSETS / "wardrobe/sprites.svg")
    items = {
        slot: {name: svg for name, svg in new.items() if name.startswith(f"c019-{slot}-") and name.endswith("-0")}
        for slot in ("hat", "bag", "coat")
    }
    items["ride"] = {name: svg for name, svg in prior.items() if name.startswith("c016-ride-") and name.endswith("-idle")}
    items["pet"] = {name: svg for name, svg in prior.items() if name.startswith("c016-pet-") and name.endswith("-0")}
    assert [len(group) for group in items.values()] == [7, 6, 9, 3, 3]
    c023 = sprites(ASSETS / "carry/sprites.svg")   # C-023 hats and coats: front (and a coat's back) may leave the 48 box
    expected = {f"c019-glint-{key}-{pose}" for key in ("h-plume", "b-dawn", "c-cloud", "c-star") for pose in (0, 1)}
    assert {name for name in new if name.startswith("c019-glint-")} == expected
    for name in expected:
        assert pixels(new[name]) != pixels(new[name[:-1] + str(1-int(name[-1]))]), name
    total = 0
    for slot, group in items.items():
        measured = []
        for name, sprite in group.items():
            drawn = pixels(sprite)
            colors = Counter(c for c in drawn.values() if c != INK)
            measured.append((name, mask_at_map_size(drawn), oklab(colors.most_common(1)[0][0])))
            if slot in ("hat", "bag", "coat"):
                for tone in (1, 2):
                    variant = pixels(new[f"{name[:-1]}{tone}"])
                    assert variant.keys() == drawn.keys() and variant != drawn, (name, tone)
        if slot in ("hat", "coat"):
            for name in sorted(n for n in c023 if n.startswith(f"c023-{slot}-") and n.endswith("-0") and "-back-" not in n):
                drawn = carry_pixels(c023[name])
                back = c023.get(name[:-2] + "-back-0")
                drawn = {**(carry_pixels(back) if back is not None else {}), **drawn}
                for tone in (1, 2):   # a star colour keeps the shape and changes the colour (front and back together)
                    tback = c023.get(name[:-2] + f"-back-{tone}")
                    variant = {**(carry_pixels(tback) if tback is not None else {}), **carry_pixels(c023[f"{name[:-1]}{tone}"])}
                    assert variant.keys() == drawn.keys() and variant != drawn, (name, tone)
                colors = Counter(c for c in drawn.values() if c != INK)
                measured.append((name, carry_mask_at_map_size(drawn), oklab(colors.most_common(1)[0][0])))
        pairs = compare(measured, .09 if slot in ("ride", "pet") else .12)
        total += len(pairs)
        shape = min(pairs, key=lambda pair: pair[0])
        color = min(pairs, key=lambda pair: pair[1])
        print(f"{slot}: {len(pairs)} pairs, min shape {shape[0]:.2%} ({shape[2]}, {shape[3]}), "
              f"min color {color[1]:.4f} ({color[2]}, {color[3]})")
    total += check_carries()
    print(f"{total}/{total} item pairs and {len(expected)}/8 glint frames passed")


if __name__ == "__main__":
    main()
