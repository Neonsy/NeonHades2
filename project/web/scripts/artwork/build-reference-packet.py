# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--colors", type=int, default=12)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cv2.setRNGSeed(0)
    image = cv2.imread(str(args.input), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise SystemExit(f"OpenCV could not read {args.input}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    height, width = image.shape[:2]
    channels = 1 if image.ndim == 2 else image.shape[2]
    if channels == 4:
        bgr = image[:, :, :3]
        alpha = image[:, :, 3]
    elif channels == 3:
        bgr = image
        alpha = np.full((height, width), 255, dtype=np.uint8)
    else:
        bgr = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        alpha = np.full((height, width), 255, dtype=np.uint8)

    silhouette = np.where(alpha > 8, 255, 0).astype(np.uint8)
    edges = cv2.Canny(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), 70, 160)
    edges = cv2.bitwise_and(edges, silhouette)
    value = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    value = (value // 32) * 32

    samples = bgr[silhouette > 0].reshape(-1, 3).astype(np.float32)
    if len(samples) > 100_000:
        indexes = np.linspace(0, len(samples) - 1, 100_000, dtype=np.int32)
        samples = samples[indexes]
    color_count = max(2, min(args.colors, len(samples)))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.2)
    _, labels, centers = cv2.kmeans(samples, color_count, None, criteria, 8, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=color_count)
    order = np.argsort(-counts)
    palette_bgr = centers[order].astype(np.uint8)
    palette = [f"#{color[2]:02x}{color[1]:02x}{color[0]:02x}" for color in palette_bgr]

    cv2.imwrite(str(args.output_dir / "alpha.png"), alpha)
    cv2.imwrite(str(args.output_dir / "silhouette.png"), silhouette)
    cv2.imwrite(str(args.output_dir / "edges.png"), edges)
    cv2.imwrite(str(args.output_dir / "value-map.png"), value)
    (args.output_dir / "palette.txt").write_text("\n".join(palette) + "\n", encoding="utf-8")

    component_count, _, stats, centroids = cv2.connectedComponentsWithStats((silhouette > 0).astype(np.uint8), 8)
    components = []
    for index in range(1, component_count):
        components.append(
            {
                "x": int(stats[index, cv2.CC_STAT_LEFT]),
                "y": int(stats[index, cv2.CC_STAT_TOP]),
                "width": int(stats[index, cv2.CC_STAT_WIDTH]),
                "height": int(stats[index, cv2.CC_STAT_HEIGHT]),
                "area": int(stats[index, cv2.CC_STAT_AREA]),
                "centroid": [round(float(centroids[index, 0]), 2), round(float(centroids[index, 1]), 2)],
            }
        )
    report = {
        "opencv_version": cv2.__version__,
        "input": str(args.input),
        "width": width,
        "height": height,
        "channels": channels,
        "alpha_coverage": round(float(np.count_nonzero(silhouette) / silhouette.size), 6),
        "connected_regions": sorted(components, key=lambda item: item["area"], reverse=True),
        "palette": palette,
    }
    (args.output_dir / "analysis.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
