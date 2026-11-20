// SPDX-License-Identifier: AGPL-3.0-or-later
import { RainbowBionicAddon } from "./addon";
import type { Host, Timers } from "./host";
declare const _globalThis: { Zotero: Host; timerApi: Timers; RainbowBionic?: RainbowBionicAddon };
if (typeof _globalThis !== "undefined") {
  _globalThis.RainbowBionic = new RainbowBionicAddon(_globalThis.Zotero, _globalThis.timerApi);
}
