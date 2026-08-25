# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np


PAINTERLY_TYPES = {
    "mechanics/god",
    "world-progression/relationship",
    "world-progression/narrative-milestone",
    "world-progression/encounter-friend",
    "mechanics/familiar",
    "editorial/familiar-rating",
    "world-progression/region",
}


@dataclass(frozen=True)
class AssetMeasurement:
    canonical_asset: str
    package: str
    game_asset: str
    source_path: str
    source_exists: bool
    width: int | None
    height: int | None
    channels: int | None
    alpha_coverage: float | None
    alpha_components: int | None
    opaque_bbox: list[int] | None
    route: str
    record_count: int
    record_types: list[str]
    public_names: list[str]
    record_keys: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--reference-root", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--output-tsv", type=Path, required=True)
    return parser.parse_args()


def source_path(root: Path, package: str, game_asset: str) -> Path:
    relative = Path(*game_asset.replace("/", "\\").split("\\"))
    return root / package / "textures" / relative.with_suffix(".png")


def measure(path: Path) -> tuple[int, int, int, float, int, list[int]]:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"OpenCV could not read {path}")
    height, width = image.shape[:2]
    channels = 1 if image.ndim == 2 else image.shape[2]
    alpha = image[:, :, 3] if channels == 4 else np.full((height, width), 255, dtype=np.uint8)
    opaque = alpha > 8
    coverage = float(np.count_nonzero(opaque) / opaque.size)
    component_count, _, stats, _ = cv2.connectedComponentsWithStats(opaque.astype(np.uint8), 8)
    components = max(0, component_count - 1)
    if components:
        component_stats = stats[1:]
        left = int(component_stats[:, cv2.CC_STAT_LEFT].min())
        top = int(component_stats[:, cv2.CC_STAT_TOP].min())
        right = int((component_stats[:, cv2.CC_STAT_LEFT] + component_stats[:, cv2.CC_STAT_WIDTH]).max())
        bottom = int((component_stats[:, cv2.CC_STAT_TOP] + component_stats[:, cv2.CC_STAT_HEIGHT]).max())
        bbox = [left, top, right - left, bottom - top]
    else:
        bbox = [0, 0, 0, 0]
    return width, height, channels, coverage, components, bbox


def route_for(record_types: set[str], width: int | None, height: int | None) -> str:
    if record_types & PAINTERLY_TYPES:
        return "krita"
    if width and height and max(width, height) >= 900 and min(width, height) >= 600:
        return "krita-review"
    return "opencv-vtracer-inkscape"


def main() -> None:
    args = parse_args()
    cv2.setRNGSeed(0)
    print(f"OpenCV {cv2.__version__}")

    with args.mapping.open("r", encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream, delimiter="\t"))

    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        if row["map_status"] == "resolved":
            grouped[(row["package"], row["game_asset"])].append(row)

    assets: list[AssetMeasurement] = []
    missing: list[str] = []
    for (package, game_asset), matches in sorted(grouped.items()):
        path = source_path(args.reference_root, package, game_asset)
        record_types = {row["record_type"] for row in matches}
        if path.exists():
            width, height, channels, coverage, components, bbox = measure(path)
        else:
            width = height = channels = components = None
            coverage = None
            bbox = None
            missing.append(str(path))
        canonical_asset = f"{package}:{game_asset.replace(chr(92), '/')}"
        assets.append(
            AssetMeasurement(
                canonical_asset=canonical_asset,
                package=package,
                game_asset=game_asset,
                source_path=str(path),
                source_exists=path.exists(),
                width=width,
                height=height,
                channels=channels,
                alpha_coverage=round(coverage, 6) if coverage is not None else None,
                alpha_components=components,
                opaque_bbox=bbox,
                route=route_for(record_types, width, height),
                record_count=len(matches),
                record_types=sorted(record_types),
                public_names=sorted({row["public_name"] for row in matches}),
                record_keys=sorted(row["record_key"] for row in matches),
            )
        )

    payload = {
        "schema": 1,
        "opencv_version": cv2.__version__,
        "mapping": str(args.mapping),
        "reference_root": str(args.reference_root),
        "resolved_records": sum(asset.record_count for asset in assets),
        "canonical_assets": len(assets),
        "missing_sources": missing,
        "route_counts": dict(sorted(Counter(asset.route for asset in assets).items())),
        "assets": [asdict(asset) for asset in assets],
    }
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    with args.output_tsv.open("w", encoding="utf-8", newline="") as stream:
        fieldnames = [field.name for field in AssetMeasurement.__dataclass_fields__.values()]
        writer = csv.DictWriter(stream, fieldnames=fieldnames, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        for asset in assets:
            row = asdict(asset)
            for key in ("opaque_bbox", "record_types", "public_names", "record_keys"):
                row[key] = json.dumps(row[key], ensure_ascii=False)
            writer.writerow(row)

    if missing:
        raise SystemExit(f"{len(missing)} mapped source files are missing")

    print(json.dumps({key: payload[key] for key in ("resolved_records", "canonical_assets", "route_counts")}, indent=2))


if __name__ == "__main__":
    main()
