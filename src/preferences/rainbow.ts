// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Host } from "../host";
const PREFS_PREFIX = "extensions.zotero.rainbowbionic.";
/** Fresh, independent preference. Archived Bionic/Gradient values never enable Rainbow. */
export const RAINBOW_PREF = PREFS_PREFIX + "rainbowEnabled";
export const RAINBOW_KEYBOARD_PREF = PREFS_PREFIX + "rainbowKeyboardPreset";
export const RAINBOW_KEYS = {
  arrows: { previous: "ArrowUp", next: "ArrowDown", label: "↑ / ↓" },
  brackets: { previous: "[", next: "]", label: "[ / ]" },
} as const;
export type RainbowKeyboardPreset = keyof typeof RAINBOW_KEYS;
export function readRainbowKeyboardPreset(host: Host): RainbowKeyboardPreset {
  try { return host.Prefs.get(RAINBOW_KEYBOARD_PREF, true) === "brackets" ? "brackets" : "arrows"; }
  catch { return "arrows"; }
}
export function saveRainbowKeyboardPreset(host: Host, value: RainbowKeyboardPreset): void {
  host.Prefs.set(RAINBOW_KEYBOARD_PREF, value === "brackets" ? "brackets" : "arrows", true);
}
export function readRainbowEnabled(host: Host): boolean {
  try { return host.Prefs.get(RAINBOW_PREF, true) === true; }
  catch { return false; }
}
export function saveRainbowEnabled(host: Host, value: boolean): void {
  host.Prefs.set(RAINBOW_PREF, value === true, true);
}
