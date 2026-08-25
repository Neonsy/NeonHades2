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
    parser.add_argument("--render-directory", type=Path)
    parser.add_argument("--record-type", required=True)
    parser.add_argument("--asset-prefix", required=True)
    parser.add_argument(
        "--public-name",
        action="append",
        dest="public_names",
        help="Limit the sheet to one exact public name. Repeat for multiple names.",
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--columns", type=int, default=6)
    parser.add_argument("--slug-field", choices=("public-name", "href-tail", "record-id"), default="public-name")
    return parser.parse_args()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower().replace("’", "").replace("'", "")))


def delivery_slug(row: dict[str, str], slug_field: str) -> str:
    if slug_field == "record-id":
        return slugify(row["record_key"].split(":", 1)[-1])
    if slug_field == "href-tail":
        path = row["href"].split("#", 1)[0].rstrip("/")
        return slugify(path.rsplit("/", 1)[-1])
    return slugify(row["public_name"])


def fit_rgba(image: np.ndarray, width: int, height: int) -> np.ndarray:
    scale = min(width / image.shape[1], height / image.shape[0])
    resized = cv2.resize(
        image,
        (max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale))),
        interpolation=cv2.INTER_LANCZOS4,
    )
    canvas = np.zeros((height, width, 4), dtype=np.uint8)
    x = (width - resized.shape[1]) // 2
    y = (height - resized.shape[0]) // 2
    canvas[y : y + resized.shape[0], x : x + resized.shape[1]] = resized
    return canvas


def composite(background: np.ndarray, foreground: np.ndarray, left: int, top: int) -> None:
    alpha = foreground[:, :, 3:4].astype(np.float32) / 255.0
    target = background[top : top + foreground.shape[0], left : left + foreground.shape[1]]
    target[:, :, :3] = np.rint(foreground[:, :, :3] * alpha + target[:, :, :3] * (1 - alpha)).astype(np.uint8)


def main() -> None:
    args = parse_args()
    selected_names = set(args.public_names or [])
    with args.mapping.open("r", encoding="utf-8", newline="") as stream:
        rows = [
            row
            for row in csv.DictReader(stream, delimiter="\t")
            if row["record_type"] == args.record_type
            and row["map_status"] == "resolved"
            and row["game_asset"].startswith(args.asset_prefix)
            and (not selected_names or row["public_name"] in selected_names)
        ]
    rows.sort(key=lambda row: row["game_asset"])
    if not rows:
        raise SystemExit("No matching family assets")

    tile_width, tile_height = 260, 292
    art_size = 210
    columns = max(1, args.columns)
    row_count = (len(rows) + columns - 1) // columns
    sheet = np.full((row_count * tile_height, columns * tile_width, 3), (18, 20, 34), dtype=np.uint8)

    for index, row in enumerate(rows):
        if args.render_directory:
            source = args.render_directory / f"{delivery_slug(row, args.slug_field)}.png"
        else:
            relative = Path(*row["game_asset"].replace("/", "\\").split("\\")).with_suffix(".png")
            source = args.reference_root / row["package"] / "textures" / relative
        image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
        if image is None:
            raise RuntimeError(f"Could not read {source}")
        if image.shape[2] == 3:
            image = np.dstack([image, np.full(image.shape[:2], 255, dtype=np.uint8)])
        art = fit_rgba(image, art_size, art_size)
        column = index % columns
        row_index = index // columns
        left = column * tile_width
        top = row_index * tile_height
        composite(sheet, art, left + (tile_width - art_size) // 2, top + 8)
        label = row["public_name"]
        asset_id = row["game_asset"].split("_")[-1]
        cv2.putText(sheet, label[:31], (left + 16, top + 242), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (232, 236, 230), 1, cv2.LINE_AA)
        cv2.putText(sheet, asset_id, (left + 16, top + 268), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (96, 221, 204), 1, cv2.LINE_AA)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(args.output), sheet):
        raise RuntimeError(f"Could not write {args.output}")
    print(f"Wrote {len(rows)} assets to {args.output}")


if __name__ == "__main__":
    main()
