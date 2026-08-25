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
import numpy as np


SVG = "http://www.w3.org/2000/svg"
INKSCAPE = "http://www.inkscape.org/namespaces/inkscape"
ET.register_namespace("", SVG)
ET.register_namespace("inkscape", INKSCAPE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--record-type", required=True)
    parser.add_argument("--asset-prefix", required=True)
    parser.add_argument("--input-directory", type=Path, required=True)
    parser.add_argument("--alpha-directory", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--public-name", action="append", default=[])
    parser.add_argument("--slug-field", choices=("public-name", "href-tail", "record-id"), default="public-name")
    parser.add_argument("--input-slug-field", choices=("public-name", "record-id"), default="public-name")
    return parser.parse_args()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower().replace("’", "").replace("'", "")))


def delivery_slug(row: dict[str, str], slug_field: str) -> str:
    if slug_field == "record-id":
        return slugify(row["record_key"].split(":", 1)[-1])
    if slug_field == "href-tail":
        path = row["href"].split("#", 1)[0].rstrip("/")
        return slugify(path.rsplit("/", 1)[-1])
    return slugify(row["public_name"])


def layer(parent: ET.Element, identifier: str, label: str) -> ET.Element:
    return ET.SubElement(parent, f"{{{SVG}}}g", {
        "id": identifier,
        f"{{{INKSCAPE}}}groupmode": "layer",
        f"{{{INKSCAPE}}}label": label,
    })


def contours_to_path(contours: list[np.ndarray], epsilon: float, minimum_length: float, limit: int | None = None) -> str:
    candidates = [contour for contour in contours if cv2.arcLength(contour, True) >= minimum_length]
    candidates.sort(key=lambda contour: cv2.arcLength(contour, True), reverse=True)
    if limit is not None:
        candidates = candidates[:limit]
    commands: list[str] = []
    for contour in candidates:
        polygon = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
        if len(polygon) < 3:
            continue
        commands.extend([f"M{polygon[0, 0]} {polygon[0, 1]}", *(f"L{x} {y}" for x, y in polygon[1:]), "Z"])
    return " ".join(commands)


def derived_paths(image: np.ndarray) -> tuple[str, str, str, str, str]:
    alpha = image[:, :, 3]
    # Transparent game sprites often carry a broad, softly coloured aura. VTracer
    # rasterizes every non-zero alpha pixel as an opaque colour region, which turns
    # that aura into a black/white plate. Keep the authored object and its hard
    # glints in the trace; rebuild the soft aura as a separate editable SVG layer.
    visible = alpha >= 128
    external, _ = cv2.findContours(visible.astype("uint8"), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    alpha_path = contours_to_path(external, 1.2, 8)

    # Thin ritual objects and painted edge glows can carry a material amount of
    # their readable silhouette below the hard-alpha threshold. Preserve that
    # complete source-defined extent as a separate, faint editable layer rather
    # than widening the hard trace or rasterizing the reference into the SVG.
    soft_visible = alpha > 0
    soft_external, _ = cv2.findContours(
        soft_visible.astype("uint8"), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )
    soft_alpha_path = contours_to_path(soft_external, 0.5, 0)

    gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 72, 156)
    edges[~visible] = 0
    edge_contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    edge_path = contours_to_path(edge_contours, 1.25, 26, 56)

    highlight_mask = ((gray >= 208) & visible).astype("uint8")
    highlight_contours, _ = cv2.findContours(highlight_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    highlight_path = contours_to_path(highlight_contours, 1.4, 20, 24)

    visible_bgr = image[:, :, :3][visible]
    if len(visible_bgr):
        light = np.percentile(visible_bgr, 82, axis=0).astype(int)
        highlight_color = f"#{light[2]:02x}{light[1]:02x}{light[0]:02x}"
    else:
        highlight_color = "#f2efe6"
    return alpha_path, soft_alpha_path, edge_path, highlight_path, highlight_color


def finish(name: str, input_path: Path, alpha_source: Path, output_path: Path) -> None:
    image = cv2.imread(str(alpha_source), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError(f"Expected RGBA source: {alpha_source}")
    alpha_path, soft_alpha_path, edge_path, highlight_path, highlight_color = derived_paths(image)
    if not alpha_path:
        raise RuntimeError(f"No visible contour: {alpha_source}")

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
    ET.SubElement(clipping, f"{{{SVG}}}path", {"d": alpha_path, "fill-rule": "evenodd"})
    soft_clipping = ET.SubElement(definitions, f"{{{SVG}}}clipPath", {"id": f"{slug}-soft-alpha-clip"})
    ET.SubElement(soft_clipping, f"{{{SVG}}}path", {
        "d": soft_alpha_path or alpha_path,
        "fill-rule": "evenodd",
    })
    ET.SubElement(root, f"{{{SVG}}}title", {"id": f"{slug}-title"}).text = f"{name} reconstructed game asset"
    ET.SubElement(root, f"{{{SVG}}}desc", {"id": f"{slug}-description"}).text = (
        f"Editable reconstruction of {name}, preserving its canonical silhouette, palette, material facets, and identifying marks."
    )

    aura = layer(root, "material-aura", "Source-specific soft material aura")
    ET.SubElement(aura, f"{{{SVG}}}path", {
        "d": soft_alpha_path or alpha_path,
        "fill": highlight_color,
        "fill-rule": "evenodd",
        "opacity": ".08",
    })

    silhouette = layer(root, "silhouette", "Canonical silhouette and base reconstruction")
    silhouette.set("clip-path", f"url(#{slug}-alpha-clip)")
    base = layer(silhouette, "base-colors", "Base colors and identifying forms")
    for child in original_children:
        base.append(copy.deepcopy(child))

    outline = layer(root, "material-outline", "Source-specific material outline")
    outline.set("clip-path", f"url(#{slug}-soft-alpha-clip)")
    ET.SubElement(outline, f"{{{SVG}}}path", {
        "d": alpha_path, "fill": "none", "stroke": "#111421", "stroke-width": str(max(width, height) / 240),
        "stroke-linejoin": "round", "opacity": ".72",
    })
    if edge_path:
        linework = layer(root, "internal-linework", "Source-derived internal material linework")
        linework.set("clip-path", f"url(#{slug}-soft-alpha-clip)")
        ET.SubElement(linework, f"{{{SVG}}}path", {
            "d": edge_path, "fill": "none", "stroke": "#111421", "stroke-width": str(max(width, height) / 360),
            "stroke-linejoin": "round", "stroke-linecap": "round", "opacity": ".34",
        })
    if highlight_path:
        highlights = layer(root, "material-highlights", "Source-specific highlights and glints")
        highlights.set("clip-path", f"url(#{slug}-soft-alpha-clip)")
        ET.SubElement(highlights, f"{{{SVG}}}path", {
            "d": highlight_path, "fill": "none", "stroke": highlight_color, "stroke-width": str(max(width, height) / 420),
            "stroke-linejoin": "round", "stroke-linecap": "round", "opacity": ".46",
        })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(tree, space="  ")
    tree.write(output_path, encoding="utf-8", xml_declaration=True)


def main() -> None:
    args = parse_args()
    with args.mapping.open("r", encoding="utf-8", newline="") as stream:
        rows = [
            row for row in csv.DictReader(stream, delimiter="\t")
            if row["record_type"] == args.record_type
            and row["map_status"] == "resolved"
            and row["game_asset"].startswith(args.asset_prefix)
        ]
    if args.public_name:
        selected = set(args.public_name)
        rows = [row for row in rows if row["public_name"] in selected]
    finished = 0
    for row in sorted(rows, key=lambda candidate: candidate["game_asset"]):
        input_slug = delivery_slug(row, args.input_slug_field)
        output_slug = delivery_slug(row, args.slug_field)
        finish(
            row["public_name"],
            args.input_directory / f"{input_slug}-baseline.svg",
            args.alpha_directory / f"{input_slug}.png",
            args.output_directory / f"{output_slug}.svg",
        )
        finished += 1
    print(f"Finished {finished} flat assets for {args.record_type} / {args.asset_prefix}")


if __name__ == "__main__":
    main()
