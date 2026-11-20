// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Host } from "../host";
import { readRainbowEnabled, saveRainbowEnabled, readRainbowKeyboardPreset, saveRainbowKeyboardPreset } from "./rainbow";
/** Rainbow-only pane. Archived Bionic/Gradient preference values are neither shown nor written. */
export function mountPane(host: Host, root: HTMLElement, refresh: () => void, status: () => unknown): () => void {
  const input = root.querySelector<HTMLInputElement>('[data-rb-pref="rainbowEnabled"]');
  const keyboard = root.querySelector<HTMLSelectElement>('[data-rb-pref="rainbowKeyboardPreset"]');
  const statusButton = root.querySelector("#rainbowbionic-refresh-status");
  function render() {
    if (input) input.checked = readRainbowEnabled(host);
    if (keyboard) keyboard.value = readRainbowKeyboardPreset(host);
    const output = root.querySelector("#rainbowbionic-status");
    if (output) output.textContent = JSON.stringify(status(), null, 2);
  }
  function change() {
    if (!input) return;
    saveRainbowEnabled(host, input.checked); refresh(); render();
  }
  function changeKeyboard() {
    if (!keyboard) return;
    saveRainbowKeyboardPreset(host, keyboard.value === "brackets" ? "brackets" : "arrows");
    refresh(); render();
  }
  input?.addEventListener("change", change);
  keyboard?.addEventListener("change", changeKeyboard);
  statusButton?.addEventListener("click", render);
  render();
  return () => {
    input?.removeEventListener("change", change);
    keyboard?.removeEventListener("change", changeKeyboard);
    statusButton?.removeEventListener("click", render);
  };
}
