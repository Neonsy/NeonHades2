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
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def rgba(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise SystemExit(f"OpenCV could not read {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def main() -> None:
    args = parse_args()
    reference = rgba(args.reference)
    candidate = rgba(args.candidate)
    if candidate.shape[:2] != reference.shape[:2]:
        candidate = cv2.resize(candidate, (reference.shape[1], reference.shape[0]), interpolation=cv2.INTER_LANCZOS4)

    reference_mask = reference[:, :, 3] > 8
    candidate_mask = candidate[:, :, 3] > 8
    union = np.count_nonzero(reference_mask | candidate_mask)
    intersection = np.count_nonzero(reference_mask & candidate_mask)
    alpha_iou = float(intersection / union) if union else 1.0

    shared = reference_mask & candidate_mask
    if np.any(shared):
        color_delta = cv2.cvtColor(reference[:, :, :3], cv2.COLOR_BGR2LAB).astype(np.float32) - cv2.cvtColor(
            candidate[:, :, :3], cv2.COLOR_BGR2LAB
        ).astype(np.float32)
        mean_lab_delta = float(np.linalg.norm(color_delta[shared], axis=1).mean())
        changed_visible_pixels = float(
            np.count_nonzero(np.max(np.abs(reference[:, :, :3].astype(np.int16) - candidate[:, :, :3].astype(np.int16)), axis=2)[shared] > 8)
            / np.count_nonzero(shared)
        )
        exact_visible_pixels = float(
            np.count_nonzero(np.all(reference[:, :, :3][shared] == candidate[:, :, :3][shared], axis=1))
            / np.count_nonzero(shared)
        )
    else:
        mean_lab_delta = 0.0
        changed_visible_pixels = 0.0
        exact_visible_pixels = 0.0

    report = {
        "opencv_version": cv2.__version__,
        "reference": str(args.reference),
        "candidate": str(args.candidate),
        "width": reference.shape[1],
        "height": reference.shape[0],
        "alpha_iou": round(alpha_iou, 6),
        "mean_lab_delta": round(mean_lab_delta, 4),
        "changed_visible_pixels": round(changed_visible_pixels, 6),
        "exact_visible_pixels": round(exact_visible_pixels, 6),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
