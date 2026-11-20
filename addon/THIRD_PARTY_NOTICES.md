# Third-party code and licenses

Rainbow for Zotero is distributed under **AGPL-3.0-or-later**. See LICENSE.

## Code adapted and distributed

The minimal bootstrap structure, `.env.example` variable names and `zotero-plugin.config.ts` build configuration are adapted from
[windingwind/zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template/tree/306d4e2a0959a7b2f5e44bb38169fb25f841dbaf)
(AGPL-3.0-or-later in package metadata; AGPL v3 LICENSE). The template bootstrap identifies
[Zotero Make It Red](https://github.com/zotero/make-it-red) and Zotero developer documentation as its sources;
that provenance notice is retained in `addon/bootstrap.js`. RainbowBionic changes: no sample features/toolkit,
relative resource loading, cancellation-safe startup, isolated host adapter, and owned cleanup.
Original upstream attribution is not transferred to the RainbowBionic contributors.

## Investigated, not copied into this plugin

| Project | Verified license | Actual use |
|---|---|---|
| Zotero / zotero/reader | Zotero headers: AGPL-3.0-or-later; reader COPYING: AGPLv3 | Read host and reader source to identify private fields/mapping; no host implementation bundled |
| windingwind/bionic-for-zotero | AGPL v3 LICENSE | Read PDF hooks and font/segmentation logic; no source copied |
| corollari/waspline-reader | The Unlicense | Read gradient algorithm; no source, icons or extension assets copied |
| corollari/js-line-wrap-detector, inviz | MIT, Copyright (c) 2014 Xavier Damman | Read wrapping algorithm; no source copied |

WaspLine's top-level Unlicense does not erase the separate licenses of its dependencies or assets.
No Zotero/Bionic/WaspLine logos, icons, commercial brand materials, fonts or PDF files are distributed.
The project is independent and has no claimed endorsement from Zotero or Bionic Reading.

## Development tools

TypeScript, @types/node and zotero-plugin-scaffold are development dependencies, not bundled runtime
libraries. Their upstream licenses remain applicable to those packages. There are no runtime npm
packages or remote services. Before publishing any binaries after adding dependencies, review the
actual bundle and update this file; do not infer license compatibility merely from inspiration.

AGPL distribution requires making the corresponding source available to recipients under its terms,
preserving notices and indicating modifications. This delivery includes the editable source and build
scripts alongside the experimental XPI.
