// SPDX-License-Identifier: AGPL-3.0-or-later
// Rainbow sentence focus: one owned CSS Custom Highlight over original Text nodes in one
// native Reading Mode document. No text, selection, reader-state or persistence writes.
import type { ReadingTarget, Status } from "../host";
import type { RenderSession } from "./types";
import { RAINBOW_KEYS, type RainbowKeyboardPreset } from "../preferences/rainbow";
import { rangeForOffsets } from "../text/dom-ranges";
import { blockSentences, eligibleBlock, offsetInBlock, PROSE_BLOCKS, type BlockSentences } from "../text/sentences";
declare const Components: { utils: { cloneInto<T>(value: T, scope: Window): T } };
export const SENTENCE_NAME = "rainbowbionic-sentence";
export const SENTENCE_STYLE_ID = "rainbowbionic-sentence-style";
/** Interactive or editable content keeps its native pointer and keyboard behavior. */
const CONTROLS = "a[href],button,input,select,textarea,label,summary,[contenteditable]:not([contenteditable='false'])," +
  "[role='button'],[role='link'],[role='textbox']";
interface HighlightLike { add(range: Range): unknown; clear(): void; priority: number; }
interface Registry {
  get(name: string): unknown;
  set(name: string, highlight: HighlightLike): unknown;
  delete(name: string): boolean;
}
interface RainbowWindow extends Window {
  CSS: { highlights: Registry; supports(condition: string): boolean };
  Highlight: new () => HighlightLike;
  MutationObserver: typeof MutationObserver;
}
interface CaretApi {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}
interface Focus { sentences: BlockSentences; index: number; range: Range; }
function inactive(code: string, detail: string): RenderSession {
  return { dispose() {}, getStatus: () => ({ code, detail }) };
}
/**
 * The character actually under the pointer: a caret position (standard
 * caretPositionFromPoint, as in Gecko; caretRangeFromPoint otherwise) whose adjacent
 * glyph rectangle contains the point. Caret APIs snap blank areas to the nearest text,
 * so a point in a margin, paragraph gap or past a line end is not a hit.
 */
export function textHitAt(doc: Document, x: number, y: number): { node: Text; offset: number } | undefined {
  const api = doc as unknown as CaretApi;
  let node: Node | null | undefined;
  let offset = 0;
  if (typeof api.caretPositionFromPoint === "function") {
    const position = api.caretPositionFromPoint(x, y);
    node = position?.offsetNode; offset = position?.offset ?? 0;
  } else if (typeof api.caretRangeFromPoint === "function") {
    const range = api.caretRangeFromPoint(x, y);
    node = range?.startContainer; offset = range?.startOffset ?? 0;
  }
  if (!node || node.nodeType !== 3) return undefined;
  const text = node as Text;
  for (const index of [offset, offset - 1]) {
    if (index < 0 || index >= text.length) continue;
    let start = index, end = index + 1;
    const unit = text.data.charCodeAt(index);
    if (unit >= 0xdc00 && unit <= 0xdfff && start > 0) start--;
    else if (unit >= 0xd800 && unit <= 0xdbff && end < text.length) end++;
    const glyph = doc.createRange();
    glyph.setStart(text, start);
    glyph.setEnd(text, end);
    for (const rect of Array.from(glyph.getClientRects())) {
      if (rect.width > 0 && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) {
        return { node: text, offset: start };
      }
    }
  }
  return undefined;
}
export function createRainbowSession(target: ReadingTarget, getKeyboardPreset: () => RainbowKeyboardPreset = () => "arrows"): RenderSession {
  const doc = target.document;
  const root = target.root;
  const win = doc.defaultView as RainbowWindow | null;
  const caret = doc as unknown as CaretApi;
  // Capability only. The archived Bionic text-shadow gate does not apply: Highlight
  // background/foreground paint was positive in actual Zotero 10.0.6 / Gecko 140.
  if (!win || typeof win.Highlight !== "function" || !win.CSS?.highlights ||
      typeof win.CSS.highlights.get !== "function" || typeof win.CSS.highlights.set !== "function" ||
      typeof win.CSS.highlights.delete !== "function" || typeof win.MutationObserver !== "function" ||
      typeof Intl.Segmenter !== "function" || typeof win.CSS.supports !== "function" ||
      !win.CSS.supports(`selector(::highlight(${SENTENCE_NAME}))`) ||
      (typeof caret.caretPositionFromPoint !== "function" && typeof caret.caretRangeFromPoint !== "function")) {
    return inactive("rainbow-capability-missing", "Required CSS Highlight, caret or segmentation capability unavailable; nothing installed");
  }
  const view: RainbowWindow = win;
  const registry = view.CSS.highlights;
  if (registry.get(SENTENCE_NAME) || doc.getElementById(SENTENCE_STYLE_ID)) {
    return inactive("rainbow-ownership-conflict", "Existing resources have the same names; refusing to overwrite them");
  }
  const READY: Status = { code: "rainbow-ready", detail: "Double-click prose to focus a sentence" };
  let disposed = false;
  let focus: Focus | undefined;
  let status: Status = READY;
  const highlight = new view.Highlight();
  // Other custom highlights with default priority 0 paint above this one.
  highlight.priority = -10;
  const style = doc.createElement("style");
  style.id = SENTENCE_STYLE_ID;
  // Background only: the reader's text color and therefore light/dark contrast stay intact.
  style.textContent = `::highlight(${SENTENCE_NAME}) { background-color: rgba(255, 196, 0, 0.24); }
    :root[data-color-scheme="dark"] ::highlight(${SENTENCE_NAME}) { background-color: rgba(255, 214, 102, 0.2); }
    @media print { ::highlight(${SENTENCE_NAME}) { background-color: transparent; } }`;
  function clearFocus() {
    focus = undefined;
    highlight.clear();
    if (!disposed) status = READY;
  }
  function show(sentences: BlockSentences, index: number): Focus {
    const span = sentences.spans[index]!;
    const range = rangeForOffsets(doc, sentences.nodes, span.start, span.end);
    highlight.clear();
    highlight.add(range);
    focus = { sentences, index, range };
    status = { code: "rainbow-focused", detail: "One sentence highlighted" };
    return focus;
  }
  /** Revalidate against the live DOM; rerendered or changed content clears focus rather than guessing. */
  function current(): Focus | undefined {
    if (!focus) return undefined;
    const { block, nodes, text } = focus.sentences;
    const fresh = root.isConnected && block.isConnected && eligibleBlock(block, root) === block ? blockSentences(block) : undefined;
    if (!fresh || fresh.text !== text || fresh.nodes.length !== nodes.length || fresh.nodes.some((node, i) => node !== nodes[i])) {
      clearFocus();
      return undefined;
    }
    return focus;
  }
  function adjacent(from: Focus, step: 1 | -1): { sentences: BlockSentences; index: number } | undefined {
    const index = from.index + step;
    if (index >= 0 && index < from.sentences.spans.length) return { sentences: from.sentences, index };
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(PROSE_BLOCKS));
    for (let at = blocks.indexOf(from.sentences.block) + step; at >= 0 && at < blocks.length; at += step) {
      const block = blocks[at]!;
      if (eligibleBlock(block, root) !== block) continue;
      const sentences = blockSentences(block);
      if (sentences.spans.length) return { sentences, index: step > 0 ? 0 : sentences.spans.length - 1 };
    }
    return undefined;
  }
  function scrollParent(el: Element | null): HTMLElement | undefined {
    for (let node = el; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      const overflow = view.getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node as HTMLElement;
    }
    return undefined;
  }
  /** Ordinary scrolling, only when part of the sentence is outside the visible area. */
  function reveal(range: Range) {
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 || rect.height > 0);
    if (!rects.length) return;
    const top = Math.min(...rects.map(rect => rect.top));
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    const scroller = scrollParent(range.startContainer.parentElement);
    const frame = scroller?.getBoundingClientRect();
    const viewTop = Math.max(0, frame?.top ?? 0);
    const viewBottom = Math.min(view.innerHeight, frame?.bottom ?? view.innerHeight);
    const margin = Math.min(48, Math.max(0, (viewBottom - viewTop) / 8));
    let delta = 0;
    if (top < viewTop + margin) delta = top - viewTop - margin;
    else if (bottom > viewBottom - margin) delta = Math.min(bottom - viewBottom + margin, top - viewTop - margin);
    if (Math.abs(delta) < 1) return;
    if (scroller) scroller.scrollTop += delta;
    else view.scrollBy(0, delta);
  }
  function fail(error: unknown) {
    dispose();
    status = { code: "rainbow-failed-closed", detail: String(error) };
  }
  function contentElement(target: EventTarget | null): Element | undefined {
    const node = target as Node | null;
    const el = node?.nodeType === 1 ? node as Element : node?.parentElement;
    return el && root.contains(el) && !el.closest(CONTROLS) ? el : undefined;
  }
  function sentenceAt(event: MouseEvent) {
    if (disposed || !event.isTrusted || event.defaultPrevented || event.button !== 0 || event.detail !== 2 ||
        event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || !root.isConnected) return;
    // Annotation tools and interactive elements retain Zotero's gestures.
    const tool = doc.body?.getAttribute("data-tool");
    if ((tool && tool !== "pointer") || !contentElement(event.target)) return;
    const hit = textHitAt(doc, event.clientX, event.clientY);
    const block = hit && eligibleBlock(hit.node, root);
    if (!hit || !block) return;
    const sentences = blockSentences(block);
    const offset = offsetInBlock(sentences.nodes, hit.node, hit.offset);
    const index = sentences.spans.findIndex(span => offset >= span.start && offset < span.end);
    if (index >= 0) return { sentences, index };
  }
  function onMouseDown(event: MouseEvent) {
    try {
      // Reserve the second press on prose for Rainbow so Gecko does not also select a word.
      if (sentenceAt(event)) event.preventDefault();
    } catch (error) { fail(error); }
  }
  function onDoubleClick(event: MouseEvent) {
    try {
      const target = sentenceAt(event);
      if (target) show(target.sentences, target.index);
    } catch (error) { fail(error); }
  }
  function onKeyDown(event: KeyboardEvent) {
    try {
      if (disposed || !focus || !event.isTrusted) return;
      // Escape keeps its native/reader handling and also clears the focus.
      if (event.key === "Escape") { clearFocus(); return; }
      const keys = RAINBOW_KEYS[getKeyboardPreset()];
      if ((event.key !== keys.next && event.key !== keys.previous) || event.defaultPrevented || event.isComposing ||
          event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (doc.getSelection()?.isCollapsed === false) return;
      const target = event.target as Element | null;
      // In Zotero, Gecko can retarget the keyboard event to a different wrapper for body.
      if (target?.localName !== "body" && target?.localName !== "html" && !contentElement(target)) return;
      const from = current();
      const next = from && adjacent(from, event.key === keys.next ? 1 : -1);
      // No wrap: at either end the native key continues.
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      reveal(show(next.sentences, next.index).range);
    } catch (error) { fail(error); }
  }
  const observer = new view.MutationObserver(() => {
    if (disposed || !focus) return;
    try {
      const still = current();
      // Re-anchor the live Range when unrelated subtree changes left the block intact.
      if (still) show(still.sentences, still.index);
    } catch (error) { fail(error); }
  });
  function onPageHide() { dispose(); }
  function dispose() {
    if (disposed) return;
    disposed = true;
    focus = undefined;
    for (const remove of [
      () => observer.disconnect(),
      () => doc.removeEventListener("mousedown", onMouseDown, false),
      () => doc.removeEventListener("dblclick", onDoubleClick, false),
      () => doc.removeEventListener("keydown", onKeyDown, false),
      () => view.removeEventListener("pagehide", onPageHide, false),
      () => highlight.clear(),
      () => { if (registry.get(SENTENCE_NAME) === highlight) registry.delete(SENTENCE_NAME); },
      () => style.remove(),
    ]) {
      try { remove(); } catch { /* A closed Gecko compartment may already own these resources. */ }
    }
    status = { code: "disposed", detail: "Rainbow listeners, observer, highlight and style removed" };
  }
  try {
    // Gecko content cannot read privileged option dictionaries directly.
    const options = { subtree: true, childList: true, characterData: true };
    observer.observe(root, typeof Components === "undefined" ? options : Components.utils.cloneInto(options, view));
    (doc.head ?? doc.documentElement).append(style);
    registry.set(SENTENCE_NAME, highlight);
    doc.addEventListener("mousedown", onMouseDown, false);
    doc.addEventListener("dblclick", onDoubleClick, false);
    doc.addEventListener("keydown", onKeyDown, false);
    view.addEventListener("pagehide", onPageHide, false);
  } catch (error) { fail(error); }
  return { dispose, getStatus: () => ({ ...status,
    detail: status.code === "rainbow-ready" || status.code === "rainbow-focused"
      ? `${status.detail}; ${RAINBOW_KEYS[getKeyboardPreset()].label} move, Escape clears` : status.detail,
  }) };
}
