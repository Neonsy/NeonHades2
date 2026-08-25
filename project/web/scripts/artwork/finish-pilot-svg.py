from __future__ import annotations

import argparse
import copy
import xml.etree.ElementTree as ET
from pathlib import Path


SVG = "http://www.w3.org/2000/svg"
INKSCAPE = "http://www.inkscape.org/namespaces/inkscape"
ET.register_namespace("", SVG)
ET.register_namespace("inkscape", INKSCAPE)


OVERLAYS: dict[str, dict[str, object]] = {
    "nova-strike": {
        "title": "Nova Strike solar-scroll recreation",
        "description": "Faithful Apollo boon icon reconstruction with a turquoise page-edge glint and engraved lower-scroll notches.",
        "linework": [
            ("M25 62 C34 68 50 69 64 59", "#090b12", 2.2, 0.72),
            ("M29 64 C39 67 52 66 61 60", "#63e6d2", 1.15, 0.92),
        ],
        "markings": [
            ("M34 65 L36 62 M43 67 L44 63 M52 65 L53 62", "#f2bd57", 1.2, 0.9),
        ],
        "effects": [
            ("M17 47 C13 39 15 30 21 23", "#b5fff2", 0.9, 0.72),
        ],
    },
    "born-gain": {
        "title": "Born Gain Hera-vortex recreation",
        "description": "Faithful Hera boon icon reconstruction with a divine-yellow inner seal and broken turquoise orbit marks.",
        "linework": [
            ("M34 45 L45 33 L57 45 L45 57 Z", "#090b12", 2.0, 0.76),
            ("M36 45 L45 36 L54 45 L45 54 Z", "#f2bd57", 1.15, 0.96),
        ],
        "markings": [
            ("M45 36 V54 M36 45 H54", "#f2eee5", 0.75, 0.76),
        ],
        "effects": [
            ("M18 28 C12 37 12 48 17 58 M72 29 C77 39 77 49 72 59", "#b5fff2", 1.0, 0.78),
        ],
    },
    "ashes": {
        "title": "Ashes shattered-crescent recreation",
        "description": "Faithful Ashes resource reconstruction with turquoise fracture glints and carved ceramic hatching.",
        "linework": [
            ("M113 199 C139 222 188 230 226 203", "#090b12", 5.0, 0.72),
            ("M117 196 C143 216 186 223 220 200", "#63e6d2", 2.6, 0.84),
        ],
        "markings": [
            ("M139 121 L151 132 M154 112 L165 126 M172 111 L181 123 M186 120 L194 132", "#8868f3", 2.4, 0.72),
        ],
        "effects": [
            ("M203 74 L208 67 M224 90 L232 85 M234 116 L243 114", "#b5fff2", 2.5, 0.78),
        ],
    },
    "fate-fabric": {
        "title": "Fate Fabric folded-textile recreation",
        "description": "Faithful Fate Fabric resource reconstruction with violet seam stitches and a turquoise fold highlight.",
        "linework": [
            ("M92 72 C116 87 147 88 184 78", "#090b12", 4.8, 0.74),
            ("M96 69 C121 82 150 83 181 76", "#63e6d2", 2.5, 0.88),
        ],
        "markings": [
            ("M112 151 L119 157 M128 143 L135 150 M145 137 L152 144 M161 134 L168 141", "#8868f3", 3.2, 0.88),
        ],
        "effects": [
            ("M76 123 C69 139 71 157 81 171", "#b5fff2", 2.0, 0.72),
        ],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", choices=sorted(OVERLAYS), required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def layer(parent: ET.Element, identifier: str, label: str) -> ET.Element:
    return ET.SubElement(
        parent,
        f"{{{SVG}}}g",
        {
            "id": identifier,
            f"{{{INKSCAPE}}}groupmode": "layer",
            f"{{{INKSCAPE}}}label": label,
        },
    )


def add_paths(parent: ET.Element, paths: list[tuple[str, str, float, float]]) -> None:
    for index, (data, color, width, opacity) in enumerate(paths, start=1):
        ET.SubElement(
            parent,
            f"{{{SVG}}}path",
            {
                "id": f"{parent.attrib['id']}-{index}",
                "d": data,
                "fill": "none",
                "stroke": color,
                "stroke-width": str(width),
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "opacity": str(opacity),
            },
        )


def main() -> None:
    args = parse_args()
    plan = OVERLAYS[args.slug]
    tree = ET.parse(args.input)
    root = tree.getroot()
    root.set("viewBox", f"0 0 {root.attrib['width']} {root.attrib['height']}")
    root.set("role", "img")
    root.set("aria-labelledby", f"{args.slug}-title {args.slug}-description")

    original_children = list(root)
    for child in original_children:
        root.remove(child)

    title = ET.SubElement(root, f"{{{SVG}}}title", {"id": f"{args.slug}-title"})
    title.text = str(plan["title"])
    description = ET.SubElement(root, f"{{{SVG}}}desc", {"id": f"{args.slug}-description"})
    description.text = str(plan["description"])

    silhouette = layer(root, "silhouette", "Silhouette and traced reconstruction")
    base = layer(silhouette, "base-colors", "Base colors and material forms")
    for child in original_children:
        base.append(copy.deepcopy(child))

    linework = layer(root, "linework", "Authored edge hierarchy")
    add_paths(linework, plan["linework"])
    markings = layer(root, "internal-markings", "Authored internal markings")
    add_paths(markings, plan["markings"])
    effects = layer(root, "effects", "Site-style rim light and glints")
    add_paths(effects, plan["effects"])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(tree, space="  ")
    tree.write(args.output, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    main()
