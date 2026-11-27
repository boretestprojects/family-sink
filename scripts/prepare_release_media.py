"""Render the static README badges and assemble the captured browser frames."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
BADGE_FONT = ImageFont.load_default(size=24)


def badge(name, left, right, accent):
    """Draw a two-part, high-resolution badge with a rounded edge."""
    height, padding = 44, 14
    split = round(BADGE_FONT.getlength(left)) + padding * 2
    width = split + round(BADGE_FONT.getlength(right)) + padding * 2
    image = Image.new("RGBA", (width, height), "#1e293b")
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((split, 0, width, height), fill=accent)
    drawing.text((padding, height / 2), left, fill="white", font=BADGE_FONT, anchor="lm")
    drawing.text((split + padding, height / 2), right, fill="white", font=BADGE_FONT, anchor="lm")
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=12, fill=255)
    image.putalpha(mask)
    image.save(ASSETS / "badges" / f"{name}.png", optimize=True)


def animation(frame_directory):
    """Encode screenshots of the live card as a short, looping GIF."""
    frame_paths = sorted(frame_directory.glob("*.png"))
    if len(frame_paths) != 40:
        raise ValueError("Expected 40 browser frames. Run capture-release.mjs --frames first.")
    frames = []
    for path in frame_paths:
        with Image.open(path) as image:
            image = image.convert("RGB")
            image.thumbnail((640, 350), Image.Resampling.LANCZOS)
            frames.append(image.quantize(colors=128))
    frames[0].save(
        ASSETS / "screenshots" / "live-brushing.gif",
        save_all=True, append_images=frames[1:], duration=85, loop=0, optimize=True,
    )


def main():
    """Refresh local marketing assets from release metadata."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frames", type=Path, help="Optional directory of captured PNG frames")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "custom_components" / "family_sink" / "manifest.json").read_text("utf-8"))
    minimum = json.loads((ROOT / "hacs.json").read_text("utf-8"))["homeassistant"]
    (ASSETS / "badges").mkdir(parents=True, exist_ok=True)
    badge("version", "Version", manifest["version"], "#1d4ed8")
    badge("home-assistant", "Home Assistant", f"{minimum.removesuffix('.0')}+", "#075985")
    badge("license", "License", "MIT", "#6b21a8")
    badge("local-first", "Local-first", "Home Assistant storage", "#047857")
    if args.frames:
        animation(args.frames)


if __name__ == "__main__":
    main()
