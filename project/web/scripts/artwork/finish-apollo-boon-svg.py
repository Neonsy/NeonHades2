# /// script
# dependencies = [
#   "opencv-python-headless==5.0.0.93",
# ]
# ///

from __future__ import annotations

import argparse
import copy
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2


SVG = "http://www.w3.org/2000/svg"
INKSCAPE = "http://www.inkscape.org/namespaces/inkscape"
ET.register_namespace("", SVG)
ET.register_namespace("inkscape", INKSCAPE)


PLANS: dict[str, dict[str, object]] = {
    "nova-strike": {
        "title": "Nova Strike solar-scroll reconstruction",
        "description": "Apollo attack boon with preserved solar scroll, a turquoise page-edge glint, and engraved lower-scroll notches.",
        "linework": [("M25 62 C34 68 50 69 64 59", "#090b12", 2.2, .72), ("M29 64 C39 67 52 66 61 60", "#63e6d2", 1.15, .92)],
        "markings": [("M34 65 L36 62 M43 67 L44 63 M52 65 L53 62", "#f2bd57", 1.2, .9)],
        "effects": [("M17 47 C13 39 15 30 21 23", "#b5fff2", .9, .72)],
    },
    "blinding-rush": {
        "title": "Blinding Rush winged-boot reconstruction",
        "description": "Apollo sprint boon with preserved winged boot, a turquoise speed edge, and violet heel sparks.",
        "linework": [("M24 62 C35 66 49 63 59 53", "#63e6d2", 1.2, .88)],
        "markings": [("M27 59 L31 55 M34 63 L38 58", "#8868f3", 1.0, .86)],
        "effects": [("M18 46 C13 38 15 29 22 23", "#b5fff2", .9, .7)],
    },
    "solar-ring": {
        "title": "Solar Ring dawn-circle reconstruction",
        "description": "Apollo cast boon with preserved sun gate, a turquoise binding circle, and violet cardinal notches.",
        "linework": [("M27 64 C37 69 54 69 64 63", "#63e6d2", 1.2, .9)],
        "markings": [("M45 23 V28 M25 44 H30 M60 44 H65", "#8868f3", 1.0, .86)],
        "effects": [("M34 30 C39 25 50 25 56 30", "#fff0a2", 1.0, .76)],
    },
    "nova-flourish": {
        "title": "Nova Flourish twin-scroll reconstruction",
        "description": "Apollo special boon with preserved paired scrolls, a turquoise page seam, and gold strike cuts.",
        "linework": [("M31 58 C40 62 51 61 60 55", "#63e6d2", 1.15, .9)],
        "markings": [("M39 64 L42 59 M48 63 L50 58", "#f2bd57", 1.1, .88)],
        "effects": [("M59 27 C65 33 67 40 65 47", "#b5fff2", .9, .72)],
    },
    "prominence-flare": {
        "title": "Prominence Flare solar-arch reconstruction",
        "description": "Apollo omega-cast boon with preserved solar arch, a turquoise horizon, and violet flame divisions.",
        "linework": [("M24 65 C37 68 53 68 66 65", "#63e6d2", 1.25, .9)],
        "markings": [("M31 48 L28 42 M45 45 V37 M59 48 L62 42", "#8868f3", 1.0, .82)],
        "effects": [("M32 57 C37 51 53 51 59 57", "#fff0a2", 1.0, .78)],
    },
    "super-nova": {
        "title": "Super Nova orbiting-sun reconstruction",
        "description": "Apollo cast-area boon with preserved bursting sun, a turquoise orbit, and violet ray accents.",
        "linework": [("M23 51 C30 66 53 71 68 56", "#63e6d2", 1.15, .88)],
        "markings": [("M25 27 L29 31 M60 24 L58 30 M69 45 L64 45", "#8868f3", 1.0, .86)],
        "effects": [("M34 35 C41 29 51 30 57 37", "#fff0a2", .9, .74)],
    },
    "light-smite": {
        "title": "Light Smite judgment-skull reconstruction",
        "description": "Apollo retaliation boon with preserved skull and solar blade, a turquoise brow, and violet fracture marks.",
        "linework": [("M29 54 C38 50 51 50 61 54", "#63e6d2", 1.15, .9)],
        "markings": [("M38 60 L36 66 M51 60 L53 66", "#8868f3", 1.0, .86)],
        "effects": [("M45 20 V32", "#fff0a2", 1.0, .76)],
    },
    "self-healing": {
        "title": "Self Healing restorative-spiral reconstruction",
        "description": "Apollo elemental boon with preserved healing spiral, a turquoise wrap, and violet restorative ticks.",
        "linework": [("M23 52 C31 65 49 69 64 57", "#63e6d2", 1.2, .9)],
        "markings": [("M27 34 L31 37 M58 31 L55 35 M66 48 L61 49", "#8868f3", 1.0, .84)],
        "effects": [("M33 48 C36 39 47 34 55 39", "#b5fff2", .9, .72)],
    },
    "lucid-gain": {
        "title": "Lucid Gain radiant-seal reconstruction",
        "description": "Apollo magick boon with preserved pentagram sun, a turquoise inner seal, and violet node marks.",
        "linework": [("M33 45 C33 36 39 31 46 31 C55 31 61 38 61 46", "#63e6d2", 1.1, .88)],
        "markings": [("M45 31 V36 M34 49 L39 47 M56 48 L61 50", "#8868f3", .95, .86)],
        "effects": [("M29 65 C39 69 52 69 62 64", "#fff0a2", 1.0, .74)],
    },
    "perfect-image": {
        "title": "Perfect Image mirrored-sun reconstruction",
        "description": "Apollo damage boon with preserved mirrored sun curls, a turquoise symmetry line, and violet jewel points.",
        "linework": [("M45 26 C39 34 39 41 45 47 C51 53 51 60 45 66", "#63e6d2", 1.15, .9)],
        "markings": [("M28 44 L33 45 M57 45 L62 44", "#8868f3", 1.0, .84)],
        "effects": [("M34 31 C39 27 51 27 56 32", "#b5fff2", .9, .72)],
    },
    "back-burner": {
        "title": "Back Burner trailing-scroll reconstruction",
        "description": "Apollo blind boon with preserved trailing scroll, a turquoise page edge, and violet ember cuts.",
        "linework": [("M28 59 C37 64 50 64 60 57", "#63e6d2", 1.2, .9)],
        "markings": [("M61 31 L66 27 M65 42 L71 40", "#8868f3", 1.0, .86)],
        "effects": [("M22 47 C18 39 19 31 25 25", "#fff0a2", .9, .72)],
    },
    "dazzling-display": {
        "title": "Dazzling Display twin-star reconstruction",
        "description": "Apollo daze boon with preserved twin stars, a turquoise connecting arc, and violet burst notches.",
        "linework": [("M30 56 C39 62 52 61 61 54", "#63e6d2", 1.2, .9)],
        "markings": [("M28 31 L24 27 M61 29 L66 25 M68 49 L73 49", "#8868f3", 1.0, .86)],
        "effects": [("M39 36 C43 31 50 31 54 36", "#b5fff2", .9, .74)],
    },
    "exceptional-talent": {
        "title": "Exceptional Talent doubled-omega reconstruction",
        "description": "Apollo repeat boon with preserved paired omega curls, a turquoise lower seal, and violet inner cuts.",
        "linework": [("M26 62 C36 67 53 67 64 62", "#63e6d2", 1.2, .9)],
        "markings": [("M34 50 L38 47 M52 47 L56 50", "#8868f3", 1.0, .84)],
        "effects": [("M28 28 C34 22 40 23 45 29 C50 23 57 23 62 29", "#fff0a2", .9, .72)],
    },
    "tropical-cyclone": {
        "title": "Tropical Cyclone crystal-wind reconstruction",
        "description": "Apollo and Poseidon duo boon with preserved blue crystal, a turquoise blade edge, and violet cyclone node.",
        "linework": [("M37 24 C31 38 31 54 38 67", "#63e6d2", 1.25, .92)],
        "markings": [("M51 29 L56 34 M51 59 L56 55", "#8868f3", 1.0, .88)],
        "effects": [("M24 63 C34 70 54 70 66 61", "#b5fff2", .9, .74)],
    },
    "sunny-disposition": {
        "title": "Sunny Disposition solar-heart reconstruction",
        "description": "Apollo and Aphrodite duo boon with preserved heart, a turquoise heart seam, and violet solar crown.",
        "linework": [("M45 38 C39 31 30 34 30 43 C30 52 39 59 45 65 C51 59 60 52 60 43 C60 34 51 31 45 38", "#63e6d2", 1.05, .82)],
        "markings": [("M36 27 L34 22 M54 27 L57 22", "#8868f3", 1.0, .86)],
        "effects": [("M29 65 C38 70 52 70 61 64", "#fff0a2", .9, .72)],
    },
    "rude-awakening": {
        "title": "Rude Awakening impact-stone reconstruction",
        "description": "Apollo and Hephaestus duo boon with preserved struck stone, turquoise fractures, and violet impact cuts.",
        "linework": [("M39 34 L45 44 L40 52 M54 39 L48 47 L53 57", "#63e6d2", 1.25, .92)],
        "markings": [("M29 29 L24 24 M62 29 L68 24 M68 58 L73 62", "#8868f3", 1.0, .86)],
        "effects": [("M27 65 C38 70 54 70 65 63", "#fff0a2", .9, .72)],
    },
    "sun-worshiper": {
        "title": "Sun Worshiper moon-vessel reconstruction",
        "description": "Apollo and Selene duo boon with preserved lunar vessel, a turquoise basin, and violet central jewel.",
        "linework": [("M27 61 C38 67 53 67 64 61", "#63e6d2", 1.3, .92)],
        "markings": [("M45 49 L41 55 L45 60 L49 55 Z", "#8868f3", .95, .88)],
        "effects": [("M33 29 C38 24 52 24 57 29", "#b5fff2", .9, .74)],
    },
    "extra-dose": {
        "title": "Extra Dose solar-lyre reconstruction",
        "description": "Apollo repeat-strike boon with preserved lyre, turquoise lower strings, and violet tuning marks.",
        "linework": [("M34 62 C41 65 49 65 56 62", "#63e6d2", 1.2, .92)],
        "markings": [("M38 29 V58 M45 26 V60 M52 29 V58", "#8868f3", .85, .72)],
        "effects": [("M26 66 C38 71 54 71 65 65", "#b5fff2", .9, .72)],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-directory", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--alpha-directory", type=Path, required=True)
    return parser.parse_args()


def layer(parent: ET.Element, identifier: str, label: str) -> ET.Element:
    return ET.SubElement(parent, f"{{{SVG}}}g", {
        "id": identifier,
        f"{{{INKSCAPE}}}groupmode": "layer",
        f"{{{INKSCAPE}}}label": label,
    })


def add_paths(parent: ET.Element, paths: list[tuple[str, str, float, float]]) -> None:
    for index, (data, color, width, opacity) in enumerate(paths, start=1):
        ET.SubElement(parent, f"{{{SVG}}}path", {
            "id": f"{parent.attrib['id']}-{index}",
            "d": data,
            "fill": "none",
            "stroke": color,
            "stroke-width": str(width),
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "opacity": str(opacity),
        })


def alpha_path(alpha_path: Path) -> str:
    image = cv2.imread(str(alpha_path), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError(f"Expected RGBA alpha source: {alpha_path}")
    mask = (image[:, :, 3] > 0).astype("uint8")
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [max(contours, key=cv2.contourArea)] if contours else []
    segments: list[str] = []
    for contour in contours:
        polygon = cv2.approxPolyDP(contour, .35, True).reshape(-1, 2)
        if len(polygon) < 3:
            continue
        segments.append(f"M{polygon[0, 0]} {polygon[0, 1]}")
        segments.extend(f"L{x} {y}" for x, y in polygon[1:])
        segments.append("Z")
    if not segments:
        raise RuntimeError(f"Alpha source has no visible contour: {alpha_path}")
    return " ".join(segments)


def finish(slug: str, plan: dict[str, object], input_path: Path, alpha_source: Path, output_path: Path) -> None:
    tree = ET.parse(input_path)
    root = tree.getroot()
    root.set("viewBox", f"0 0 {root.attrib['width']} {root.attrib['height']}")
    root.set("role", "img")
    root.set("aria-labelledby", f"{slug}-title {slug}-description")
    original_children = list(root)
    for child in original_children:
        root.remove(child)

    definitions = ET.SubElement(root, f"{{{SVG}}}defs")
    clipping = ET.SubElement(definitions, f"{{{SVG}}}clipPath", {"id": f"{slug}-alpha-clip"})
    ET.SubElement(clipping, f"{{{SVG}}}path", {"d": alpha_path(alpha_source)})
    ET.SubElement(root, f"{{{SVG}}}title", {"id": f"{slug}-title"}).text = str(plan["title"])
    ET.SubElement(root, f"{{{SVG}}}desc", {"id": f"{slug}-description"}).text = str(plan["description"])
    silhouette = layer(root, "silhouette", "Silhouette and traced reconstruction")
    silhouette.set("clip-path", f"url(#{slug}-alpha-clip)")
    base = layer(silhouette, "base-colors", "Base colors and material forms")
    for child in original_children:
        base.append(copy.deepcopy(child))
    add_paths(layer(root, "linework", "Authored edge hierarchy"), plan["linework"])
    add_paths(layer(root, "internal-markings", "Authored identifying marks"), plan["markings"])
    add_paths(layer(root, "effects", "Site-style rim light and glints"), plan["effects"])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(tree, space="  ")
    tree.write(output_path, encoding="utf-8", xml_declaration=True)


def main() -> None:
    args = parse_args()
    finished = 0
    for slug, plan in PLANS.items():
        input_path = args.input_directory / f"{slug}-baseline.svg"
        if not input_path.exists():
            raise FileNotFoundError(input_path)
        finish(
            slug,
            plan,
            input_path,
            args.alpha_directory / f"{slug}.png",
            args.output_directory / f"{slug}.svg",
        )
        finished += 1
    print(f"Finished {finished} Apollo boon masters")


if __name__ == "__main__":
    main()
