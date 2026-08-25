# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np

STRUCTURAL_FLAGS = {
    "alpha-mismatch",
    "detail-loss",
    "severe-alpha-mismatch",
    "severe-detail-loss",
    "sparse-fragmented-render",
    "trace-fragmentation",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--source-list", type=Path, required=True)
    parser.add_argument("--vtracer", type=Path, required=True)
    parser.add_argument("--family", action="append", default=[])
    parser.add_argument("--minimum-score", type=int, default=2)
    parser.add_argument("--scale", type=int, default=4)
    parser.add_argument(
        "--alpha-mode",
        choices=("raw", "premultiply", "unpremultiply"),
        default="premultiply",
    )
    parser.add_argument("--isolate-aura", action="store_true")
    return parser.parse_args()


def resolve_existing(path: Path) -> Path:
    if path.is_absolute() and path.exists():
        return path
    candidates = [Path.cwd() / path]
    candidates.extend(parent / path for parent in Path.cwd().parents)
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    raise FileNotFoundError(path)


def load_finisher():
    path = Path(__file__).with_name("finish-flat-family-svg.py")
    spec = importlib.util.spec_from_file_location("finish_flat_family_svg", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.finish


def delivery_index(registry: dict) -> dict[str, list[dict]]:
    indexed: dict[str, list[dict]] = defaultdict(list)
    for canonical_asset, base in registry.items():
        indexed[base["source"]].append(
            {
                "canonical_asset": canonical_asset,
                "name": Path(base["source"]).stem,
                **base,
            }
        )
        for public_name, override in base.get("publicDeliveries", {}).items():
            delivery = {**base, **override}
            indexed[delivery["source"]].append(
                {"canonical_asset": canonical_asset, "name": public_name, **delivery}
            )
    return indexed


def isolate_aura(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    alpha = image[:, :, 3]
    visible = alpha > 8
    if not np.any(visible):
        return image

    # Some game selectors store a small, fully opaque item inside a canvas-wide,
    # low-alpha radial aura. Tracing that aura creates an opaque plate around the
    # item, so isolate the central opaque component before the general GrabCut
    # path. The dimensional/coverage guards keep this rule away from ordinary
    # resource sprites and detached particles.
    visible_alpha = alpha[visible]
    diffuse_selector = (
        min(height, width) >= 400
        and np.mean(visible) > 0.55
        and np.median(visible_alpha) < 96
    )
    if diffuse_selector:
        opaque = (alpha >= 245).astype(np.uint8)
        count, labels, stats, centroids = cv2.connectedComponentsWithStats(opaque, 8)
        center = np.array([width / 2, height / 2], dtype=np.float32)
        candidates: list[tuple[float, int]] = []
        for label in range(1, count):
            area = int(stats[label, cv2.CC_STAT_AREA])
            if area < 48:
                continue
            distance = float(np.linalg.norm(centroids[label] - center))
            if distance <= min(height, width) * 0.24:
                candidates.append((area - distance * 2.0, label))
        if candidates:
            selected_label = max(candidates)[1]
            selected_component = labels == selected_label
            hsv = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2HSV)
            gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 42, 118)
            material = (
                (hsv[:, :, 1] > 92)
                | (gray < 105)
                | (cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1) > 0)
            )
            foreground = (selected_component & material).astype(np.uint8)
            foreground = cv2.morphologyEx(
                foreground, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)
            )
            contours, _ = cv2.findContours(
                foreground, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            foreground = np.zeros_like(foreground)
            for contour in contours:
                if cv2.contourArea(contour) >= 12:
                    cv2.drawContours(foreground, [contour], -1, 1, thickness=cv2.FILLED)
            foreground = cv2.dilate(foreground, np.ones((5, 5), np.uint8), iterations=1)
            isolated = image.copy()
            isolated[:, :, 3] = np.where(foreground > 0, alpha, 0).astype(np.uint8)
            isolated[isolated[:, :, 3] == 0, :3] = 0
            return isolated

    hsv = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 42, 118)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1) > 0
    yy, xx = np.ogrid[:height, :width]
    central = ((xx - width / 2) / (width * 0.38)) ** 2 + (
        (yy - height / 2) / (height * 0.38)
    ) ** 2 <= 1
    strong_material = (hsv[:, :, 1] > 72) | (gray < 112) | edges
    definite_foreground = visible & central & strong_material
    if np.count_nonzero(definite_foreground) < 24:
        return image

    mask = np.full((height, width), cv2.GC_BGD, dtype=np.uint8)
    mask[visible] = cv2.GC_PR_BGD
    mask[visible & central] = cv2.GC_PR_FGD
    mask[definite_foreground] = cv2.GC_FGD
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.setRNGSeed(0)
    cv2.grabCut(
        image[:, :, :3],
        mask,
        None,
        background_model,
        foreground_model,
        5,
        cv2.GC_INIT_WITH_MASK,
    )
    foreground = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    foreground = cv2.morphologyEx(
        foreground.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)
    )
    foreground = cv2.dilate(foreground, np.ones((3, 3), np.uint8), iterations=1)
    isolated = image.copy()
    isolated[:, :, 3] = np.where(foreground > 0, alpha, 0).astype(np.uint8)
    isolated[isolated[:, :, 3] == 0, :3] = 0
    return isolated


def trim_transparent_canvas(
    image: np.ndarray, padding_ratio: float = 0.08
) -> np.ndarray:
    alpha = image[:, :, 3]
    points = cv2.findNonZero((alpha > 8).astype(np.uint8))
    if points is None:
        return image
    x, y, width, height = cv2.boundingRect(points)
    padding = max(2, round(max(width, height) * padding_ratio))
    left = max(0, x - padding)
    top = max(0, y - padding)
    right = min(image.shape[1], x + width + padding)
    bottom = min(image.shape[0], y + height + padding)
    cropped = image[top:bottom, left:right]
    side = max(cropped.shape[:2])
    canvas = np.zeros((side, side, 4), dtype=np.uint8)
    offset_x = (side - cropped.shape[1]) // 2
    offset_y = (side - cropped.shape[0]) // 2
    canvas[
        offset_y : offset_y + cropped.shape[0],
        offset_x : offset_x + cropped.shape[1],
    ] = cropped
    return canvas


def prepare(
    reference: Path,
    output: Path,
    scale: int,
    alpha_mode: str,
    should_isolate_aura: bool,
) -> None:
    image = cv2.imread(str(reference), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError(f"Expected RGBA source: {reference}")
    image = isolate_aura(image.copy()) if should_isolate_aura else image.copy()
    if should_isolate_aura:
        image = trim_transparent_canvas(image)
    alpha = image[:, :, 3]
    image[alpha == 0, :3] = 0
    fringe = (alpha > 0) & (alpha < 255)
    if alpha_mode == "premultiply":
        image[fringe, :3] = np.rint(
            image[fringe, :3].astype(np.float32) * (alpha[fringe, None] / 255.0)
        ).astype(np.uint8)
    elif alpha_mode == "unpremultiply":
        alpha_factor = np.maximum(alpha[fringe, None].astype(np.float32) / 255.0, 0.08)
        image[fringe, :3] = np.clip(
            np.rint(image[fringe, :3].astype(np.float32) / alpha_factor), 0, 255
        ).astype(np.uint8)
    if scale > 1:
        image = cv2.resize(
            image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
        )
        image[image[:, :, 3] == 0, :3] = 0
    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), image):
        raise RuntimeError(f"Could not write {output}")


def main() -> None:
    args = parse_args()
    print(f"OpenCV {cv2.__version__}")
    report = json.loads(args.report.read_text(encoding="utf-8"))
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    inventory_by_asset = {
        asset["canonical_asset"]: asset for asset in inventory["assets"]
    }
    deliveries = delivery_index(registry)
    selected_families = set(args.family)
    selected = [
        result
        for result in report["results"]
        if result["score"] >= args.minimum_score
        and STRUCTURAL_FLAGS.intersection(result["flags"])
        and (not selected_families or result["family"] in selected_families)
    ]
    selected.sort(key=lambda result: result["source"])
    finish = load_finisher()
    rebuilt_sources: list[str] = []

    for result in selected:
        source = result["source"]
        delivery_options = deliveries[source]
        delivery = next(
            (
                item
                for item in delivery_options
                if item["canonical_asset"] == result["canonical_asset"]
            ),
            delivery_options[0],
        )
        inventory_entry = inventory_by_asset[delivery["canonical_asset"]]
        reference = resolve_existing(Path(inventory_entry["source_path"]))
        relative = Path(source.removeprefix("/"))
        prepared = args.output_root / "prepared" / relative.with_suffix(".png")
        baseline = args.output_root / "baseline" / relative.with_suffix(".svg")
        finished = args.output_root / "public" / relative
        prepare(reference, prepared, args.scale, args.alpha_mode, args.isolate_aura)
        baseline.parent.mkdir(parents=True, exist_ok=True)
        command = [
            str(args.vtracer),
            str(prepared),
            str(baseline),
            "--preset",
            "poster",
            "--hierarchical",
            "cutout",
            "--mode",
            "spline",
            "--filter-speckle",
            "3",
            "--color-precision",
            "6",
            "--gradient-step",
            "8",
            "--simplify",
            "1.25",
            "--path-precision",
            "2",
            "--max-colors",
            "28",
            "--optimize",
            "2",
        ]
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            raise RuntimeError(f"VTracer failed for {source}: {completed.stderr}")
        finish(delivery["name"], baseline, prepared, finished)
        rebuilt_sources.append(source)

    args.source_list.parent.mkdir(parents=True, exist_ok=True)
    args.source_list.write_text(json.dumps(rebuilt_sources, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {"rebuilt": len(rebuilt_sources), "families": sorted(selected_families)},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
