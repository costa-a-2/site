"""
The Weekly Rank — Open Graph images (1200×630)

    cd site && python3 scripts/og_images.py

Writes src/assets/img/og/:
  <hero>.jpg     every article hero in src/assets/img/ cropped to 1200×630 (center crop, q85)
  default.png    the card for the home page and the rankings pages: the wordmark
                 "The Weekly Rank™" in Cinzel 900 on paper, a thin rule, the tagline under it.

Fonts: scripts/fonts/Cinzel[wght].ttf (SIL Open Font License, from google/fonts). The ™ comes from
Georgia when Cinzel has no glyph for it. Needs Pillow.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "src" / "assets" / "img"
OUT = IMG / "og"
FONT = ROOT / "scripts" / "fonts" / "Cinzel[wght].ttf"
W, H = 1200, 630
PAPER, INK, MUTED = "#f2efe6", "#15130f", "#6b6355"
SKIP = {"costa.jpg", "logo.png"}                       # not heroes
TAGLINE = "Rest-of-season rankings, with the movement shown"


def crop_hero(src: Path, dst: Path):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w / h > W / H:                                   # too wide: trim the sides
        nw = round(h * W / H); x0 = (w - nw) // 2; box = (x0, 0, x0 + nw, h)
    else:                                               # too tall: trim top and bottom
        nh = round(w * H / W); y0 = (h - nh) // 2; box = (0, y0, w, y0 + nh)
    im.crop(box).resize((W, H), Image.LANCZOS).save(dst, "JPEG", quality=85, optimize=True, progressive=True)
    print(f"  {dst.relative_to(ROOT)}  ←  {src.name} {w}×{h}")


def cinzel(size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        try: f.set_variation_by_name("Black" if weight >= 900 else "Regular")
        except Exception: pass
    return f


def has_glyph(font: ImageFont.FreeTypeFont, ch: str) -> bool:
    """Cinzel draws a missing glyph as the .notdef box; compare against a box-free mask."""
    try:
        return font.getmask(ch).getbbox() is not None and font.getlength(ch) != font.getlength("￿")
    except Exception:
        return False


def draw_spaced(d: ImageDraw.ImageDraw, xy, text, font, fill, spacing):
    """Letter-spaced text (Pillow has no tracking); returns the drawn width."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + spacing
    return x - spacing - xy[0]


def spaced_width(text, font, spacing):
    return sum(font.getlength(ch) for ch in text) + spacing * (len(text) - 1)


def default_card(dst: Path):
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    # the wordmark: Cinzel 900, letter-spacing .04em like .nameplate .name
    word = "The Weekly Rank"
    wf = cinzel(104, 900); ws = round(104 * 0.04)
    ww = spaced_width(word, wf, ws)
    tm_font = cinzel(26, 400) if has_glyph(cinzel(26, 400), "™") else ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", 26)
    tm_w = tm_font.getlength("™") + 6
    x0 = (W - (ww + tm_w)) / 2
    top = 232
    draw_spaced(d, (x0, top), word, wf, INK, ws)
    d.text((x0 + ww + 6, top + 4), "™", font=tm_font, fill=MUTED)       # superscript, muted, like .tm
    # a thin rule under it
    ry = top + 104 + 34
    d.line([(W // 2 - 300, ry), (W // 2 + 300, ry)], fill=INK, width=2)
    # the tagline: Cinzel 400, uppercase, tracked wide, muted — the .tag treatment
    tf = cinzel(22, 400); tag = TAGLINE.upper(); ts = 6
    tw = spaced_width(tag, tf, ts)
    draw_spaced(d, ((W - tw) / 2, ry + 30), tag, tf, MUTED, ts)
    im.save(dst, "PNG", optimize=True)
    print(f"  {dst.relative_to(ROOT)}  (default card)")


def main():
    if not FONT.exists():
        raise SystemExit(f"Missing {FONT} — download Cinzel[wght].ttf from google/fonts (OFL) into scripts/fonts/")
    OUT.mkdir(parents=True, exist_ok=True)
    heroes = sorted(p for p in IMG.iterdir() if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg", ".png") and p.name not in SKIP)
    for src in heroes:
        crop_hero(src, OUT / (src.stem + ".jpg"))
    default_card(OUT / "default.png")
    print(f"  {len(heroes)} hero crops + default card → {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
