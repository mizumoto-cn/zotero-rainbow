# Rainbow for Zotero

Rainbow is an add-on for Zotero's native PDF Reading Mode. It helps you keep your place in a paper by giving the current sentence a subtle background.

Version 0.1.0-alpha.3 is an Alpha preview. This preview was tested on Zotero 10.0.9 on macOS. Other platforms and Zotero builds are unverified.

## Install

1. Build the XPI using the steps below. Published XPI files will be available on the [Releases page](https://github.com/mizumoto-cn/zotero-rainbow/releases).
2. In Zotero, open **Tools → Plugins** and install the XPI file.

Alpha updates are manual. To update, install the newer XPI the same way.

## Use

1. Open a PDF in Reading Mode.
2. Turn on Rainbow with the **R** button in the reader toolbar or in **Settings → Rainbow**. Rainbow is off by default.
3. Double-click the sentence you are reading.
4. Press **↑ / ↓** to move to the previous or next sentence. **Settings → Rainbow** also offers **[ / ]** for these moves.
5. Press **Esc** to clear the focus.

While Rainbow sentence focus is enabled, its double-click gesture in PDF Reading Mode may conflict with features or plugins that also use double-click to mark text.

## Privacy

Rainbow requires no personal data or library upload.

## Build from source

With Node.js 22 or newer, run these commands in a checkout of this repository:

```sh
npm ci
npm run build
```

The build writes the add-on to `.scaffold/build/rainbowbionic.xpi`.

## License

Rainbow for Zotero is licensed under AGPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
