# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
from pathlib import Path

import cv2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def bgra(path: Path):
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise SystemExit(f"OpenCV could not read {path}")
    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    if image.shape[2] == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def main() -> None:
    args = parse_args()
    reference = bgra(args.reference)
    candidate = bgra(args.candidate)
    if candidate.shape[:2] != reference.shape[:2]:
        candidate = cv2.resize(candidate, (reference.shape[1], reference.shape[0]), interpolation=cv2.INTER_LANCZOS4)
    candidate[:, :, 3] = reference[:, :, 3]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(args.output), candidate):
        raise SystemExit(f"OpenCV could not write {args.output}")
    readback = bgra(args.output)
    if readback.shape != candidate.shape or (readback[:, :, 3] != reference[:, :, 3]).any():
        raise SystemExit("Alpha read-back verification failed")
    print(f"wrote {args.output} with {reference.shape[1]}x{reference.shape[0]} reference alpha")


if __name__ == "__main__":
    main()
