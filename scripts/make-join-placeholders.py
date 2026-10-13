"""Generate the two placeholder QR images for /join/ (assets/join/official.png, group.png).

These are NOT scannable QR codes — they are clearly-labelled placeholders the site owner replaces
with the real codes. Each is a plausible QR-shaped mosaic (finders + timing pattern + random modules)
so the layout can be judged, with a white caption band on top saying so.
"""
import os
import random
from PIL import Image, ImageDraw, ImageFont

SIZE = 900
LINKS = 6          # quiet zone in modules
MODULES = 33       # 33x33 grid -> a realistic QR feel


FONT_DIR = r"C:\Windows\Fonts"
# Noto Sans SC covers both Latin and Simplified Chinese, so one file renders the mixed captions.
FONT_FILES = ["NotoSansSC-VF.ttf", "simhei.ttf", "msyhbd.ttc", "arialbd.ttf", "arial.ttf"]


def font(size):
    for name in FONT_FILES:
        try:
            return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
        except Exception:
            continue
    return ImageFont.load_default()


def text_w(draw, text, f):
    box = draw.textbbox((0, 0), text, font=f)
    return box[2] - box[0]


def centered(draw, y, text, f, fill, x0=0, x1=SIZE):
    w = text_w(draw, text, f)
    draw.text((x0 + (x1 - x0 - w) / 2, y), text, font=f, fill=fill)


def fitted(draw, text, max_w, start, floor=12):
    """Largest font size at which `text` fits within max_w."""
    size = start
    while size > floor:
        f = font(size)
        if text_w(draw, text, f) <= max_w:
            return f
        size -= 1
    return font(floor)


def logo(draw, x, y, m, color):
    """A 3x3 modules-ish finder pattern with the centre filled."""
    draw.rectangle([x, y, x + m * 3 - 1, y + m * 3 - 1], fill=color)
    draw.rectangle([x + m, y + m, x + m * 2 - 1, y + m * 2 - 1], fill=(255, 255, 255))


def finder(draw, x, y, m, color):
    """7x7 finder pattern: outer ring, white gap, solid 3x3 core."""
    draw.rectangle([x, y, x + m * 7 - 1, y + m * 7 - 1], fill=color)
    draw.rectangle([x + m, y + m, x + m * 6 - 1, y + m * 6 - 1], fill=(255, 255, 255))
    draw.rectangle([x + m * 2, y + m * 2, x + m * 5 - 1, y + m * 5 - 1], fill=color)


def build(seed, caption, sub):
    rnd = random.Random(seed)
    img = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
    d = ImageDraw.Draw(img)

    # White caption band at the top so the placeholder is unmistakable even as a thumbnail.
    band_h = 96
    d.rectangle([0, 0, SIZE, band_h], fill=(179, 38, 30))
    f_cap = fitted(d, caption, SIZE - 60, 40)
    centered(d, 12, caption, f_cap, (255, 255, 255))
    f_sub = fitted(d, sub, SIZE - 60, 24)
    centered(d, 60, sub, f_sub, (255, 226, 223))

    # QR mosaic area, below the band.
    top = band_h + 18
    avail = SIZE - top - 18
    m = avail / (MODULES + LINKS * 2)
    ox = (SIZE - m * MODULES) / 2
    oy = top + (avail - m * MODULES) / 2
    color = (10, 12, 20)

    # Reserve finder-pattern zones so random modules do not collide with them.
    reserved = set()

    def zone(cx, cy):
        for i in range(-1, 8):
            for j in range(-1, 8):
                reserved.add((cx - 1 + i, cy - 1 + j))

    zone(0, 0)
    zone(MODULES - 7, 0)
    zone(0, MODULES - 7)

    for r in range(MODULES):
        for c in range(MODULES):
            if (r, c) in reserved:
                continue
            # timing patterns on row/col 6
            if r == 6 or c == 6:
                if 8 <= (c if r == 6 else r) <= MODULES - 9:
                    if (c if r == 6 else r) % 2 == 0:
                        d.rectangle([ox + c * m, oy + r * m, ox + (c + 1) * m - 1, oy + (r + 1) * m - 1], fill=color)
                    continue
            # keep a clear zone in the middle for the "not a real code" mark
            if 13 <= r <= 19 and 11 <= c <= 21:
                continue
            if rnd.random() < 0.47:
                d.rectangle([ox + c * m, oy + r * m, ox + (c + 1) * m - 1, oy + (r + 1) * m - 1], fill=color)

    finder(d, ox, oy, m, color)
    finder(d, ox + (MODULES - 7) * m, oy, m, color)
    finder(d, ox, oy + (MODULES - 7) * m, m, color)

    # Centre disclaimer so nobody mistakes it for a working code.
    cx0, cy0 = ox + 10 * m, oy + 12 * m
    cx1, cy1 = ox + 23 * m, oy + 21 * m
    d.rectangle([cx0, cy0, cx1, cy1], fill=(255, 255, 255), outline=(179, 38, 30), width=4)
    pad = 14
    avail_w = (cx1 - cx0) - pad * 2
    t1, t2 = "占位 / PLACEHOLDER", "非可用二维码 · NOT SCANNABLE"
    f1 = fitted(d, t1, avail_w, 34)
    f2 = fitted(d, t2, avail_w, 20)
    h1 = d.textbbox((0, 0), t1, font=f1)[3]
    h2 = d.textbbox((0, 0), t2, font=f2)[3]
    gap = 6
    block_h = h1 + h2 + gap
    top_y = cy0 + ((cy1 - cy0) - block_h) / 2
    d.text(((cx0 + cx1 - text_w(d, t1, f1)) / 2, top_y), t1, font=f1, fill=(179, 38, 30))
    d.text(((cx0 + cx1 - text_w(d, t2, f2)) / 2, top_y + h1 + gap), t2, font=f2, fill=(179, 38, 30))

    # 2px black border so it reads as an image frame on any background.
    d.rectangle([0, 0, SIZE - 1, SIZE - 1], outline=(10, 12, 20), width=2)
    return img


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "join")
    out = os.path.abspath(out)
    os.makedirs(out, exist_ok=True)

    build(20261013, "占位：请替换为真实二维码", "公众号 Official account").save(os.path.join(out, "official.png"))
    build(770313, "占位：请替换为真实二维码", "微信群 WeChat group").save(os.path.join(out, "group.png"))
    print("wrote:", out)
