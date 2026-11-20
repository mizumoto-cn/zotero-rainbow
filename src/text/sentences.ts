// SPDX-License-Identifier: AGPL-3.0-or-later
// Read-only sentence spans over original SDT Text nodes. No DOM writes, splitting or normalization.

/** Offsets are UTF-16 code units in the joined block text, matching DOM Range offsets. */
export interface SentenceSpan {
  /** Visible sentence without surrounding whitespace. */
  start: number; end: number;
}
/**
 * UAX #29 breaks after these abbreviations when an uppercase word or a label such as S1/A3
 * follows. The merge does not depend on engine-specific suppressions; it is tested on V8 only,
 * Gecko segmentation is unverified. A sentence that genuinely ends with one of them is merged
 * with the next; that gap is accepted and recorded.
 */
const ABBREVIATION = /(?:^|[\s([{"'“‘])(?:e\.g|i\.e|E\.g|I\.e|cf|Cf|vs|viz|et\s+al|Dr|Mr|Mrs|Ms|Prof|Fig|Figs|Eq|Eqs|Ref|Refs|Sec|Secs|Tab|Ch|Vol|pp|approx|ca|resp|Suppl)\.$/u;
const CONTENT = /[\p{L}\p{N}]/u;
let segmenter: Intl.Segmenter | undefined;
export function segmentSentences(text: string): SentenceSpan[] {
  if (typeof Intl.Segmenter !== "function") throw new Error("Intl.Segmenter unavailable");
  segmenter ??= new Intl.Segmenter("en", { granularity: "sentence" });
  const merged: { start: number; end: number }[] = [];
  for (const part of segmenter.segment(text)) {
    const end = part.index + part.segment.length;
    const last = merged[merged.length - 1];
    if (last && ABBREVIATION.test(text.slice(last.start, last.end).trimEnd())) last.end = end;
    else merged.push({ start: part.index, end });
  }
  const spans: SentenceSpan[] = [];
  for (const { start, end } of merged) {
    const raw = text.slice(start, end);
    const body = raw.trim();
    if (!CONTENT.test(body)) continue;
    const lead = raw.length - raw.trimStart().length;
    spans.push({ start: start + lead, end: start + lead + body.length });
  }
  return spans;
}

/** SDT prose blocks. Nested lists/blockquotes resolve to their innermost block. */
export const PROSE_BLOCKS = "p,li,h1,h2,h3,h4,h5,h6,aside";
/** Containers that are not running prose, or whose text is retained only for host mapping. */
const NON_PROSE_BLOCK = "pre,table,figure,svg,math,.sdt-math,.sdt-source-crop,.sdt-reference," +
  "[hidden],[aria-hidden='true'],[contenteditable='true']";
const NON_PROSE_INLINE = "script,style,svg,math,img,canvas,textarea,input,select,button," +
  "[hidden],[aria-hidden='true'],.sdt-math,.sdt-source-crop";
export interface BlockSentences { block: HTMLElement; nodes: Text[]; text: string; spans: SentenceSpan[]; }
export function eligibleBlock(node: Node, root: Element): HTMLElement | undefined {
  const el = node.nodeType === 1 ? node as Element : node.parentElement;
  const block = el?.closest(PROSE_BLOCKS);
  if (!block || !root.contains(block) || block.closest(NON_PROSE_BLOCK)) return undefined;
  return block as HTMLElement;
}
/** Rendered original Text nodes whose innermost prose block is `block`, in document order. */
export function collectProse(block: HTMLElement): { nodes: Text[]; text: string } {
  const doc = block.ownerDocument;
  const win = doc.defaultView;
  const nodes: Text[] = [];
  // No boxes: the block or an ancestor is not rendered (for example display:none).
  if (!win || block.getClientRects().length === 0) return { nodes, text: "" };
  const shown = new Map<Element, boolean>();
  function rendered(el: Element): boolean {
    const cached = shown.get(el);
    if (cached !== undefined) return cached;
    const style = win!.getComputedStyle(el);
    const value = style.display !== "none" && style.visibility === "visible" &&
      (el === block || !el.parentElement || rendered(el.parentElement));
    shown.set(el, value);
    return value;
  }
  const walker = doc.createTreeWalker(block, 4 /* SHOW_TEXT */);
  let next: Node | null;
  while ((next = walker.nextNode())) {
    const node = next as Text;
    const el = node.parentElement;
    if (!el || el.closest(PROSE_BLOCKS) !== block || el.closest(NON_PROSE_INLINE)) continue;
    // Part-chain separators are unindexed whitespace; unindexed visible text is not SDT prose.
    if (!el.closest("[data-text-index]") && node.data.trim()) continue;
    if (!rendered(el)) continue;
    nodes.push(node);
  }
  return { nodes, text: nodes.map(node => node.data).join("") };
}
export function blockSentences(block: HTMLElement): BlockSentences {
  const prose = collectProse(block);
  return { block, ...prose, spans: segmentSentences(prose.text) };
}
export function offsetInBlock(nodes: Text[], node: Node, offset: number): number {
  let total = 0;
  for (const candidate of nodes) {
    if (candidate === node) return total + offset;
    total += candidate.length;
  }
  return -1;
}
