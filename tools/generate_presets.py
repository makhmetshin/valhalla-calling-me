from __future__ import annotations

import math
from pathlib import Path

PRESETS_DIR = Path(__file__).resolve().parent.parent / "web" / "presets"
ICONS_DIR = PRESETS_DIR / "icons"
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
}

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
}


def write_icons() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    for name, body in ICONS.items():
        (ICONS_DIR / f"{name}.svg").write_text(icon(body), encoding="utf-8")


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
    write_backgrounds()
    print(f"icons: {len(ICONS)}, backgrounds: {len(BACKGROUNDS)}, audio in folder: {count_audio()}")


if __name__ == "__main__":
    main()
