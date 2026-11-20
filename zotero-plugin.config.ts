// Adapted from windingwind/zotero-plugin-template (AGPL-3.0-or-later).
// See THIRD_PARTY_NOTICES.md. No release/upload/update URLs are configured.
import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  xpiName: "rainbowbionic",
  updateURL: "",
  xpiDownloadLink: "",
  release: { github: { enable: "false" } },
  build: {
    assets: ["addon/**/*.*", "addon/LICENSE"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      buildVersion: pkg.version,
    },
    makeManifest: { enable: false },
    // prefs.js already uses fully qualified keys. Do not add a second prefix.
    prefs: { prefixPrefKeys: false, dts: false },
    fluent: { dts: false },
    esbuildOptions: [{
      entryPoints: ["src/index.ts"], bundle: true, format: "iife",
      target: "firefox128",
      outfile: ".scaffold/build/addon/content/scripts/rainbowbionic.js",
    }],
  },
});
