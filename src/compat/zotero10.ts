// SPDX-License-Identifier: AGPL-3.0-or-later
// ALL private Zotero/reader reads belong in this file. No private writes/hooks.
// Audited sources and revision mismatch limits: docs/ARCHITECTURE.md.
import type { Host, ReadingTarget, Status } from "../host";
type ObjectLike = Record<string, unknown>;
function object(value: unknown): ObjectLike | undefined {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? value as ObjectLike : undefined;
}
export function supportsVersion(version: string): boolean {
  return /^10\.0(?:[.\-]|$)/.test(version);
}
export function listReaders(host: Host): unknown[] {
  const registry = object(host.Reader);
  return Array.isArray(registry?._readers) ? registry._readers.slice() : [];
}
export interface Probe { status: Status; targets: ReadingTarget[]; }
export function probeReadingMode(reader: unknown, version: string): Probe {
  const empty = (code: string, detail: string): Probe => ({ status: { code, detail }, targets: [] });
  if (!supportsVersion(version)) return empty("unsupported-version", "Only the 10.0 development compatibility window is allowed");
  try {
    const outer = object(reader);
    if (!outer || outer.type !== "pdf") return empty("not-pdf", "Only native PDF Reading Mode is in scope");
    const internal = object(outer._internalReader);
    const state = object(internal?._state);
    if (!internal || !state) return empty("adapter-unavailable", "Expected internal reader/state not accessible");
    const targets: ReadingTarget[] = [];
    for (const side of ["primary", "secondary"] as const) {
      if (state[side + "ReadingModeEnabled"] !== true) continue;
      const view = object(internal["_" + side + "SDTView"]);
      if (!view || view._destroyed === true || typeof view.toSelector !== "function" ||
          typeof view.toDisplayedRange !== "function") continue;
      const doc = view._iframeDocument as Document | undefined;
      if (!doc || doc.nodeType !== 9 || !doc.defaultView || doc.defaultView.closed) continue;
      const root = doc.getElementById("sdt-content");
      if (!root || root.localName !== "article" || !root.classList.contains("sdt-pdf") ||
          !root.querySelector("[data-ref-path] [data-text-index]")) continue;
      targets.push({ document: doc, root, side });
    }
    return targets.length
      ? { status: { code: "source-shape-matched", detail: "Private SDT shape matched; NOT a Zotero runtime acceptance result" }, targets }
      : empty("waiting-reading-mode", "No active, ready native PDF SDT document");
  } catch {
    return empty("adapter-access-denied", "Private field or cross-compartment access failed; no document was changed");
  }
}

interface RangeSnapshot {
  range: Range; start: Node; end: Node; startOffset: number; endOffset: number; text: string;
}
interface TextSnapshot {
  reader: unknown; target: ReadingTarget; view: ObjectLike;
  nodes: Text[]; data: string[]; text: string; ranges: RangeSnapshot[]; selectionCode: string;
  cache: { context: ObjectLike; entries: unknown[]; text: string;
    records: { entry: ObjectLike; node: Node; start: number; end: number }[] } | undefined;
}
export interface TextAudit {
  check(): { code: string; targets: ReturnType<typeof checkSnapshot>[] };
  clear(): void;
}
function textNodes(target: ReadingTarget): Text[] {
  const walker = target.document.createTreeWalker(target.root, 4);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}
function sameReferences(before: unknown[], after: unknown[]): boolean {
  return before.length === after.length && before.every((value, index) => value === after[index]);
}
function ownValue(value: ObjectLike, key: string): unknown {
  // Never invoke the lazy search-context getter: only inspect an already warmed cache.
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}
function cachedNodes(view: ObjectLike): TextSnapshot["cache"] {
  const context = object(ownValue(view, "_searchContext"));
  const entries = context && ownValue(context, "charDataRanges");
  const text = context && ownValue(context, "text");
  if (!context || !Array.isArray(entries) || typeof text !== "string") return undefined;
  const length = ownValue(object(entries)!, "length");
  if (typeof length !== "number" || !length) return undefined;
  const records: NonNullable<TextSnapshot["cache"]>["records"] = [];
  for (let index = 0; index < length; index++) {
    // Array slots and fields must be own data descriptors, never accessors.
    const entry = object(ownValue(object(entries)!, String(index)));
    if (!entry) return undefined;
    const node = ownValue(entry, "charData") as Node | undefined;
    const start = ownValue(entry, "start"), end = ownValue(entry, "end");
    if (!node || node.nodeType !== 3 || typeof start !== "number" || !Number.isFinite(start) ||
        typeof end !== "number" || !Number.isFinite(end)) return undefined;
    // Copy scalar data; the retained host objects are identity evidence only.
    records.push({ entry, node, start, end });
  }
  return { context, entries, text, records };
}
function checkSnapshot(snapshot: TextSnapshot, version: string) {
  const { target, view, cache, ranges } = snapshot;
  const active = probeReadingMode(snapshot.reader, version).targets.some(next =>
    next.side === target.side && next.document === target.document && next.root === target.root);
  const internal = object(object(snapshot.reader)?._internalReader);
  const viewUnchanged = internal?.["_" + target.side + "SDTView"] === view;
  const currentCache = cachedNodes(view);
  const selection = target.document.getSelection();
  const selectedRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
  const originalNodesUnchanged = sameReferences(snapshot.nodes, textNodes(target));
  const originalTextDataUnchanged = snapshot.nodes.every((node, index) => node.data === snapshot.data[index]);
  const originalNodesConnected = snapshot.nodes.every(node => node.isConnected && target.root.contains(node));
  const rootTextUnchanged = target.root.textContent === snapshot.text;
  const searchCacheUnchanged = !!cache && !!currentCache &&
    cache.context === currentCache.context && cache.entries === currentCache.entries &&
    cache.text === currentCache.text && cache.records.length === currentCache.records.length &&
    cache.records.every((record, index) => {
      const current = currentCache.records[index]!;
      return record.entry === current.entry && record.node === current.node &&
        record.start === current.start && record.end === current.end;
    });
  const cachedNodesConnected = !!cache && cache.records.every(({ node }) =>
    node.isConnected && node.ownerDocument === target.document && target.document.body.contains(node));
  const rangeEndpointsUnchanged = ranges.length > 0 && ranges.every(({ range, start, end, startOffset, endOffset }) =>
    range.startContainer === start && range.endContainer === end &&
    range.startOffset === startOffset && range.endOffset === endOffset);
  const rangeTextUnchanged = ranges.length > 0 && ranges.every(({ range, text }) => range.toString() === text);
  const selectionRangesUnchanged = ranges.length > 0 && sameReferences(ranges.map(item => item.range), selectedRanges);
  const ready = !!cache && !!currentCache && ranges.length > 0 && snapshot.nodes.length > 0;
  const unchanged = active && viewUnchanged && originalNodesUnchanged && originalTextDataUnchanged && originalNodesConnected && rootTextUnchanged &&
    searchCacheUnchanged && cachedNodesConnected && rangeEndpointsUnchanged && rangeTextUnchanged && selectionRangesUnchanged;
  return {
    side: target.side, code: !ready ? "audit-incomplete" : unchanged ? "audit-unchanged" : "audit-changed",
    active, viewUnchanged, originalTextNodeCount: snapshot.nodes.length,
    originalNodesUnchanged, originalTextDataUnchanged, originalNodesConnected, rootTextUnchanged,
    searchCacheCode: cache ? "search-cache-captured" : "search-cache-not-warmed-or-unsupported",
    cachedTextNodeCount: cache?.records.length ?? 0, searchCacheUnchanged, cachedNodesConnected,
    selectionCode: snapshot.selectionCode, capturedRangeCount: ranges.length,
    rangeEndpointsUnchanged, rangeTextUnchanged, selectionRangesUnchanged,
  };
}
export function createTextAudit(host: Host): TextAudit {
  let snapshots: TextSnapshot[] = [];
  let captureFailed = false;
  try {
    for (const reader of listReaders(host)) {
      for (const target of probeReadingMode(reader, host.version).targets) {
        const internal = object(object(reader)?._internalReader);
        const view = object(internal?.["_" + target.side + "SDTView"]);
        if (!view) continue;
        const selection = target.document.getSelection();
        const ranges: RangeSnapshot[] = [];
        for (let index = 0; index < (selection?.rangeCount ?? 0); index++) {
          const range = selection!.getRangeAt(index);
          if (!target.root.contains(range.commonAncestorContainer)) continue;
          ranges.push({ range, start: range.startContainer, end: range.endContainer,
            startOffset: range.startOffset, endOffset: range.endOffset, text: range.toString() });
        }
        const nodes = textNodes(target);
        snapshots.push({ reader, target, view, nodes, data: nodes.map(node => node.data), text: target.root.textContent ?? "",
          ranges, selectionCode: ranges.length ? "selection-captured" : selection?.rangeCount ? "off-root-selection" : "no-selection",
          cache: cachedNodes(view) });
      }
    }
  } catch { snapshots = []; captureFailed = true; }
  return {
    check() {
      if (captureFailed) return { code: "audit-access-denied", targets: [] };
      if (!snapshots.length) return { code: "audit-no-capture", targets: [] };
      try { return { code: "audit-checked", targets: snapshots.map(snapshot => checkSnapshot(snapshot, host.version)) }; }
      catch { return { code: "audit-access-denied", targets: [] }; }
    },
    clear() { snapshots = []; captureFailed = false; },
  };
}
