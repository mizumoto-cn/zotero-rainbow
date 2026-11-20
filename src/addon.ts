// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Host, ReadingTarget, Status, Timers, ToolbarEvent } from "./host";
import { createTextAudit, listReaders, probeReadingMode, supportsVersion } from "./compat/zotero10";
import type { TextAudit } from "./compat/zotero10";
import { readRainbowEnabled, saveRainbowEnabled, readRainbowKeyboardPreset, RAINBOW_KEYS, type RainbowKeyboardPreset } from "./preferences/rainbow";
import { mountPane } from "./preferences/pane";
import { createRainbowSession } from "./rendering/rainbow";
import type { RenderSession } from "./rendering/types";
export const ADDON_ID = "rainbowbionic@local.invalid";
function removeBinding<T>(bindings: Map<T, () => void>, element: T): void {
  const remove = bindings.get(element);
  bindings.delete(element);
  try { remove?.(); } catch { /* Closing a Zotero window can already have destroyed its DOM wrapper. */ }
}
export class RainbowBionicAddon {
  private alive = false;
  private timer: number | undefined;
  private paneID: string | undefined;
  private fingerprint = "";
  private keyboardPreset: RainbowKeyboardPreset = "arrows";
  private getKeyboardPreset = (): RainbowKeyboardPreset => this.keyboardPreset;
  private sessions = new Map<Document, { target: ReadingTarget; session: RenderSession }>();
  private buttons = new Map<HTMLButtonElement, () => void>();
  private panes = new Map<HTMLElement, () => void>();
  private lifecycle: Status = { code: "not-started", detail: "Not started" };
  private probes: (Status & { sides: ReadingTarget["side"][] })[] = [];
  private textAudit: TextAudit | undefined;
  constructor(private host: Host, private timers: Timers) {}
  async startup(): Promise<void> {
    if (this.alive) return;
    this.alive = true;
    try {
      const id = await this.host.PreferencePanes.register({
        pluginID: ADDON_ID, id: "rainbowbionic-preferences", label: "Rainbow",
        src: "content/preferences.xhtml",
      });
      if (!this.alive) { this.host.PreferencePanes.unregister(id); return; }
      this.paneID = id;
      if (!supportsVersion(this.host.version)) {
        this.lifecycle = { code: "unsupported-version", detail: "Effects safely disabled outside Zotero 10.0.x" };
        return;
      }
      this.host.Reader.registerEventListener("renderToolbar", this.onToolbar, ADDON_ID);
      this.lifecycle = { code: "started-experimental", detail: "Host hooks registered; installation/Reading Mode acceptance remains manual" };
      this.refresh();
      this.schedule();
    } catch (error) {
      this.shutdown();
      this.lifecycle = { code: "startup-failed", detail: String(error) };
      this.host.debug("[RainbowBionic] startup failed: " + String(error));
    }
  }
  private schedule(): void {
    if (!this.alive) return;
    this.timer = this.timers.setTimeout(() => {
      this.timer = undefined;
      this.refresh();
      this.schedule();
    }, 1000);
  }
  refresh = (): void => {
    if (!this.alive) return;
    if (!supportsVersion(this.host.version)) { this.clearSessions(); return; }
    try {
      const enabled = readRainbowEnabled(this.host);
      this.keyboardPreset = readRainbowKeyboardPreset(this.host);
      const fingerprint = String(enabled);
      if (fingerprint !== this.fingerprint) { this.clearSessions(); this.fingerprint = fingerprint; }
      const next = new Map<Document, ReadingTarget>();
      this.probes = [];
      for (const reader of listReaders(this.host)) {
        const probe = probeReadingMode(reader, this.host.version);
        this.probes.push({ ...probe.status, sides: probe.targets.map(target => target.side) });
        for (const target of probe.targets) next.set(target.document, target);
      }
      for (const [doc, old] of this.sessions) {
        if (next.get(doc)?.root !== old.target.root || !old.target.root.isConnected || old.session.getStatus().code === "disposed") {
          old.session.dispose(); this.sessions.delete(doc);
        }
      }
      if (enabled) {
        for (const [doc, target] of next) {
          if (!this.sessions.has(doc)) this.sessions.set(doc, { target, session: createRainbowSession(target, this.getKeyboardPreset) });
        }
      }
      for (const button of this.buttons.keys()) {
        try {
          if (!button.isConnected) { removeBinding(this.buttons, button); continue; }
          button.setAttribute("aria-pressed", String(enabled));
          button.classList.toggle("active", enabled);
          button.title = enabled ? `Rainbow sentence focus on (double-click a sentence; ${RAINBOW_KEYS[this.keyboardPreset].label} move)` : "Rainbow sentence focus off";
        } catch {
          removeBinding(this.buttons, button);
        }
      }
      for (const root of this.panes.keys()) {
        try {
          if (!root.isConnected) removeBinding(this.panes, root);
        } catch {
          removeBinding(this.panes, root);
        }
      }
    } catch (error) {
      this.clearSessions();
      this.lifecycle = { code: "refresh-failed-closed", detail: String(error) };
    }
  };
  private onToolbar = (event: ToolbarEvent): void => {
    if (!this.alive) return;
    if (probeReadingMode(event.reader, this.host.version).status.code === "not-pdf") return;
    // Toolbar DOM only. The reading document is accessed exclusively through the adapter.
    const { doc, append } = event;
    if (!doc || typeof append !== "function" || doc.querySelector("[data-rainbowbionic-toolbar]")) return;
    const button = doc.createElementNS("http://www.w3.org/1999/xhtml", "button") as HTMLButtonElement;
    button.type = "button";
    button.textContent = "R";
    button.classList.add("toolbar-button");
    button.setAttribute("data-rainbowbionic-toolbar", "true");
    button.setAttribute("aria-label", "Toggle Rainbow sentence focus");
    const click = () => { saveRainbowEnabled(this.host, !readRainbowEnabled(this.host)); this.refresh(); };
    button.addEventListener("click", click);
    this.buttons.set(button, () => { button.removeEventListener("click", click); button.remove(); });
    append(button);
    this.refresh();
  };
  mountPreferences(win: Window): void {
    if (!this.alive) return;
    const root = win.document.getElementById("rainbowbionic-preferences-root");
    if (!root) return;
    removeBinding(this.panes, root);
    this.panes.set(root, mountPane(this.host, root, this.refresh, () => this.diagnostics()));
  }
  diagnostics() {
    return {
      plugin: "Rainbow for Zotero", hostVersion: this.host.version,
      lifecycle: this.lifecycle, rainbowEnabled: readRainbowEnabled(this.host), readers: this.probes,
      rainbowKeyboardPreset: this.keyboardPreset,
      sessions: [...this.sessions.values()].map(({ target, session }) => ({ side: target.side, ...session.getStatus() })),
      evidence: "Source-shaped adapter and browser tests are not Zotero runtime verification",
    };
  }
  beginTextAudit() {
    this.clearTextAudit();
    if (!this.alive) return { code: "audit-not-started", targets: [] };
    this.textAudit = createTextAudit(this.host);
    return this.textAudit.check();
  }
  checkTextAudit() {
    return this.textAudit?.check() ?? { code: "audit-no-capture", targets: [] };
  }
  clearTextAudit(): void {
    this.textAudit?.clear();
    this.textAudit = undefined;
  }
  private clearSessions(): void {
    for (const { session } of this.sessions.values()) session.dispose();
    this.sessions.clear();
  }
  shutdown(): void {
    this.alive = false;
    this.clearTextAudit();
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
    try { this.host.Reader.unregisterEventListener("renderToolbar", this.onToolbar); } catch { /* Host may be tearing down. */ }
    this.clearSessions();
    for (const button of this.buttons.keys()) removeBinding(this.buttons, button);
    for (const pane of this.panes.keys()) removeBinding(this.panes, pane);
    if (this.paneID !== undefined) { this.host.PreferencePanes.unregister(this.paneID); this.paneID = undefined; }
    this.probes = [];
    this.lifecycle = { code: "stopped", detail: "Listeners, timers, visual resources and preference UI bindings removed" };
  }
}
