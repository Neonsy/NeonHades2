# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from pathlib import Path

import cv2
import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--reference-root", type=Path, required=True)
    parser.add_argument("--record-type", required=True)
    parser.add_argument("--asset-prefix", required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument("--alpha-mode", choices=("raw", "premultiply", "unpremultiply"), default="premultiply")
    parser.add_argument("--slug-field", choices=("public-name", "record-id"), default="public-name")
    return parser.parse_args()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower().replace("’", "").replace("'", "")))


def source_slug(row: dict[str, str], slug_field: str) -> str:
    if slug_field == "record-id":
        return slugify(row["record_key"].split(":", 1)[-1])
    return slugify(row["public_name"])


def main() -> None:
    args = parse_args()
    with args.mapping.open("r", encoding="utf-8", newline="") as stream:
        rows = [
            row
            for row in csv.DictReader(stream, delimiter="\t")
            if row["record_type"] == args.record_type
            and row["map_status"] == "resolved"
            and row["game_asset"].startswith(args.asset_prefix)
        ]
    rows.sort(key=lambda row: row["game_asset"])
    args.output_directory.mkdir(parents=True, exist_ok=True)

    for row in rows:
        relative = Path(*row["game_asset"].replace("/", "\\").split("\\")).with_suffix(".png")
        source = args.reference_root / row["package"] / "textures" / relative
        image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
        if image is None or image.ndim != 3 or image.shape[2] != 4:
            raise RuntimeError(f"Expected RGBA source: {source}")
        alpha = image[:, :, 3]
        rgb = image[:, :, :3]
        rgb[alpha == 0] = 0
        fringe = (alpha > 0) & (alpha < 255)
        if args.alpha_mode == "premultiply":
            rgb[fringe] = np.rint(rgb[fringe].astype(np.float32) * (alpha[fringe, None] / 255.0)).astype(np.uint8)
        elif args.alpha_mode == "unpremultiply":
            alpha_factor = np.maximum(alpha[fringe, None].astype(np.float32) / 255.0, .08)
            rgb[fringe] = np.clip(np.rint(rgb[fringe].astype(np.float32) / alpha_factor), 0, 255).astype(np.uint8)
        if args.scale > 1:
            image = cv2.resize(image, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_CUBIC)
            image[image[:, :, 3] == 0, :3] = 0
        output = args.output_directory / f"{source_slug(row, args.slug_field)}.png"
        if not cv2.imwrite(str(output), image):
            raise RuntimeError(f"Could not write {output}")

    print(f"Prepared {len(rows)} alpha-cleaned family assets")


if __name__ == "__main__":
    main()
