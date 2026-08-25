# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import csv
import json
import math
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass(frozen=True)
class ComponentMetrics:
    count: int
    dominant_share: float
    orphan_share: float


@dataclass(frozen=True)
class AuditResult:
    source: str
    family: str
    canonical_asset: str
    public_names: list[str]
    reference_path: str
    render_path: str
    source_width: int
    source_height: int
    svg_width: float
    svg_height: float
    path_count: int
    alpha_iou: float
    alpha_coverage: float
    reference_alpha_coverage: float
    components: int
    reference_components: int
    dominant_component_share: float
    reference_dominant_component_share: float
    detail_retention: float
    dark_background_contrast: float
    score: int
    flags: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-manifest", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--output-tsv", type=Path, required=True)
    parser.add_argument("--contact-sheet", type=Path, required=True)
    parser.add_argument("--contact-limit", type=int, default=120)
    parser.add_argument("--contact-min-score", type=int, default=2)
    return parser.parse_args()


def rgba(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"OpenCV could not read {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def resolve_existing(path: Path) -> Path:
    if path.is_absolute() and path.exists():
        return path
    candidates = [Path.cwd() / path]
    candidates.extend(parent / path for parent in Path.cwd().parents)
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return path


def fit_rgba(image: np.ndarray, width: int, height: int) -> np.ndarray:
    scale = min(width / image.shape[1], height / image.shape[0])
    resized = cv2.resize(
        image,
        (max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale))),
        interpolation=cv2.INTER_LANCZOS4,
    )
    resized[resized[:, :, 3] == 0, :3] = 0
    canvas = np.zeros((height, width, 4), dtype=np.uint8)
    left = (width - resized.shape[1]) // 2
    top = (height - resized.shape[0]) // 2
    canvas[top : top + resized.shape[0], left : left + resized.shape[1]] = resized
    return canvas


def alpha_subject(image: np.ndarray, threshold: int = 24) -> np.ndarray:
    points = cv2.findNonZero((image[:, :, 3] > threshold).astype(np.uint8))
    if points is None:
        return image
    x, y, width, height = cv2.boundingRect(points)
    padding = max(1, round(max(width, height) * 0.03))
    left = max(0, x - padding)
    top = max(0, y - padding)
    right = min(image.shape[1], x + width + padding)
    bottom = min(image.shape[0], y + height + padding)
    return image[top:bottom, left:right]


def reference_subject_threshold(image: np.ndarray) -> int:
    alpha = image[:, :, 3]
    visible = alpha > 8
    if not np.any(visible):
        return 24
    if (
        min(image.shape[:2]) >= 400
        and np.mean(visible) > 0.55
        and np.median(alpha[visible]) < 96
    ):
        return 245
    return 24


def component_metrics(mask: np.ndarray) -> ComponentMetrics:
    minimum_area = max(6, round(mask.size * 0.0003))
    _, _, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    areas = [int(area) for area in stats[1:, cv2.CC_STAT_AREA] if area >= minimum_area]
    visible = int(np.count_nonzero(mask))
    if not areas or not visible:
        return ComponentMetrics(0, 0.0, 0.0)
    dominant = max(areas)
    return ComponentMetrics(
        len(areas),
        dominant / visible,
        max(0, sum(areas) - dominant) / visible,
    )


def edge_pixels(image: np.ndarray, mask: np.ndarray) -> int:
    gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 54, 132)
    edges[~mask] = 0
    return int(np.count_nonzero(edges))


def dark_background_contrast(image: np.ndarray) -> float:
    alpha = image[:, :, 3].astype(np.float32) / 255.0
    visible = alpha > 0.05
    if not np.any(visible):
        return 0.0
    background = np.array([22, 16, 9], dtype=np.float32)
    composite = image[:, :, :3].astype(np.float32) * alpha[:, :, None] + background * (
        1 - alpha[:, :, None]
    )
    distance = np.linalg.norm(composite - background, axis=2)
    return float(np.percentile(distance[visible], 55))


def svg_metrics(path: Path) -> tuple[float, float, int]:
    root = ET.parse(path).getroot()
    width = float(root.attrib.get("width", "0").replace("px", ""))
    height = float(root.attrib.get("height", "0").replace("px", ""))
    path_count = sum(
        1 for element in root.iter() if element.tag.rsplit("}", 1)[-1] == "path"
    )
    return width, height, path_count


def family_for(source: str) -> str:
    parts = source.strip("/").split("/")
    return parts[1] if len(parts) > 2 else "unknown"


def audit(delivery: dict, inventory_by_asset: dict[str, dict]) -> AuditResult:
    canonical_asset = delivery["canonicalAssets"][0]
    inventory = inventory_by_asset[canonical_asset]
    reference_path = resolve_existing(Path(inventory["source_path"]))
    render_path = Path(delivery["output"])
    svg_path = Path(delivery["input"])
    reference_original = rgba(reference_path)
    candidate = rgba(render_path)
    reference = fit_rgba(
        alpha_subject(
            reference_original, reference_subject_threshold(reference_original)
        ),
        candidate.shape[1],
        candidate.shape[0],
    )
    candidate = fit_rgba(
        alpha_subject(candidate), candidate.shape[1], candidate.shape[0]
    )
    reference_mask = reference[:, :, 3] > 24
    candidate_mask = candidate[:, :, 3] > 24
    union = int(np.count_nonzero(reference_mask | candidate_mask))
    intersection = int(np.count_nonzero(reference_mask & candidate_mask))
    alpha_iou = intersection / union if union else 1.0
    reference_components = component_metrics(reference_mask)
    candidate_components = component_metrics(candidate_mask)
    reference_edges = edge_pixels(reference, reference_mask)
    candidate_edges = edge_pixels(candidate, candidate_mask)
    detail_retention = candidate_edges / reference_edges if reference_edges else 1.0
    svg_width, svg_height, path_count = svg_metrics(svg_path)
    reference_coverage = float(np.count_nonzero(reference_mask) / reference_mask.size)
    candidate_coverage = float(np.count_nonzero(candidate_mask) / candidate_mask.size)
    contrast = dark_background_contrast(candidate)

    score = 0
    flags: list[str] = []
    if alpha_iou < 0.82:
        flags.append("severe-alpha-mismatch")
        score += 4
    elif alpha_iou < 0.9:
        flags.append("alpha-mismatch")
        score += 2
    if detail_retention < 0.48:
        flags.append("severe-detail-loss")
        score += 4
    elif detail_retention < 0.68:
        flags.append("detail-loss")
        score += 2
    if (
        candidate_components.count >= reference_components.count + 3
        and candidate_components.dominant_share + 0.08
        < reference_components.dominant_share
    ):
        flags.append("trace-fragmentation")
        score += 3
    if reference_components.count >= 4 and reference_components.dominant_share < 0.56:
        flags.append("fragmented-source-at-hero-scale")
        score += 2
    if candidate_coverage < 0.16 and candidate_components.count >= 4:
        flags.append("sparse-fragmented-render")
        score += 2
    if contrast < 34:
        flags.append("low-dark-background-contrast")
        score += 2
    if max(reference_original.shape[:2]) <= 128 and max(svg_width, svg_height) <= 128:
        flags.append("small-source-enlargement-risk")
        score += 1

    return AuditResult(
        source=delivery["source"],
        family=family_for(delivery["source"]),
        canonical_asset=canonical_asset,
        public_names=delivery["publicNames"],
        reference_path=str(reference_path),
        render_path=str(render_path),
        source_width=reference_original.shape[1],
        source_height=reference_original.shape[0],
        svg_width=svg_width,
        svg_height=svg_height,
        path_count=path_count,
        alpha_iou=round(alpha_iou, 6),
        alpha_coverage=round(candidate_coverage, 6),
        reference_alpha_coverage=round(reference_coverage, 6),
        components=candidate_components.count,
        reference_components=reference_components.count,
        dominant_component_share=round(candidate_components.dominant_share, 6),
        reference_dominant_component_share=round(
            reference_components.dominant_share, 6
        ),
        detail_retention=round(detail_retention, 6),
        dark_background_contrast=round(contrast, 4),
        score=score,
        flags=flags,
    )


def composite(
    background: np.ndarray, foreground: np.ndarray, left: int, top: int
) -> None:
    alpha = foreground[:, :, 3:4].astype(np.float32) / 255.0
    target = background[
        top : top + foreground.shape[0], left : left + foreground.shape[1]
    ]
    target[:, :, :3] = np.rint(
        foreground[:, :, :3] * alpha + target[:, :, :3] * (1 - alpha)
    ).astype(np.uint8)


def contact_sheet(results: list[AuditResult], output: Path, limit: int) -> None:
    selected = sorted(
        results, key=lambda result: (-result.score, result.family, result.source)
    )[:limit]
    columns = 6
    tile_width, tile_height = 244, 260
    rows = max(1, math.ceil(len(selected) / columns))
    sheet = np.full(
        (rows * tile_height, columns * tile_width, 3), (22, 16, 9), dtype=np.uint8
    )
    for index, result in enumerate(selected):
        art = rgba(Path(result.render_path))
        art = fit_rgba(art, 184, 184)
        column = index % columns
        row = index // columns
        left = column * tile_width
        top = row * tile_height
        composite(sheet, art, left + 30, top + 4)
        label = (
            result.public_names[0] if result.public_names else Path(result.source).stem
        )[:28]
        cv2.putText(
            sheet,
            label,
            (left + 10, top + 210),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.46,
            (236, 239, 232),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            sheet,
            f"{result.family} | score {result.score}",
            (left + 10, top + 232),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.39,
            (108, 223, 207),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            sheet,
            ", ".join(result.flags[:2])[:34],
            (left + 10, top + 250),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.32,
            (156, 165, 177),
            1,
            cv2.LINE_AA,
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), sheet):
        raise RuntimeError(f"Could not write {output}")


def main() -> None:
    args = parse_args()
    print(f"OpenCV {cv2.__version__}")
    render_manifest = json.loads(args.render_manifest.read_text(encoding="utf-8"))
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    inventory_by_asset = {
        asset["canonical_asset"]: asset for asset in inventory["assets"]
    }
    results = [
        audit(delivery, inventory_by_asset) for delivery in render_manifest["rendered"]
    ]
    results.sort(key=lambda result: (result.family, result.source))

    payload = {
        "schema": 1,
        "opencv_version": cv2.__version__,
        "audited": len(results),
        "flagged": sum(result.score >= 2 for result in results),
        "families": dict(sorted(Counter(result.family for result in results).items())),
        "flags": dict(
            sorted(Counter(flag for result in results for flag in result.flags).items())
        ),
        "results": [asdict(result) for result in results],
    }
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    args.output_tsv.parent.mkdir(parents=True, exist_ok=True)
    with args.output_tsv.open("w", encoding="utf-8", newline="") as stream:
        fieldnames = list(AuditResult.__dataclass_fields__)
        writer = csv.DictWriter(
            stream, fieldnames=fieldnames, delimiter="\t", lineterminator="\n"
        )
        writer.writeheader()
        for result in results:
            row = asdict(result)
            row["public_names"] = json.dumps(row["public_names"], ensure_ascii=False)
            row["flags"] = json.dumps(row["flags"])
            writer.writerow(row)

    contact_sheet(
        [result for result in results if result.score >= args.contact_min_score],
        args.contact_sheet,
        args.contact_limit,
    )
    print(
        json.dumps(
            {key: payload[key] for key in ("audited", "flagged", "families", "flags")},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
