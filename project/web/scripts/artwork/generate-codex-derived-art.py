# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy==2.5.2",
#   "opencv-python==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import json
import re
import zlib
from pathlib import Path
from typing import Any

import cv2
import numpy as np


WEB_ROOT = Path(__file__).resolve().parents[2]
PUBLICATION_PATH = WEB_ROOT / "src/content/publication.json"
DEFAULT_SOURCE_ROOT = WEB_ROOT / ".local/reference/game-assets/GUI/textures/Portraits/Codex"
MAP_PATH = WEB_ROOT / "scripts/artwork/codex-derived-subjects.json"
MASTER_ROOT = WEB_ROOT / "art-source/raster/codex-derived"
PUBLIC_ROOT = WEB_ROOT / "public/art"

ENEMY_ALIASES = {
    "BloodlessWaveFist": "BloodlessWaveMaker",
    "Brute": "TyphonBrute",
    "Brute_Miniboss": "TyphonBruteMiniboss",
    "Captain": "ZombieCaptain",
    "CharybdisTentacle": "Charybdis",
    "ClockworkHeavyMelee": "WretchThug",
    "CorruptedShadeLarge": "CorruptedShadeL",
    "CorruptedShadeMedium": "CorruptedShadeM",
    "CorruptedShadeSmall": "CorruptedShadeS",
    "CrawlerMiniboss": "CrawlerMiniBoss",
    "DespairElemental_Elite": "DespairElemental",
    "DragonBurrower": "DragonBurrowerTyphon",
    "Dragon_MiniBoss": "DragonMiniboss",
    "Drunk": "DeadSeaDrunk",
    "EarthElemental": "EarthElementalTyphon",
    "FogEmitter_Elite": "FogEmitter",
    "GoldElemental_MiniBoss": "GoldElementalMiniBoss",
    "HarpyCutter": "HarpyTalonCutter",
    "Lamia_Miniboss": "LamiaMiniBoss",
    "Mati": "MatiTyphon",
    "Octofish_Miniboss": "OctoFishMiniboss",
    "SatyrRatCatcher_Miniboss": "SatyrRatCatcherMiniBoss",
    "SpreadShotUnit": "LightRangedAsphodel",
    "Stickler": "DeadSeaStickler",
    "Stalker": "TyphonSupport",
    "Stalker_Miniboss": "TyphonSupportMiniboss",
    "Swab": "DeadSeaSwab",
    "Swarmer_Elite": "Swarmer",
    "WaterUnitMiniboss": "WaterUnitMiniBoss",
    "ZombieAssassin_Miniboss": "ZombieAssassinMiniBoss",
}

REGION_SOURCES = {
    "Chaos": "BiomeChaos",
    "F": "BiomeErebus",
    "G": "BiomeOceanus",
    "H": "BiomeFields",
    "Home": "BiomeCrossroads",
    "I": "BiomeTartarus",
    "N": "BiomeEphyra",
    "N_SubRooms": "BiomeEphyra",
    "O": "BiomeThessaly",
    "P": "BiomeOlympus",
    "Q": "BiomeSummit",
}

STORY_PORTRAIT_IDS = {
    "chronos",
    "hecate",
    "polyphemus",
    "prometheus",
    "scylla",
    "typhon",
    "zagreus",
}


def slugify(value: str) -> str:
    normalized = value.casefold().replace("’", "").replace("'", "")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", normalized))


def publication_records() -> list[dict[str, Any]]:
    publication = json.loads(PUBLICATION_PATH.read_text(encoding="utf-8"))
    return publication["records"]


def source_index(source_root: Path) -> dict[str, Path]:
    return {path.stem.casefold(): path for path in source_root.glob("CodexPortrait_*.png")}


def subject_rows(source_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    sources = source_index(source_root)
    rows: list[dict[str, Any]] = []
    missing: list[dict[str, str]] = []

    for record in publication_records():
        record_type = record["recordType"]
        if record_type not in {"world-progression/enemy", "world-progression/region"}:
            continue

        public = record.get("public")
        if not public or public.get("presentation") != "detail":
            continue

        source_id = (
            ENEMY_ALIASES.get(record["id"], record["id"])
            if record_type == "world-progression/enemy"
            else REGION_SOURCES[record["id"]]
        )
        source_name = f"CodexPortrait_{source_id}"
        source = sources.get(source_name.casefold())
        if source is None:
            missing.append(
                {
                    "recordKey": record["key"],
                    "publicName": public["name"],
                    "expectedSource": source_name,
                }
            )
            continue

        identifier = slugify(public["name"])
        category = "characters/enemies" if record_type == "world-progression/enemy" else "regions"
        delivery = {
            "media": "webp",
            "source": f"/art/{category}/{identifier}.webp",
            "master": f"art-source/raster/codex-derived/{category}/{identifier}.png",
        }
        external_generator = None
        if identifier in STORY_PORTRAIT_IDS:
            delivery = {
                "media": "webp",
                "source": f"/art/characters/portraits/{identifier}.webp",
                "master": f"art-source/raster/game-derived/story-portraits/{identifier}.png",
            }
            external_generator = "scripts/artwork/generate-story-portraits.py"

        rows.append(
            {
                "recordKey": record["key"],
                "recordType": record_type,
                "publicName": public["name"],
                "id": identifier,
                "kind": "character" if record_type == "world-progression/enemy" else "record",
                "tone": "night" if record_type == "world-progression/enemy" else "thread",
                "route": "opencv-raster",
                "canonicalAsset": f"GUI:Portraits/Codex/{source_name}",
                "sourceId": source_id,
                "sourceFile": source.relative_to(WEB_ROOT).as_posix(),
                "delivery": delivery,
                **({"externalGenerator": external_generator} if external_generator else {}),
            }
        )

    return rows, missing


def stylize(source: Path, variant_seed: int) -> np.ndarray:
    image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise RuntimeError(f"OpenCV could not read {source}")
    if image.ndim != 3 or image.shape[2] not in {3, 4}:
        raise RuntimeError(f"Expected an RGB or RGBA source, got {image.shape} for {source}")

    if image.shape[2] == 3:
        alpha = np.full(image.shape[:2], 255, dtype=np.uint8)
        bgr = image
    else:
        bgr = image[:, :, :3]
        alpha = image[:, :, 3]

    maximum = 560
    scale = min(1.0, maximum / max(bgr.shape[:2]))
    if scale < 1.0:
        size = (max(1, round(bgr.shape[1] * scale)), max(1, round(bgr.shape[0] * scale)))
        bgr = cv2.resize(bgr, size, interpolation=cv2.INTER_AREA)
        alpha = cv2.resize(alpha, size, interpolation=cv2.INTER_AREA)

    softened = cv2.bilateralFilter(bgr, 7, 34, 34)
    visible = alpha > 6
    pixels = softened[visible].reshape((-1, 3)).astype(np.float32)
    if pixels.size == 0:
        raise RuntimeError(f"Source has no visible pixels: {source}")

    cv2.setRNGSeed(2301 + variant_seed)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 24, 0.35)
    _, labels, centers = cv2.kmeans(pixels, 14, None, criteria, 1, cv2.KMEANS_PP_CENTERS)
    quantized = softened.copy()
    quantized[visible] = np.clip(centers[labels.flatten()], 0, 255).astype(np.uint8)
    treated = cv2.addWeighted(quantized, 0.78, bgr, 0.22, 0)

    hsv = cv2.cvtColor(treated, cv2.COLOR_BGR2HSV)
    hue_shift = (variant_seed % 7) - 3
    hue = hsv[:, :, 0].astype(np.int16)
    hsv[:, :, 0] = np.mod(hue + hue_shift, 180).astype(np.uint8)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1].astype(np.int16) + 8, 0, 255).astype(np.uint8)
    treated = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 62, 132)
    edges = cv2.bitwise_and(edges, alpha)
    dark_mask = cv2.GaussianBlur(edges, (3, 3), 0).astype(np.float32)[:, :, None] / 255.0
    treated = np.clip(treated.astype(np.float32) * (1.0 - dark_mask * 0.26), 0, 255).astype(np.uint8)

    return np.dstack((treated, alpha))


def write_subject(row: dict[str, Any], source_root: Path) -> None:
    if row.get("externalGenerator"):
        return
    source = source_root / f"CodexPortrait_{row['sourceId']}.png"
    output = stylize(source, zlib.crc32(row["id"].encode("utf-8")) % 100_000)
    master = WEB_ROOT / row["delivery"]["master"]
    public = PUBLIC_ROOT / row["delivery"]["source"].removeprefix("/art/")
    master.parent.mkdir(parents=True, exist_ok=True)
    public.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(master), output, [cv2.IMWRITE_PNG_COMPRESSION, 9]):
        raise RuntimeError(f"Failed to write {master}")
    if not cv2.imwrite(str(public), output, [cv2.IMWRITE_WEBP_QUALITY, 88]):
        raise RuntimeError(f"Failed to write {public}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create source-derived Codex artwork with a deterministic treatment.")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--record", help="Generate one internal record id for visual review.")
    args = parser.parse_args()

    if not args.source_root.is_dir():
        raise SystemExit(f"Codex portrait source directory does not exist: {args.source_root}")

    rows, missing = subject_rows(args.source_root)
    selected = [row for row in rows if not args.record or row["recordKey"].endswith(f":{args.record}")]
    if args.record and not selected:
        raise SystemExit(f"No source-derived subject matched record id {args.record}")

    for row in selected:
        write_subject(row, args.source_root)

    manifest = {
        "schema": 1,
        "generator": "scripts/artwork/generate-codex-derived-art.py",
        "opencvVersion": cv2.__version__,
        "subjects": rows,
        "missingSources": missing,
    }
    MAP_PATH.write_text(json.dumps(manifest, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "generated": len(selected),
                "mapped": len(rows),
                "missingSource": len(missing),
                "map": str(MAP_PATH),
            }
        )
    )


if __name__ == "__main__":
    main()
