// SPDX-License-Identifier: AGPL-3.0-or-later
export function rangeForOffsets(doc: Document, nodes: Text[], start: number, end: number): Range {
  if (start < 0 || end <= start) throw new RangeError("Empty or negative range");
  let offset = 0;
  let startNode: Text | undefined;
  let endNode: Text | undefined;
  let startOffset = 0;
  let endOffset = 0;
  for (const node of nodes) {
    const limit = offset + node.length;
    if (!startNode && start < limit) { startNode = node; startOffset = start - offset; }
    if (end <= limit && startNode) { endNode = node; endOffset = end - offset; break; }
    offset = limit;
  }
  if (!startNode || !endNode) throw new RangeError("Offset beyond original text");
  const range = doc.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}
