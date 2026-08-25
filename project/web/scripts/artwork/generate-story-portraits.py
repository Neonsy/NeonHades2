# /// script
# dependencies = ["opencv-python-headless", "numpy", "pillow"]
# ///

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
REFERENCE_ROOT = ROOT / ".local/reference/game-assets-full/1080p"
MASTER_ROOT = ROOT / "art-source/raster/game-derived/story-portraits"
PUBLIC_ROOT = ROOT / "public/art/characters/portraits"
PROVENANCE_PATH = Path(__file__).with_name("story-portraits.json")
MAX_PUBLIC_DIMENSION = 1600

PORTRAITS = {
    "chronos": REFERENCE_ROOT / "ScriptsBase/textures/Portraits/Chronos/Portraits_Chronos_01.png",
    "hades": REFERENCE_ROOT / "BiomeI/textures/Portraits/Hades/Portraits_Hades_Restored_01.png",
    "hecate": REFERENCE_ROOT / "Hecate/textures/Portraits/Hecate/Portraits_Hecate_01.png",
    "polyphemus": REFERENCE_ROOT
    / "Polyphemus-package/textures/Portraits/Polyphemus/Portraits_Cyclops_01.png",
    "prometheus": REFERENCE_ROOT
    / "Prometheus-package/textures/Portraits/Prometheus/Portraits_Prometheus_01.png",
    "schelemeus": REFERENCE_ROOT / "Skelly-package/textures/Portraits/Skelly/Portraits_Skelly_01.png",
    "scylla": REFERENCE_ROOT / "Scylla-package/textures/Portraits/Scylla/Portraits_Scylla_01.png",
    "selene": REFERENCE_ROOT / "Selene/textures/Portraits/Selene/Portraits_Selene_01.png",
    "zagreus": REFERENCE_ROOT
    / "Zagreus/textures/Portraits/Zagreus/Portraits_ZagreusPresent_Default_01.png",
}


def remove_typhon_codex_backing(source: Path) -> np.ndarray:
    image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError(f"Expected transparent BGRA Typhon source at {source}")

    bgr = image[:, :, :3]
    original_alpha = image[:, :, 3]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    y, _ = np.indices(original_alpha.shape)

    mask = np.full(original_alpha.shape, cv2.GC_PR_BGD, np.uint8)
    mask[original_alpha < 8] = cv2.GC_BGD
    strong_character = ((hsv[:, :, 1] > 125) & (original_alpha > 8)) | (
        (y > 275) & (original_alpha > 8)
    )
    mask[strong_character] = cv2.GC_FGD

    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(
        bgr,
        mask,
        None,
        background_model,
        foreground_model,
        8,
        cv2.GC_INIT_WITH_MASK,
    )
    alpha = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)
    alpha = cv2.bitwise_and(alpha, original_alpha)

    height, width = alpha.shape
    dark_upper_edge = ((hsv[:, :, 2] < 55) & (y < 180) & (alpha > 0)).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(dark_upper_edge, 8)
    frame = np.zeros_like(dark_upper_edge)
    for component in range(1, count):
        x, component_y, component_width, _, _ = stats[component]
        if x <= 2 or component_y <= 2 or x + component_width >= width - 2:
            frame[labels == component] = 1
    frame = cv2.dilate(frame, np.ones((5, 5), np.uint8), iterations=1)
    alpha[frame > 0] = 0
    alpha[:5, :] = 0
    alpha[-5:, :] = 0
    alpha[:, :5] = 0
    alpha[:, -5:] = 0

    return np.dstack([bgr, alpha])


def write_public_webp(master: Path, destination: Path) -> None:
    image = Image.open(master).convert("RGBA")
    image.thumbnail((MAX_PUBLIC_DIMENSION, MAX_PUBLIC_DIMENSION), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=90, method=6, exact=True)


def main() -> None:
    MASTER_ROOT.mkdir(parents=True, exist_ok=True)
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    provenance = []

    for slug, source in PORTRAITS.items():
        if not source.is_file():
            raise FileNotFoundError(f"Missing extracted game portrait for {slug}: {source}")
        master = MASTER_ROOT / f"{slug}.png"
        master.write_bytes(source.read_bytes())
        public = PUBLIC_ROOT / f"{slug}.webp"
        write_public_webp(master, public)
        provenance.append(
            {
                "slug": slug,
                "source": source.relative_to(ROOT).as_posix(),
                "master": master.relative_to(ROOT).as_posix(),
                "public": f"/{public.relative_to(ROOT / 'public').as_posix()}",
                "operation": "lossless source copy and optimized WebP delivery",
            }
        )

    typhon_source = ROOT / "art-source/raster/codex-derived/characters/enemies/typhon.png"
    typhon_master = MASTER_ROOT / "typhon.png"
    if not cv2.imwrite(str(typhon_master), remove_typhon_codex_backing(typhon_source)):
        raise RuntimeError(f"Could not write {typhon_master}")
    typhon_public = PUBLIC_ROOT / "typhon.webp"
    write_public_webp(typhon_master, typhon_public)
    provenance.append(
        {
            "slug": "typhon",
            "source": typhon_source.relative_to(ROOT).as_posix(),
            "master": typhon_master.relative_to(ROOT).as_posix(),
            "public": f"/{typhon_public.relative_to(ROOT / 'public').as_posix()}",
            "operation": "OpenCV foreground segmentation of the game Codex illustration",
        }
    )

    PROVENANCE_PATH.write_text(json.dumps({"portraits": provenance}, indent=4) + "\n", encoding="utf-8")
    print(json.dumps({"storyPortraits": len(provenance), "maximumPublicDimension": MAX_PUBLIC_DIMENSION}))


if __name__ == "__main__":
    main()
