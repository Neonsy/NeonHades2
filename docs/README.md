# [NeonHades2](https://hades2.guide.neonspace.dev/)

NeonHades2 is an unofficial _Hades II_ guide whose published facts are tied to a recorded Steam build.
The repository contains the static website, the data pipeline, the project-owned exporter mods, and the authored guide content.

The repository does not contain raw game files, saves, dialogue exports, or normalized local datasets.
It contains a sanitized public snapshot with the reader-facing facts required to build the website from a fresh clone.

## Choose your task

- To run or build the website, follow the [website guide](/project/web/README.md).
- To create the complete NeonHades2 dataset from your own copy of _Hades II_, start with the [data tooling overview](/project/data/README.md).
- To run the acquisition from a fresh clone, follow [Acquire the complete dataset](/project/data/ACQUIRE-DATA.md).
- To reproduce verification and create a website publication artifact, follow [Verify and publish the dataset](/project/data/VERIFY-AND-PUBLISH.md).

## What the complete dataset contains

The data pipeline collects the guide-relevant facts covered by the repository contract.
That scope includes Boons, weapons, aspects, ranks, Daedalus Hammers, Arcana Cards, Keepsakes, Familiars, Hexes, incantations, routes, regions, rooms, encounters, enemies, resources, Oath conditions, Testaments, relationships, prophecies, achievements, and named unlock requirements.

The private source snapshot is intentionally broader than the published guide data.
It excludes binary art, audio, video, packages, saves, and executable bodies, but retains local Lua and SJSON definitions so future factual fields do not require an obsolete game build.
Dialogue bodies and non-English localization remain private source evidence and never enter normalized or public artifacts.

## Data ownership and storage

You must own the Steam version of _Hades II_ to run the acquisition.
The pipeline privately snapshots every Lua and SJSON definition from your installation and reads processed game tables through a project-owned exporter.
The runtime archive preserves shared table identity but excludes player state, runtime caches, Lua libraries, and mod-loader namespaces.

Every source acquisition, complete raw runtime export, processed-table evidence archive, and generated dataset stays under an ignored `.local` directory.
Do not commit or publish those files.
Of the generated data artifacts, only the sanitized website snapshot under `/project/web/src/content/publication.json` belongs in Git.

## License

Original NeonHades2 source code is licensed under the [Apache License 2.0](/LICENSE).

## Disclaimer

NeonHades2 is an unofficial fan project and is not affiliated with or endorsed by Supergiant Games.
_Hades II_ and its related names and assets belong to their respective owners.
