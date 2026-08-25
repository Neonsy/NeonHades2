# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "opencv-python==5.0.0.93",
#   "numpy==2.4.2",
# ]
# ///

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np


WEB_ROOT = Path(__file__).resolve().parents[2]
GAME_GUI = WEB_ROOT / ".local/reference/game-assets/GUI/textures/GUI"
SYMBOL_ROOT = GAME_GUI / "Screens/BoonSelectSymbols"
MASTER_ROOT = WEB_ROOT / "art-source/raster/game-derived/god-symbols"
PUBLIC_ROOT = WEB_ROOT / "public/art/gods/symbols"
PROVENANCE_PATH = WEB_ROOT / "scripts/artwork/god-symbols.json"

GODS = (
    "Aphrodite",
    "Apollo",
    "Ares",
    "Chaos",
    "Demeter",
    "Hephaestus",
    "Hera",
    "Hermes",
    "Hestia",
    "Poseidon",
    "Zeus",
)

DELIVERY_CROP_SCALE = 0.38
SILHOUETTE_BLUR_SIGMA = 6.0
SILHOUETTE_EDGE_THRESHOLD = 18.0
SILHOUETTE_COMPONENT_RATIO = 0.02
SILHOUETTE_COMPONENT_REACH = 0.08
SILHOUETTE_SUPPORT_RADIUS = 7
ZEUS_MIN_VALUE = 238
ZEUS_MAX_SATURATION = 215
ZEUS_MIN_ALPHA = 245
ZEUS_SUPPORT_RADIUS = 9


def resize_rgba(image: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """Resize transparent artwork without bleeding hidden RGB into its edge."""
    color = image[:, :, :3].astype(np.float32)
    alpha = image[:, :, 3].astype(np.float32) / 255.0
    premultiplied = color * alpha[:, :, None]

    resized_alpha = cv2.resize(alpha, size, interpolation=cv2.INTER_CUBIC)
    resized_color = cv2.resize(premultiplied, size, interpolation=cv2.INTER_CUBIC)
    safe_alpha = np.maximum(resized_alpha, 1.0 / 255.0)
    resized_color = resized_color / safe_alpha[:, :, None]

    result = np.zeros((size[1], size[0], 4), dtype=np.uint8)
    result[:, :, :3] = np.clip(np.rint(resized_color), 0, 255).astype(np.uint8)
    result[:, :, 3] = np.clip(np.rint(resized_alpha * 255.0), 0, 255).astype(np.uint8)
    return result


def central_components(mask: np.ndarray) -> np.ndarray:
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if component_count <= 1:
        return mask

    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_area = int(areas.max())
    largest = int(np.argmax(areas)) + 1
    minimum_area = max(8, int(round(largest_area * SILHOUETTE_COMPONENT_RATIO)))
    left = int(stats[largest, cv2.CC_STAT_LEFT])
    top = int(stats[largest, cv2.CC_STAT_TOP])
    right = left + int(stats[largest, cv2.CC_STAT_WIDTH])
    bottom = top + int(stats[largest, cv2.CC_STAT_HEIGHT])
    reach = int(round(max(mask.shape) * SILHOUETTE_COMPONENT_REACH))
    kept = np.zeros_like(mask)
    for component in range(1, component_count):
        component_left = int(stats[component, cv2.CC_STAT_LEFT])
        component_top = int(stats[component, cv2.CC_STAT_TOP])
        component_right = component_left + int(stats[component, cv2.CC_STAT_WIDTH])
        component_bottom = component_top + int(stats[component, cv2.CC_STAT_HEIGHT])
        touches_emblem = (
            component_right >= left - reach
            and component_left <= right + reach
            and component_bottom >= top - reach
            and component_top <= bottom + reach
        )
        if int(stats[component, cv2.CC_STAT_AREA]) >= minimum_area and touches_emblem:
            kept[labels == component] = 255

    return kept


def primary_component(mask: np.ndarray) -> np.ndarray:
    """Keep the dominant connected emblem without destroying its negative space."""
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if component_count <= 1:
        return mask

    largest = int(np.argmax(stats[1:, cv2.CC_STAT_AREA])) + 1
    return np.where(labels == largest, 255, 0).astype(np.uint8)


def zeus_silhouette(image: np.ndarray) -> np.ndarray:
    """Recover the bright bolt while rejecting the opaque circular source glow."""
    hsv = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2HSV)
    mask = np.where(
        (hsv[:, :, 2] >= ZEUS_MIN_VALUE)
        & (hsv[:, :, 1] <= ZEUS_MAX_SATURATION)
        & (image[:, :, 3] >= ZEUS_MIN_ALPHA),
        255,
        0,
    ).astype(np.uint8)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
    )
    mask = primary_component(mask)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    silhouette = np.zeros_like(mask)
    cv2.drawContours(silhouette, contours, -1, 255, thickness=cv2.FILLED)
    return silhouette


def focus_delivery(image: np.ndarray, identifier: str) -> np.ndarray:
    height, width = image.shape[:2]
    crop_size = int(round(min(height, width) * DELIVERY_CROP_SCALE))
    left = (width - crop_size) // 2
    top = (height - crop_size) // 2
    focused = image[top : top + crop_size, left : left + crop_size].copy()

    if identifier == "zeus":
        hard_mask = zeus_silhouette(focused)
        difference = np.ones(focused.shape[:2], dtype=np.float32)
        support_radius = ZEUS_SUPPORT_RADIUS
        blur_sigma = 1.2
    else:
        lab = cv2.cvtColor(focused[:, :, :3], cv2.COLOR_BGR2LAB).astype(np.float32)
        local_background = cv2.GaussianBlur(lab, (0, 0), SILHOUETTE_BLUR_SIGMA)
        difference = np.linalg.norm(lab - local_background, axis=2)
        hard_mask = np.where(difference >= SILHOUETTE_EDGE_THRESHOLD, 255, 0).astype(np.uint8)
        hard_mask = cv2.morphologyEx(
            hard_mask,
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        )
        hard_mask = cv2.dilate(hard_mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
        hard_mask = central_components(hard_mask)
        support_radius = SILHOUETTE_SUPPORT_RADIUS
        blur_sigma = 0.7
    support = cv2.dilate(
        hard_mask,
        cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (support_radius, support_radius),
        ),
    )
    soft_mask = cv2.GaussianBlur(support.astype(np.float32) / 255.0, (0, 0), blur_sigma)
    strength = np.ones_like(difference) if identifier == "zeus" else np.clip(
        (difference - 8.0) / 26.0,
        0.0,
        1.0,
    )
    source_alpha = focused[:, :, 3].astype(np.float32) / 255.0
    focused[:, :, 3] = np.rint(source_alpha * soft_mask * np.maximum(strength, 0.82) * 255.0).astype(
        np.uint8
    )
    return resize_rgba(focused, (width, height))


def write_asset(identifier: str, source: Path) -> dict[str, str]:
    image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError(f"Expected an RGBA game asset: {source}")

    master = MASTER_ROOT / f"{identifier}.png"
    public = PUBLIC_ROOT / f"{identifier}.webp"
    master.parent.mkdir(parents=True, exist_ok=True)
    public.parent.mkdir(parents=True, exist_ok=True)

    if not cv2.imwrite(str(master), image, [cv2.IMWRITE_PNG_COMPRESSION, 9]):
        raise RuntimeError(f"Failed to write {master}")
    delivery = image if identifier == "shared" else focus_delivery(image, identifier)
    quality = 92 if identifier == "shared" else 94
    if not cv2.imwrite(str(public), delivery, [cv2.IMWRITE_WEBP_QUALITY, quality]):
        raise RuntimeError(f"Failed to write {public}")

    return {
        "id": identifier,
        "source": source.relative_to(WEB_ROOT).as_posix(),
        "master": master.relative_to(WEB_ROOT).as_posix(),
        "delivery": f"/{public.relative_to(WEB_ROOT / 'public').as_posix()}",
    }


def main() -> None:
    rows = [write_asset(god.casefold(), SYMBOL_ROOT / f"{god}.png") for god in GODS]
    rows.append(write_asset("shared", GAME_GUI / "Icons/Boon.png"))
    PROVENANCE_PATH.write_text(
        json.dumps(
            {
                "schema": 1,
                "generator": "scripts/artwork/generate-god-symbols.py",
                "opencvVersion": cv2.__version__,
                "deliveryCropScale": DELIVERY_CROP_SCALE,
                "silhouetteBlurSigma": SILHOUETTE_BLUR_SIGMA,
                "silhouetteEdgeThreshold": SILHOUETTE_EDGE_THRESHOLD,
                "silhouetteComponentRatio": SILHOUETTE_COMPONENT_RATIO,
                "silhouetteComponentReach": SILHOUETTE_COMPONENT_REACH,
                "silhouetteSupportRadius": SILHOUETTE_SUPPORT_RADIUS,
                "assets": rows,
            },
            indent=4,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"generated": len(rows), "provenance": str(PROVENANCE_PATH)}))


if __name__ == "__main__":
    main()
