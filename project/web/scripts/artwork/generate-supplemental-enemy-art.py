# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy==2.5.2",
#   "opencv-python==5.0.0.93",
# ]
# ///

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np


WEB_ROOT = Path(__file__).resolve().parents[2]
LOCAL_ROOT = WEB_ROOT / ".local/reference"
MASTER_ROOT = WEB_ROOT / "art-source/raster/game-derived/characters/enemies"
PUBLIC_ROOT = WEB_ROOT / "public/art/characters/enemies"
MANIFEST_PATH = WEB_ROOT / "scripts/artwork/supplemental-enemy-art.json"


SUBJECTS: list[dict[str, Any]] = [
    {
        "recordKey": "world-progression/enemy:Eagle",
        "recordType": "world-progression/enemy",
        "publicName": "Aetos",
        "id": "aetos",
        "kind": "character",
        "tone": "night",
        "route": "opencv-raster",
        "canonicalAsset": "Portraits/Prometheus:PrometheusBird",
        "sourceFile": "art-source/raster/game-derived/story-portraits/prometheus.png",
        "sourceNote": "Aetos-only detail cropped from the extracted game portrait.",
    },
    {
        "recordKey": "world-progression/enemy:Jellyfish",
        "recordType": "world-progression/enemy",
        "publicName": "Hellifishie",
        "id": "hellifishie",
        "kind": "character",
        "tone": "night",
        "route": "opencv-raster",
        "canonicalAsset": "GR2/JellyFish_Color:ReconstructedSilhouette",
        "sourceFile": ".local/reference/game-assets/BiomeG-full/textures/atlases/JellyFish_Color.png",
        "sourceNote": "Reconstructed silhouette using the extracted game model texture.",
    },
    {
        "recordKey": "world-progression/enemy:SirenDrummer",
        "recordType": "world-progression/enemy",
        "publicName": "Roxy",
        "id": "roxy",
        "kind": "character",
        "tone": "night",
        "route": "opencv-raster",
        "canonicalAsset": "GameplayCapture:SirenDrummer",
        "sourceFile": ".local/reference/external-official-images/roxy.png",
        "sourceUrl": "https://mudae.net/uploads/8011521/Rbp-BQN~OjcEffx.png",
        "sourceNote": "Cut out from an unmodified in-game capture.",
    },
    {
        "recordKey": "world-progression/enemy:SirenKeytarist",
        "recordType": "world-progression/enemy",
        "publicName": "Jetty",
        "id": "jetty",
        "kind": "character",
        "tone": "night",
        "route": "opencv-raster",
        "canonicalAsset": "GameplayCapture:SirenKeytarist",
        "sourceFile": ".local/reference/external-official-images/jetty.png",
        "sourceUrl": "https://mudae.net/uploads/3924733/QltZMf-~dqu22Am.png",
        "sourceNote": "Cut out from an unmodified in-game capture.",
    },
]


def read_rgba(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"OpenCV could not read {path}")
    if image.shape[2] == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def trim_alpha(image: np.ndarray, margin: int = 24) -> np.ndarray:
    points = cv2.findNonZero((image[:, :, 3] > 4).astype(np.uint8))
    if points is None:
        raise RuntimeError("Generated artwork has no visible pixels")
    x, y, width, height = cv2.boundingRect(points)
    x = max(0, x - margin)
    y = max(0, y - margin)
    width = min(image.shape[1] - x, width + margin * 2)
    height = min(image.shape[0] - y, height + margin * 2)
    return image[y : y + height, x : x + width]


def aetos(source: Path) -> np.ndarray:
    image = read_rgba(source)
    height, width = image.shape[:2]
    crop = image[
        round(height * 0.079) : round(height * 0.295),
        round(width * 0.54) : round(width * 0.9),
    ].copy()
    background = np.full((*crop.shape[:2], 3), (20, 15, 12), dtype=np.uint8)
    alpha = crop[:, :, 3:4].astype(np.float32) / 255
    composite = (
        crop[:, :, :3].astype(np.float32) * alpha + background * (1 - alpha)
    ).astype(np.uint8)
    return cv2.cvtColor(composite, cv2.COLOR_BGR2BGRA)


def gameplay_cutout(source: Path) -> np.ndarray:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"OpenCV could not read {source}")
    image = image[:, 2:-2]
    height, width = image.shape[:2]
    crop_size = min(width, height)
    x = (width - crop_size) // 2
    y = max(0, round(height * 0.42) - crop_size // 2)
    y = min(y, height - crop_size)
    crop = image[y : y + crop_size, x : x + crop_size]
    crop = cv2.resize(crop, (720, 720), interpolation=cv2.INTER_LANCZOS4)
    sharpened = cv2.addWeighted(
        crop, 1.16, cv2.GaussianBlur(crop, (0, 0), 1.2), -0.16, 0
    )
    return cv2.cvtColor(sharpened, cv2.COLOR_BGR2BGRA)


def hellifishie(source: Path) -> np.ndarray:
    texture = read_rgba(source)
    canvas_size = 720
    visible = texture[:, :, :3][texture[:, :, 3] > 8]
    palette = np.percentile(visible, [18, 44, 72, 91], axis=0).astype(np.uint8)
    canvas = np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8)
    outline = tuple(int(value) for value in palette[0])
    body = tuple(int(value) for value in palette[2])
    highlight = tuple(int(value) for value in palette[3])
    tentacle = tuple(int(value) for value in palette[1])

    cv2.ellipse(
        canvas, (360, 265), (244, 204), -8, 0, 360, (*outline, 255), -1, cv2.LINE_AA
    )
    cv2.ellipse(
        canvas, (360, 257), (222, 182), -8, 0, 360, (*body, 255), -1, cv2.LINE_AA
    )
    cv2.ellipse(
        canvas, (315, 205), (118, 72), -18, 0, 360, (*highlight, 255), -1, cv2.LINE_AA
    )
    cv2.ellipse(
        canvas, (362, 310), (165, 88), -5, 0, 180, (*tentacle, 255), 18, cv2.LINE_AA
    )

    anchors = [(215, 360), (285, 400), (360, 420), (435, 397), (505, 350)]
    ends = [(145, 650), (270, 675), (365, 650), (465, 675), (575, 625)]
    for index, (start, end) in enumerate(zip(anchors, ends, strict=True)):
        middle = (
            round((start[0] + end[0]) / 2 + (-42 if index % 2 == 0 else 38)),
            round((start[1] + end[1]) / 2),
        )
        curve = np.array([start, middle, end], dtype=np.int32)
        width = 66 - abs(index - 2) * 5
        cv2.polylines(canvas, [curve], False, (*outline, 255), width + 16, cv2.LINE_AA)
        cv2.polylines(canvas, [curve], False, (*tentacle, 255), width, cv2.LINE_AA)
        cv2.circle(canvas, end, width // 2, (*tentacle, 255), -1, cv2.LINE_AA)

    cv2.circle(canvas, (305, 265), 31, (*outline, 255), -1, cv2.LINE_AA)
    cv2.circle(canvas, (305, 265), 15, (*highlight, 255), -1, cv2.LINE_AA)
    cv2.circle(canvas, (427, 253), 31, (*outline, 255), -1, cv2.LINE_AA)
    cv2.circle(canvas, (427, 253), 15, (*highlight, 255), -1, cv2.LINE_AA)
    return trim_alpha(canvas)


GENERATORS = {
    "aetos": aetos,
    "hellifishie": hellifishie,
    "roxy": gameplay_cutout,
    "jetty": gameplay_cutout,
}


def write_subject(subject: dict[str, Any]) -> dict[str, Any]:
    source = WEB_ROOT / subject["sourceFile"]
    if not source.is_file():
        raise RuntimeError(f"Required game-derived source is missing: {source}")
    image = GENERATORS[subject["id"]](source)
    maximum = 720
    scale = min(1.0, maximum / max(image.shape[:2]))
    if scale < 1:
        image = cv2.resize(
            image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA
        )

    master = MASTER_ROOT / f"{subject['id']}.png"
    public = PUBLIC_ROOT / f"{subject['id']}.webp"
    master.parent.mkdir(parents=True, exist_ok=True)
    public.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(master), image, [cv2.IMWRITE_PNG_COMPRESSION, 9]):
        raise RuntimeError(f"Failed to write {master}")
    if not cv2.imwrite(str(public), image, [cv2.IMWRITE_WEBP_QUALITY, 90]):
        raise RuntimeError(f"Failed to write {public}")

    return {
        **subject,
        "delivery": {
            "media": "webp",
            "source": f"/art/characters/enemies/{subject['id']}.webp",
            "master": f"art-source/raster/game-derived/characters/enemies/{subject['id']}.png",
        },
    }


def main() -> None:
    generated = [write_subject(subject) for subject in SUBJECTS]
    manifest = {
        "schema": 1,
        "generator": "scripts/artwork/generate-supplemental-enemy-art.py",
        "opencvVersion": cv2.__version__,
        "subjects": generated,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=4, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps({"generated": len(generated), "manifest": str(MANIFEST_PATH)}))


if __name__ == "__main__":
    main()
