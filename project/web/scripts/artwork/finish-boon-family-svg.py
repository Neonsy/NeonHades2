# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import copy
import csv
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2


SVG = "http://www.w3.org/2000/svg"
INKSCAPE = "http://www.inkscape.org/namespaces/inkscape"
ET.register_namespace("", SVG)
ET.register_namespace("inkscape", INKSCAPE)


FAMILY_STYLE: dict[str, dict[str, object]] = {
    "Aphrodite": {
        "phrase": "rose-gold heart seam and turquoise charm glint",
        "linework": [("M27 62 C37 68 53 68 63 61", "#e56f96", 1.15, .8), ("M31 59 C39 64 51 64 59 58", "#63e6d2", .75, .7)],
        "markings": [("M37 66 L39 62 M51 65 L52 61", "#f5c5d5", .9, .78)],
        "effects": [("M25 31 C30 25 36 25 41 31", "#fff0f4", .75, .62)],
    },
    "Ares": {
        "phrase": "blood-red blade cut and gold impact notches",
        "linework": [("M29 64 L59 34", "#d95d52", 1.1, .78), ("M34 66 L63 37", "#f2bd57", .65, .66)],
        "markings": [("M27 54 L33 56 M55 29 L58 35", "#f07362", .9, .76)],
        "effects": [("M24 66 C35 70 53 70 65 64", "#ffd08a", .7, .58)],
    },
    "Chaos": {
        "phrase": "violet orbit and turquoise void-node glint",
        "linework": [("M23 50 C29 65 52 72 67 57", "#9a7cff", 1.05, .78), ("M27 46 C34 57 51 61 62 51", "#63e6d2", .7, .68)],
        "markings": [("M29 29 C29 25 35 25 35 29 C35 33 29 33 29 29", "#b5fff2", .8, .72)],
        "effects": [("M58 25 L64 20 M65 30 L71 28", "#c3b4ff", .8, .62)],
    },
    "Demeter": {
        "phrase": "ice-blue frost vein and silver crystal cuts",
        "linework": [("M28 64 L38 54 L45 59 L55 45 L64 50", "#8fd6f2", 1.05, .8), ("M32 67 L42 58 L47 62 L58 49", "#f2f7ff", .6, .68)],
        "markings": [("M33 34 L37 38 M58 31 L54 36", "#b9a8ff", .85, .74)],
        "effects": [("M24 59 C34 70 54 72 66 60", "#dff8ff", .7, .58)],
    },
    "Hephaestus": {
        "phrase": "copper forge bracket and turquoise temper line",
        "linework": [("M26 63 H64", "#d98a43", 1.2, .82), ("M31 59 H59", "#63e6d2", .7, .7)],
        "markings": [("M32 60 V66 M45 60 V66 M58 60 V66", "#ffd08a", .85, .76)],
        "effects": [("M27 31 L32 26 M58 26 L63 31", "#f3b86c", .8, .64)],
    },
    "Hera": {
        "phrase": "paired turquoise and gold covenant arcs with seal marks",
        "linework": [("M25 63 C36 69 54 69 65 62", "#63e6d2", 1.1, .82), ("M30 59 C38 64 51 64 60 58", "#f2bd57", .7, .72)],
        "markings": [("M37 66 V62 M53 65 V61", "#d994ff", .9, .78)],
        "effects": [("M31 29 C37 23 52 23 59 29", "#b5fff2", .75, .62)],
    },
    "Hermes": {
        "phrase": "gold wing slash and turquoise speed wake",
        "linework": [("M24 62 C36 66 50 63 64 52", "#f2bd57", 1.1, .82), ("M29 65 C41 68 55 62 67 50", "#63e6d2", .7, .68)],
        "markings": [("M25 53 L33 51 M29 47 L37 46", "#fff2a8", .85, .76)],
        "effects": [("M61 29 L68 24 M63 35 L71 32", "#c3b4ff", .8, .62)],
    },
    "Hestia": {
        "phrase": "ember-red hearth arc and turquoise heat seam",
        "linework": [("M26 63 C36 68 53 69 64 61", "#ef6b4f", 1.1, .82), ("M31 60 C39 64 51 64 59 58", "#63e6d2", .7, .68)],
        "markings": [("M35 66 L37 61 M47 67 V61 M58 64 L56 59", "#ffb35f", .85, .76)],
        "effects": [("M33 30 C39 24 51 24 57 30", "#ffe0a8", .75, .62)],
    },
    "Poseidon": {
        "phrase": "sea-blue wave line and turquoise foam cuts",
        "linework": [("M23 61 C31 54 38 68 46 61 C54 54 61 67 68 59", "#5aa6d8", 1.15, .84), ("M27 65 C35 59 41 70 49 64 C57 58 62 67 67 63", "#63e6d2", .7, .7)],
        "markings": [("M30 34 L34 38 M59 33 L55 38", "#b5fff2", .85, .76)],
        "effects": [("M24 48 C21 41 23 34 28 29", "#9de7ef", .75, .62)],
    },
    "Zeus": {
        "phrase": "lightning-gold zigzag and violet storm cuts",
        "linework": [("M31 64 L41 52 L37 47 L53 29 L49 44 L58 49 L45 64", "#f2bd57", 1.05, .8)],
        "markings": [("M27 37 L33 39 M58 33 L64 30", "#9a7cff", .9, .76)],
        "effects": [("M26 66 C37 70 54 70 65 63", "#fff6b7", .7, .6)],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--family", choices=sorted(FAMILY_STYLE), required=True)
    parser.add_argument("--input-directory", type=Path, required=True)
    parser.add_argument("--alpha-directory", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--skip-slugs", default="")
    return parser.parse_args()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower().replace("’", "").replace("'", "")))


def layer(parent: ET.Element, identifier: str, label: str) -> ET.Element:
    return ET.SubElement(parent, f"{{{SVG}}}g", {
        "id": identifier,
        f"{{{INKSCAPE}}}groupmode": "layer",
        f"{{{INKSCAPE}}}label": label,
    })


def add_paths(parent: ET.Element, paths: list[tuple[str, str, float, float]]) -> None:
    for index, (data, color, width, opacity) in enumerate(paths, start=1):
        ET.SubElement(parent, f"{{{SVG}}}path", {
            "id": f"{parent.attrib['id']}-{index}", "d": data, "fill": "none", "stroke": color,
            "stroke-width": str(width), "stroke-linecap": "round", "stroke-linejoin": "round", "opacity": str(opacity),
        })


def alpha_path(path: Path) -> str:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError(f"Expected RGBA alpha source: {path}")
    mask = (image[:, :, 3] > 8).astype("uint8")
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise RuntimeError(f"Alpha source has no contour: {path}")
    x, y, width, height = cv2.boundingRect(max(contours, key=cv2.contourArea))
    radius = min(width, height) * .125
    right = x + width
    bottom = y + height
    return (
        f"M{x + radius:.2f} {y} H{right - radius:.2f} "
        f"Q{right} {y} {right} {y + radius:.2f} V{bottom - radius:.2f} "
        f"Q{right} {bottom} {right - radius:.2f} {bottom} H{x + radius:.2f} "
        f"Q{x} {bottom} {x} {bottom - radius:.2f} V{y + radius:.2f} "
        f"Q{x} {y} {x + radius:.2f} {y} Z"
    )


def finish(name: str, family: str, input_path: Path, alpha_source: Path, output_path: Path) -> None:
    style = FAMILY_STYLE[family]
    tree = ET.parse(input_path)
    root = tree.getroot()
    slug = slugify(name)
    width = float(root.attrib["width"])
    height = float(root.attrib["height"])
    root.set("viewBox", f"0 0 {width:g} {height:g}")
    root.set("role", "img")
    root.set("aria-labelledby", f"{slug}-title {slug}-description")
    original_children = list(root)
    for child in original_children:
        root.remove(child)

    definitions = ET.SubElement(root, f"{{{SVG}}}defs")
    clipping = ET.SubElement(definitions, f"{{{SVG}}}clipPath", {"id": f"{slug}-alpha-clip"})
    ET.SubElement(clipping, f"{{{SVG}}}path", {"d": alpha_path(alpha_source)})
    ET.SubElement(root, f"{{{SVG}}}title", {"id": f"{slug}-title"}).text = f"{name} {family} boon reconstruction"
    ET.SubElement(root, f"{{{SVG}}}desc", {"id": f"{slug}-description"}).text = (
        f"Faithful {family} boon icon preserving its game silhouette and central emblem, finished with {style['phrase']}."
    )
    silhouette = layer(root, "silhouette", "Silhouette and traced reconstruction")
    silhouette.set("clip-path", f"url(#{slug}-alpha-clip)")
    base = layer(silhouette, "base-colors", "Base colors and identifying forms")
    for child in original_children:
        base.append(copy.deepcopy(child))
    accent_scale = width / 90
    linework = layer(root, "linework", "Family-specific edge hierarchy")
    markings = layer(root, "internal-markings", "Family-specific seal marks")
    effects = layer(root, "effects", "Family-specific rim light and glints")
    for accent_layer in (linework, markings, effects):
        accent_layer.set("transform", f"scale({accent_scale:g})")
    add_paths(linework, style["linework"])
    add_paths(markings, style["markings"])
    add_paths(effects, style["effects"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(tree, space="  ")
    tree.write(output_path, encoding="utf-8", xml_declaration=True)


def main() -> None:
    args = parse_args()
    prefix = f"GUI\\Screens\\BoonIcons\\{args.family}_"
    with args.mapping.open("r", encoding="utf-8", newline="") as stream:
        rows = [
            row for row in csv.DictReader(stream, delimiter="\t")
            if row["record_type"] == "mechanics/boon" and row["map_status"] == "resolved" and row["game_asset"].startswith(prefix)
        ]
    skip = {value for value in args.skip_slugs.split(",") if value}
    finished = 0
    for row in sorted(rows, key=lambda candidate: candidate["game_asset"]):
        slug = slugify(row["public_name"])
        if slug in skip:
            continue
        finish(
            row["public_name"], args.family,
            args.input_directory / f"{slug}-baseline.svg",
            args.alpha_directory / f"{slug}.png",
            args.output_directory / f"{slug}.svg",
        )
        finished += 1
    print(f"Finished {finished} {args.family} boon masters")


if __name__ == "__main__":
    main()
