from __future__ import annotations

import math
import random
from pathlib import Path

PRESETS_DIR = Path(__file__).resolve().parent.parent / "web" / "presets"
ICONS_DIR = PRESETS_DIR / "icons"
GLYPHS_DIR = PRESETS_DIR / "glyphs"
AUDIO_DIR = PRESETS_DIR / "audio"
BACKGROUNDS_DIR = PRESETS_DIR / "backgrounds"

INK = "#0d141d"
STEEL = "#9fb6cd"
FROST = "#6f9fc8"


def icon(body: str, accent: str = STEEL) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        f'<rect width="64" height="64" rx="12" fill="{INK}"/>'
        f'<rect x="1" y="1" width="62" height="62" rx="11" fill="none" '
        f'stroke="{FROST}" stroke-opacity="0.28"/>'
        f'<g fill="none" stroke="{accent}" stroke-width="2.2" stroke-linecap="round" '
        f'stroke-linejoin="round">{body}</g></svg>'
    )


def glyph(body: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        '<g fill="none" stroke="#000000" stroke-width="3" stroke-linecap="round" '
        f'stroke-linejoin="round">{body}</g></svg>'
    )


def polygon(points: list[tuple[float, float]]) -> str:
    coordinates = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return f'<polygon points="{coordinates}"/>'


def radial(
    cx: float, cy: float, count: int, inner: float, outer: float, offset: float = 0.0
) -> str:
    parts = []
    for index in range(count):
        angle = offset + index * 2 * math.pi / count
        x1, y1 = cx + inner * math.cos(angle), cy + inner * math.sin(angle)
        x2, y2 = cx + outer * math.cos(angle), cy + outer * math.sin(angle)
        parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
    return "".join(parts)


def snowflake() -> str:
    body = [radial(32, 32, 6, 0, 24)]
    for index in range(6):
        angle = index * math.pi / 3
        for distance in (12.0, 19.0):
            bx, by = 32 + distance * math.cos(angle), 32 + distance * math.sin(angle)
            for sign in (-1, 1):
                branch = angle + sign * math.pi / 4
                ex = bx + 6 * math.cos(branch)
                ey = by + 6 * math.sin(branch)
                body.append(f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{ex:.1f}" y2="{ey:.1f}"/>')
    return "".join(body)


def vegvisir() -> str:
    body = ['<circle cx="32" cy="32" r="23"/>', '<circle cx="32" cy="32" r="5"/>']
    body.append(radial(32, 32, 8, 5, 23))
    for index in range(8):
        angle = index * math.pi / 4
        tip_x, tip_y = 32 + 19 * math.cos(angle), 32 + 19 * math.sin(angle)
        for sign in (-1, 1):
            branch = angle + sign * math.pi / 2
            ex = tip_x + 4 * math.cos(branch)
            ey = tip_y + 4 * math.sin(branch)
            body.append(f'<line x1="{tip_x:.1f}" y1="{tip_y:.1f}" x2="{ex:.1f}" y2="{ey:.1f}"/>')
    return "".join(body)


ICONS: dict[str, str] = {
    "wolf": (
        '<path d="M32 55 L19 44 L13 29 L16 11 L27 21 L37 21 L48 11 L51 29 L45 44 Z"/>'
        '<path d="M23 30 L29 33"/><path d="M41 30 L35 33"/>'
        '<path d="M27 43 L32 48 L37 43"/>'
    ),
    "raven": (
        '<path d="M39 19 C25 17 13 27 13 39 C24 44 38 39 42 29 Z"/>'
        '<path d="M39 19 L55 24 L41 28"/>'
        '<path d="M22 33 L36 29"/>'
        '<path d="M24 42 L24 53"/><path d="M33 40 L33 53"/>'
        '<path d="M20 53 L28 53"/><path d="M29 53 L37 53"/>'
    ),
    "longship": (
        '<path d="M6 38 C14 50 50 50 58 38 Z"/>'
        '<path d="M6 38 L6 23 C6 17 13 16 15 21"/>'
        '<path d="M58 38 L58 27"/>'
        '<path d="M32 38 L32 9"/>'
        '<path d="M20 13 L44 13 L44 30 L20 30 Z"/>'
        '<path d="M28 13 L28 30"/><path d="M36 13 L36 30"/>'
    ),
    "rune-stone": (
        '<path d="M19 56 L15 24 C15 11 49 11 49 24 L45 56 Z"/>'
        '<path d="M27 21 L27 46"/><path d="M27 25 L39 19"/><path d="M27 34 L39 40"/>'
    ),
    "yggdrasil": (
        '<path d="M32 56 L32 31"/>'
        '<path d="M32 56 C24 56 20 60 13 60"/><path d="M32 56 C40 56 44 60 51 60"/>'
        '<path d="M32 35 C22 33 16 25 14 14"/><path d="M32 35 C42 33 48 25 50 14"/>'
        '<path d="M32 27 C26 23 24 16 24 8"/><path d="M32 27 C38 23 40 16 40 8"/>'
        '<circle cx="32" cy="26" r="21" stroke-dasharray="4 6" stroke-opacity="0.55"/>'
    ),
    "mjolnir": (
        '<path d="M15 9 L49 9 L49 28 L15 28 Z"/>'
        '<path d="M22 16 L42 16"/>'
        '<path d="M26 28 L38 28 L36 36 L28 36 Z"/>'
        '<path d="M29 36 L35 36 L34 56 L30 56 Z"/>'
    ),
    "axe": (
        '<path d="M17 55 L47 8"/>'
        '<path d="M38 13 C53 16 55 33 40 37 L31 25 Z"/>'
        '<path d="M36 20 C44 22 45 29 39 31"/>'
    ),
    "shield": (
        '<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="6"/>' + radial(32, 32, 8, 6, 23)
    ),
    "helm": (
        '<path d="M13 46 L13 26 C13 13 51 13 51 26 L51 46"/>'
        '<path d="M32 23 L32 46"/>'
        '<path d="M17 31 L28 31"/><path d="M36 31 L47 31"/>'
        '<path d="M13 46 C22 52 42 52 51 46"/>'
    ),
    "dawn-horn": (
        '<path d="M11 20 C34 22 50 32 57 49 C44 51 23 43 13 28 Z"/>'
        '<ellipse cx="12" cy="23" rx="4.5" ry="7" transform="rotate(-24 12 23)"/>'
        '<path d="M24 28 C32 31 40 37 45 44"/>'
    ),
    "valknut": (
        polygon([(32, 6), (10, 44), (54, 44)])
        + polygon([(22, 20), (54, 20), (38, 52)])
        + polygon([(42, 20), (10, 20), (26, 52)])
    ),
    "gleipnir": (
        '<ellipse cx="18" cy="32" rx="12" ry="7" transform="rotate(-28 18 32)"/>'
        '<ellipse cx="32" cy="32" rx="12" ry="7"/>'
        '<ellipse cx="46" cy="32" rx="12" ry="7" transform="rotate(28 46 32)"/>'
    ),
    "fjord": (
        '<path d="M3 45 L19 15 L29 31 L40 11 L61 45"/>'
        '<path d="M4 50 C14 46 22 54 32 50 C42 46 50 54 60 50"/>'
        '<path d="M4 57 C14 53 22 61 32 57 C42 53 50 61 60 57"/>'
    ),
    "flame": (
        '<path d="M32 57 C18 53 13 38 24 25 C26 33 30 31 30 25 C30 15 23 13 32 5 '
        'C34 18 47 22 45 36 C44 47 42 53 32 57 Z"/>'
        '<path d="M32 57 C27 50 28 43 32 38 C36 43 37 50 32 57 Z"/>'
    ),
    "frost": snowflake(),
    "jormungandr": (
        '<path d="M32 10 A22 22 0 1 1 18 15"/>'
        '<path d="M18 15 L8 9 L20 4 Z"/>'
        '<path d="M32 21 A11 11 0 1 0 43 32"/>'
    ),
    "gungnir": (
        '<path d="M32 58 L32 22"/>'
        '<path d="M32 4 L40 20 L32 28 L24 20 Z"/>'
        '<path d="M25 27 L39 27"/><path d="M26 33 L38 33"/>'
    ),
    "vegvisir": vegvisir(),
    "bear-paw": (
        '<ellipse cx="32" cy="41" rx="14" ry="11"/>'
        '<circle cx="15" cy="26" r="4.5"/><circle cx="25" cy="19" r="4.5"/>'
        '<circle cx="39" cy="19" r="4.5"/><circle cx="49" cy="26" r="4.5"/>'
    ),
    "skull": (
        '<path d="M16 31 C16 14 48 14 48 31 L46 41 L38 45 L38 53 L26 53 L26 45 L18 41 Z"/>'
        '<circle cx="25" cy="31" r="5"/><circle cx="39" cy="31" r="5"/>'
        '<path d="M32 37 L29 43 L35 43 Z"/>'
        '<path d="M28 47 L28 53"/><path d="M32 47 L32 53"/><path d="M36 47 L36 53"/>'
    ),
    "anchor-stone": (
        '<path d="M32 14 L32 54"/><circle cx="32" cy="10" r="5"/>'
        '<path d="M20 24 L44 24"/>'
        '<path d="M14 38 C14 52 26 56 32 56 C38 56 50 52 50 38"/>'
    ),
    "torch": (
        '<path d="M32 26 C24 20 26 10 32 4 C36 12 42 14 40 24"/>'
        '<path d="M25 27 L39 27 L36 34 L28 34 Z"/>'
        '<path d="M29 34 L31 58"/><path d="M35 34 L33 58"/>'
    ),
    "sword": (
        '<path d="M32 5 L37 16 L37 42 L27 42 L27 16 Z"/>'
        '<path d="M19 44 L45 44"/>'
        '<path d="M32 44 L32 54"/>'
        '<circle cx="32" cy="57" r="3.5"/>'
    ),
    "bow": (
        '<path d="M22 8 C44 20 44 44 22 56"/>'
        '<path d="M22 8 L22 56"/>'
        '<path d="M12 32 L48 32"/>'
        '<path d="M41 27 L48 32 L41 37"/>'
    ),
    "dragon-head": (
        '<path d="M12 58 C13 44 16 32 24 24"/>'
        '<path d="M24 24 C28 12 42 8 52 14 C46 18 46 22 52 26 '
        'C44 30 42 34 46 40 C34 42 25 34 24 24 Z"/>'
        '<circle cx="35" cy="21" r="2"/>'
        '<path d="M26 15 L22 6"/><path d="M33 12 L33 3"/>'
        '<path d="M18 36 L9 32"/><path d="M15 47 L6 44"/>'
    ),
    "eagle": (
        '<circle cx="32" cy="17" r="5"/>'
        '<path d="M32 26 C24 13 12 8 3 15 C11 20 15 27 19 36 C23 31 27 29 32 31 Z"/>'
        '<path d="M32 26 C40 13 52 8 61 15 C53 20 49 27 45 36 C41 31 37 29 32 31 Z"/>'
        '<path d="M32 31 L32 46"/>'
        '<path d="M25 46 L32 59 L39 46 Z"/>'
    ),
    "whale": (
        '<path d="M6 36 C13 24 32 19 45 26 C50 29 53 33 53 37 C44 45 18 46 8 40 Z"/>'
        '<path d="M53 37 C56 33 60 30 63 29 C60 33 59 36 59 38 '
        'C59 41 61 45 63 48 C59 47 55 43 53 39"/>'
        '<path d="M17 40 C24 44 33 45 40 42"/>'
        '<circle cx="15" cy="32" r="1.8"/>'
        '<path d="M17 22 C15 17 16 13 19 11"/>'
    ),
    "pine": (
        '<path d="M32 5 L22 24 L28 24 L18 40 L26 40 L14 53 L50 53 L38 40 L46 40 L36 24 L42 24 Z"/>'
        '<path d="M32 53 L32 60"/>'
    ),
    "barrow": (
        '<path d="M2 52 C12 21 52 21 62 52"/>'
        '<path d="M0 56 L64 56"/>'
        '<path d="M26 56 L26 37 C26 30 38 30 38 37 L38 56 Z"/>'
        '<path d="M32 41 L32 52"/><path d="M32 44 L37 40"/>'
    ),
    "bifrost": (
        '<path d="M6 52 C6 25 58 25 58 52"/>'
        '<path d="M13 52 C13 32 51 32 51 52"/>'
        '<path d="M20 52 C20 39 44 39 44 52"/>'
        '<path d="M4 56 L60 56"/>'
    ),
    "urd-well": (
        '<path d="M13 13 L32 5 L51 13"/>'
        '<path d="M18 15 L18 31"/><path d="M46 15 L46 31"/>'
        '<ellipse cx="32" cy="31" rx="16" ry="6"/>'
        '<path d="M16 31 L19 52 C24 57 40 57 45 52 L48 31"/>'
        '<path d="M23 43 C27 40 31 46 35 43 C38 41 41 45 43 43"/>'
    ),
    "cauldron": (
        '<path d="M12 27 C12 46 20 53 32 53 C44 53 52 46 52 27"/>'
        '<path d="M7 27 L57 27"/>'
        '<path d="M19 52 L15 59"/><path d="M45 52 L49 59"/>'
        '<path d="M21 20 C25 12 39 12 43 20"/>'
    ),
    "mead-horn": (
        '<path d="M48 9 C33 15 20 28 13 45 C11 51 16 56 20 52 C22 50 21 46 19 47 '
        'C26 34 38 22 55 17 Z"/>'
        '<ellipse cx="52" cy="13" rx="5.5" ry="8.5" transform="rotate(36 52 13)"/>'
        '<path d="M26 32 C32 35 38 36 44 34"/>'
    ),
    "triquetra": (
        '<circle cx="32" cy="32" r="25" stroke-opacity="0.45"/>'
        '<path d="M32 36 C24 28 24 14 32 6 C40 14 40 28 32 36 Z"/>'
        '<path d="M32 36 C24 28 24 14 32 6 C40 14 40 28 32 36 Z" '
        'transform="rotate(120 32 32)"/>'
        '<path d="M32 36 C24 28 24 14 32 6 C40 14 40 28 32 36 Z" '
        'transform="rotate(240 32 32)"/>'
    ),
    "sun-cross": (
        '<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="9"/>'
        '<path d="M32 5 L32 23"/><path d="M32 41 L32 59"/>'
        '<path d="M5 32 L23 32"/><path d="M41 32 L59 32"/>'
    ),
    "triple-horn": (
        '<circle cx="32" cy="21" r="13"/>'
        '<circle cx="21" cy="41" r="13"/>'
        '<circle cx="43" cy="41" r="13"/>'
    ),
    "rune-algiz": ('<path d="M32 7 L32 57"/><path d="M32 25 L17 10"/><path d="M32 25 L47 10"/>'),
    "rune-tiwaz": ('<path d="M32 9 L32 57"/><path d="M32 9 L19 24"/><path d="M32 9 L45 24"/>'),
    "rune-fehu": ('<path d="M22 7 L22 57"/><path d="M22 17 L43 8"/><path d="M22 32 L43 23"/>'),
    "rune-uruz": '<path d="M20 57 L20 12 L44 21 L44 57"/>',
    "north-star": (
        '<path d="M32 4 C34 21 43 30 60 32 C43 34 34 43 32 60 '
        'C30 43 21 34 4 32 C21 30 30 21 32 4 Z"/>'
        '<circle cx="13" cy="13" r="2"/><circle cx="52" cy="49" r="2"/>'
    ),
    "rune-tiles": (
        '<rect x="6" y="28" width="17" height="25" rx="3" transform="rotate(-13 14 40)"/>'
        '<rect x="24" y="19" width="17" height="25" rx="3"/>'
        '<rect x="42" y="28" width="17" height="25" rx="3" transform="rotate(13 50 40)"/>'
        '<path d="M14 35 L14 47"/><path d="M14 38 L19 34"/>'
        '<path d="M32 25 L32 38"/><path d="M28 29 L36 29"/>'
        '<path d="M50 35 L50 47"/><path d="M46 41 L54 35"/>'
    ),
    "oars": (
        '<path d="M15 9 L49 53"/><path d="M49 9 L15 53"/>'
        '<ellipse cx="52" cy="57" rx="4.5" ry="7" transform="rotate(-38 52 57)"/>'
        '<ellipse cx="12" cy="57" rx="4.5" ry="7" transform="rotate(38 12 57)"/>'
    ),
    "key": (
        '<circle cx="21" cy="21" r="10"/><circle cx="21" cy="21" r="3"/>'
        '<path d="M28 28 L53 53"/>'
        '<path d="M43 43 L37 49"/><path d="M49 49 L43 55"/>'
    ),
}


def stars(count: int, seed: int, top: float, bottom: float) -> str:
    rng = random.Random(seed)
    parts = []
    for _ in range(count):
        x = rng.uniform(0, 1600)
        y = rng.uniform(top, bottom)
        radius = rng.uniform(0.8, 2.3)
        parts.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{radius:.1f}"/>')
    return "".join(parts)


def snowfall(count: int, seed: int) -> str:
    rng = random.Random(seed)
    parts = []
    for _ in range(count):
        x = rng.uniform(0, 1600)
        y = rng.uniform(0, 900)
        length = rng.uniform(6, 18)
        parts.append(
            f'<line x1="{x:.0f}" y1="{y:.0f}" '
            f'x2="{x - length * 0.35:.0f}" y2="{y + length:.0f}"/>'
        )
    return "".join(parts)


def fir(x: float, base: float, height: float) -> str:
    width = height * 0.62
    points = [
        (0.0, 0.0),
        (0.30, -0.35),
        (0.18, -0.36),
        (0.40, -0.70),
        (0.30, -0.71),
        (0.50, -1.0),
        (0.70, -0.71),
        (0.60, -0.70),
        (0.82, -0.36),
        (0.70, -0.35),
        (1.0, 0.0),
    ]
    steps = " ".join(
        f"{'M' if index == 0 else 'L'}{x + dx * width:.0f} {base + dy * height:.0f}"
        for index, (dx, dy) in enumerate(points)
    )
    return f'<path d="{steps} Z"/>'


def firs(baseline: float, height: float, spacing: float, seed: int) -> str:
    rng = random.Random(seed)
    parts = []
    position = -spacing
    while position < 1660:
        scale = rng.uniform(0.68, 1.3)
        parts.append(fir(position, baseline + rng.uniform(-16, 16), height * scale))
        position += spacing * rng.uniform(0.62, 1.3)
    return "".join(parts)


def floes(seed: int, top: float, bottom: float, count: int) -> str:
    rng = random.Random(seed)
    parts = []
    for _ in range(count):
        x = rng.uniform(-60, 1620)
        y = rng.uniform(top, bottom)
        width = rng.uniform(90, 260)
        height = width * rng.uniform(0.12, 0.22)
        parts.append(
            f'<path d="M{x:.0f} {y:.0f} L{x + width * 0.3:.0f} {y - height:.0f} '
            f"L{x + width:.0f} {y - height * 0.6:.0f} L{x + width * 0.72:.0f} {y + height:.0f} "
            f'L{x + width * 0.18:.0f} {y + height * 0.8:.0f} Z"/>'
        )
    return "".join(parts)


BACKGROUNDS: dict[str, str] = {
    "fjord-dusk": """
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0a0f16"/><stop offset="0.55" stop-color="#16222f"/>
<stop offset="1" stop-color="#22323f"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#1b2836"/><stop offset="1" stop-color="#080d13"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#sky)"/>
<circle cx="1180" cy="250" r="70" fill="#c9d8e6" opacity="0.10"/>
<path d="M0 540 L220 300 L360 470 L520 250 L700 540 Z" fill="#0c141d" opacity="0.92"/>
<path d="M420 540 L640 240 L820 430 L980 200 L1240 540 Z" fill="#101a25" opacity="0.9"/>
<path d="M900 540 L1120 320 L1300 460 L1450 300 L1600 540 Z" fill="#0b131b" opacity="0.95"/>
<rect y="540" width="1600" height="360" fill="url(#water)"/>
<g stroke="#5f7f9c" stroke-opacity="0.20" fill="none">
<path d="M0 610 C260 590 420 640 700 615 C960 592 1180 645 1600 612"/>
<path d="M0 690 C280 668 460 722 760 694 C1040 668 1260 724 1600 692"/>
<path d="M0 780 C300 756 480 812 800 782 C1100 754 1320 812 1600 780"/>
</g>
""",
    "storm-sky": """
<defs>
<linearGradient id="storm" x1="0" y1="0" x2="0.3" y2="1">
<stop offset="0" stop-color="#070a0f"/><stop offset="0.5" stop-color="#131c26"/>
<stop offset="1" stop-color="#1d2a37"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#storm)"/>
<g fill="#243444" opacity="0.55">
<ellipse cx="380" cy="250" rx="420" ry="130"/>
<ellipse cx="1080" cy="180" rx="480" ry="110"/>
<ellipse cx="760" cy="420" rx="560" ry="150"/>
</g>
<g fill="#0d151d" opacity="0.7">
<ellipse cx="200" cy="620" rx="520" ry="170"/>
<ellipse cx="1300" cy="700" rx="560" ry="190"/>
</g>
<g stroke="#8fb0cc" stroke-opacity="0.18" stroke-width="2">
<path d="M1180 120 L1120 330 L1190 320 L1110 520"/>
</g>
""",
    "runestone-field": """
<defs>
<radialGradient id="glow" cx="0.5" cy="0.35" r="0.7">
<stop offset="0" stop-color="#1d2c3b"/><stop offset="1" stop-color="#070b10"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#glow)"/>
<g fill="#0e161f" stroke="#4c657e" stroke-opacity="0.35" stroke-width="3">
<path d="M180 780 L160 470 C160 380 340 380 340 470 L320 780 Z"/>
<path d="M700 800 L676 420 C676 320 900 320 900 420 L876 800 Z"/>
<path d="M1260 770 L1244 500 C1244 420 1400 420 1400 500 L1384 770 Z"/>
</g>
<g stroke="#7fa0bd" stroke-opacity="0.30" stroke-width="4" fill="none" stroke-linecap="round">
<path d="M230 500 L230 700 M230 530 L290 495 M230 610 L290 645"/>
<path d="M760 470 L760 720 M760 470 L840 520 M840 520 L760 570"/>
<path d="M1300 540 L1300 700 M1270 560 L1330 560 M1270 640 L1330 640"/>
</g>
<rect y="760" width="1600" height="140" fill="#060a0e" opacity="0.85"/>
""",
    "northern-lights": f"""
<defs>
<linearGradient id="nl-sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#04060b"/><stop offset="0.62" stop-color="#0a1420"/>
<stop offset="1" stop-color="#12202e"/></linearGradient>
<linearGradient id="nl-ribbon" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#7fe6bc" stop-opacity="0"/>
<stop offset="0.42" stop-color="#4fc79c" stop-opacity="0.62"/>
<stop offset="1" stop-color="#3d7fae" stop-opacity="0"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#nl-sky)"/>
<g fill="#dce9f7" opacity="0.55">{stars(150, 3, 20, 560)}</g>
<g fill="url(#nl-ribbon)">
<path d="M-220 70 C120 210 460 40 780 180 C1080 310 1360 120 1820 240 L1820 470
C1360 350 1080 540 780 410 C460 270 120 440 -220 300 Z"/>
<path d="M-260 250 C120 390 420 220 700 340 C980 460 1300 290 1860 400 L1860 570
C1300 460 980 630 700 500 C420 380 120 530 -260 440 Z" opacity="0.5"/>
</g>
<path d="M0 660 L250 540 L410 620 L620 486 L820 620 L1010 520 L1220 626 L1420 540 L1600 640
L1600 900 L0 900 Z" fill="#080f18"/>
<path d="M0 700 C260 672 420 726 700 700 C980 674 1240 730 1600 698 L1600 900 L0 900 Z"
fill="#0d1826"/>
<g stroke="#7fa8c8" stroke-opacity="0.16" fill="none">
<path d="M0 780 C300 762 520 800 820 782 C1120 764 1340 802 1600 784"/>
<path d="M0 840 C320 822 540 860 860 842 C1180 824 1380 862 1600 844"/>
</g>
""",
    "winter-forest": f"""
<defs>
<linearGradient id="wf-sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#070c12"/><stop offset="0.55" stop-color="#101b26"/>
<stop offset="1" stop-color="#1a2733"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#wf-sky)"/>
<circle cx="1240" cy="196" r="86" fill="#cfe0ee" opacity="0.09"/>
<g fill="#1a2836" opacity="0.7">{firs(640, 210, 118, 4)}</g>
<rect y="560" width="1600" height="160" fill="#101b26" opacity="0.42"/>
<g fill="#101c27" opacity="0.92">{firs(770, 330, 168, 9)}</g>
<rect y="690" width="1600" height="160" fill="#0b131c" opacity="0.4"/>
<g fill="#060c12">{firs(960, 520, 236, 17)}</g>
<g stroke="#dbe8f5" stroke-opacity="0.22" stroke-width="1.6" stroke-linecap="round">
{snowfall(220, 8)}
</g>
""",
    "frozen-shore": f"""
<defs>
<linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#060a11"/><stop offset="0.6" stop-color="#132030"/>
<stop offset="1" stop-color="#24384a"/></linearGradient>
<linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#16283a"/><stop offset="1" stop-color="#060b12"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#fs-sky)"/>
<g fill="#c8dcec" opacity="0.35">{stars(90, 21, 20, 340)}</g>
<path d="M0 470 L180 392 L300 448 L470 360 L620 470 Z" fill="#0d1621" opacity="0.9"/>
<path d="M980 470 L1140 350 L1270 430 L1420 330 L1600 470 Z" fill="#0b141e" opacity="0.9"/>
<path d="M660 470 L760 300 L830 356 L900 470 Z" fill="#1b2c3c" opacity="0.85"/>
<rect y="470" width="1600" height="430" fill="url(#fs-water)"/>
<g fill="#22384c" stroke="#93b6d0" stroke-opacity="0.35" stroke-width="2">
{floes(5, 540, 880, 22)}
</g>
<g stroke="#9dc0d8" stroke-opacity="0.14" fill="none">
<path d="M0 520 C280 508 460 534 760 520 C1060 506 1300 532 1600 518"/>
<path d="M0 596 C300 584 520 610 840 594 C1160 578 1360 606 1600 592"/>
</g>
""",
    "raven-moon": """
<defs>
<radialGradient id="rm-halo" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#d9e7f4" stop-opacity="0.35"/>
<stop offset="1" stop-color="#d9e7f4" stop-opacity="0"/></radialGradient>
<linearGradient id="rm-sky" x1="0" y1="0" x2="0.2" y2="1">
<stop offset="0" stop-color="#04070c"/><stop offset="0.65" stop-color="#0c1420"/>
<stop offset="1" stop-color="#16222f"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#rm-sky)"/>
<circle cx="1120" cy="260" r="300" fill="url(#rm-halo)"/>
<circle cx="1120" cy="260" r="112" fill="#e2ecf6" opacity="0.22"/>
<circle cx="1078" cy="228" r="18" fill="#0c1420" opacity="0.18"/>
<circle cx="1150" cy="300" r="26" fill="#0c1420" opacity="0.14"/>
<g fill="none" stroke="#9fb8ce" stroke-opacity="0.5" stroke-width="7" stroke-linecap="round">
<path d="M300 306 C336 274 362 288 386 312 C408 290 438 284 470 304"/>
<path d="M596 208 C624 186 646 196 664 214 C682 198 706 192 732 208"/>
</g>
<g fill="none" stroke="#c8d9ea" stroke-opacity="0.6" stroke-width="5" stroke-linecap="round">
<path d="M842 392 C862 376 878 384 892 398 C905 386 923 382 942 392"/>
<path d="M1348 330 C1364 316 1377 322 1389 334 C1400 324 1414 320 1430 330"/>
</g>
<path d="M0 620 L210 452 L360 560 L520 400 L700 620 Z" fill="#0a121b"/>
<path d="M420 640 L640 420 L800 546 L960 386 L1220 640 Z" fill="#0d1723"/>
<path d="M1020 640 L1220 470 L1360 570 L1480 460 L1600 640 Z" fill="#080f17"/>
<rect y="620" width="1600" height="280" fill="#060a10"/>
<g stroke="#6f90ad" stroke-opacity="0.14" fill="none">
<path d="M0 700 C300 686 520 716 820 702 C1120 688 1340 718 1600 704"/>
<path d="M0 790 C340 776 560 806 900 790 C1240 774 1400 802 1600 792"/>
</g>
""",
    "longship-dawn": """
<defs>
<linearGradient id="ld-sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#05080f"/><stop offset="0.42" stop-color="#152130"/>
<stop offset="0.76" stop-color="#484a45"/><stop offset="1" stop-color="#8d7350"/></linearGradient>
<linearGradient id="ld-water" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#5a4c3a"/><stop offset="0.22" stop-color="#22303e"/>
<stop offset="1" stop-color="#060b12"/></linearGradient>
<radialGradient id="ld-glow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#e0b177" stop-opacity="0.5"/>
<stop offset="1" stop-color="#e0b177" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="520" fill="url(#ld-sky)"/>
<circle cx="880" cy="520" r="260" fill="url(#ld-glow)"/>
<circle cx="880" cy="502" r="62" fill="#e8c58f" opacity="0.55"/>
<g fill="#101a26" opacity="0.9">
<path d="M0 520 L190 424 L330 494 L470 416 L610 520 Z"/>
<path d="M1120 520 L1250 430 L1360 486 L1470 422 L1600 520 Z"/>
</g>
<rect y="520" width="1600" height="380" fill="url(#ld-water)"/>
<g fill="#060a11">
<path d="M596 512 L1004 512 L1046 574 L554 574 Z"/>
<path d="M554 574 C640 626 960 626 1046 574 C980 622 620 622 554 574 Z"/>
<path d="M554 574 L548 512 C548 486 586 480 598 500 C604 510 596 518 588 512"/>
<path d="M1046 574 L1052 506 C1052 490 1036 486 1030 496"/>
<path d="M796 512 L796 286"/>
<path d="M690 300 L906 300 L906 470 L690 470 Z"/>
</g>
<g fill="none" stroke="#1d2733" stroke-width="7">
<path d="M746 300 L746 470"/><path d="M846 300 L846 470"/>
</g>
<g fill="#0a1017" stroke="#c4a279" stroke-opacity="0.3" stroke-width="2">
<circle cx="620" cy="536" r="16"/><circle cx="668" cy="536" r="16"/>
<circle cx="716" cy="536" r="16"/><circle cx="764" cy="536" r="16"/>
<circle cx="812" cy="536" r="16"/><circle cx="860" cy="536" r="16"/>
<circle cx="908" cy="536" r="16"/><circle cx="956" cy="536" r="16"/>
</g>
<g stroke="#dcb888" stroke-opacity="0.14" fill="none" stroke-width="4">
<path d="M700 640 C780 632 960 646 1060 638"/>
<path d="M620 704 C760 694 980 710 1140 700"/>
<path d="M520 786 C720 774 1020 792 1240 780"/>
</g>
<g stroke="#8fa6bb" stroke-opacity="0.1" fill="none" stroke-width="3">
<path d="M0 660 C240 648 420 672 700 660"/>
<path d="M1000 730 C1200 720 1400 742 1600 730"/>
<path d="M0 840 C300 828 520 852 860 840"/>
</g>
""",
    "mountain-pass": f"""
<defs>
<linearGradient id="mp-sky" x1="0" y1="0" x2="0.3" y2="1">
<stop offset="0" stop-color="#080d14"/><stop offset="0.6" stop-color="#18242f"/>
<stop offset="1" stop-color="#2a3742"/></linearGradient>
<linearGradient id="mp-snow" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#33424e"/><stop offset="1" stop-color="#0b131b"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#mp-sky)"/>
<path d="M0 560 L260 250 L420 420 L540 320 L700 560 Z" fill="#111c27"/>
<path d="M0 560 L260 250 L330 330 L200 560 Z" fill="#22303c" opacity="0.8"/>
<path d="M900 560 L1080 230 L1230 400 L1360 300 L1600 560 Z" fill="#0f1922"/>
<path d="M1080 230 L1230 400 L1150 420 Z" fill="#2b3a46" opacity="0.75"/>
<path d="M620 620 L820 430 L940 560 L1080 620 Z" fill="#0a1119" opacity="0.9"/>
<rect y="560" width="1600" height="340" fill="url(#mp-snow)"/>
<g stroke="#8fabc4" stroke-opacity="0.2" fill="none" stroke-width="3">
<path d="M0 640 C300 616 520 664 840 640 C1160 616 1360 662 1600 638"/>
<path d="M0 740 C340 716 560 764 900 740 C1240 716 1420 758 1600 736"/>
</g>
<g stroke="#e3edf8" stroke-opacity="0.2" stroke-width="2" stroke-linecap="round">
{snowfall(260, 14)}
</g>
""",
}


def write_icons() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    for name, body in ICONS.items():
        (ICONS_DIR / f"{name}.svg").write_text(icon(body), encoding="utf-8")


def write_glyphs() -> None:
    GLYPHS_DIR.mkdir(parents=True, exist_ok=True)
    for name, body in ICONS.items():
        (GLYPHS_DIR / f"{name}.svg").write_text(glyph(body), encoding="utf-8")


def write_backgrounds() -> None:
    BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)
    for name, body in BACKGROUNDS.items():
        document = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" '
            f'width="1600" height="900" preserveAspectRatio="xMidYMid slice">{body}</svg>'
        )
        (BACKGROUNDS_DIR / f"{name}.svg").write_text(document, encoding="utf-8")


def count_audio() -> int:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    return sum(1 for path in AUDIO_DIR.iterdir() if path.is_file())


def main() -> None:
    write_icons()
    write_glyphs()
    write_backgrounds()
    print(
        f"icons: {len(ICONS)}, glyphs: {len(ICONS)}, backgrounds: {len(BACKGROUNDS)}, "
        f"audio in folder: {count_audio()}"
    )


if __name__ == "__main__":
    main()
