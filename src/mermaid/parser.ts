import type { EdgeType, FlowDirection, FlowModel, FlowNode, NodeShape } from '../types';

/**
 * Parser do subconjunto comum da gramática flowchart do Mermaid.
 * Retorna null quando o código usa sintaxe fora do subconjunto —
 * nesse caso a edição visual é desativada e fica só o modo texto.
 */

export const SHAPE_DELIMS: { open: string; close: string; shape: NodeShape }[] = [
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[[', close: ']]', shape: 'subroutine' },
  { open: '[(', close: ')]', shape: 'cylinder' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'round' },
  { open: '{', close: '}', shape: 'diamond' },
  { open: '>', close: ']', shape: 'asymmetric' }
];

const ID_RE = /^[A-Za-z0-9_]+/;

interface LinkMatch {
  type: EdgeType;
  label: string;
  len: number;
}

const LABELED_LINKS: { re: RegExp; type: EdgeType }[] = [
  { re: /^\s*-->\|([^|]*)\|\s*/, type: 'arrow' },
  { re: /^\s*---\|([^|]*)\|\s*/, type: 'open' },
  { re: /^\s*-\.->\|([^|]*)\|\s*/, type: 'dotted' },
  { re: /^\s*==>\|([^|]*)\|\s*/, type: 'thick' },
  { re: /^\s*--\s+(.+?)\s+-->\s*/, type: 'arrow' },
  { re: /^\s*--\s+(.+?)\s+---\s*/, type: 'open' },
  { re: /^\s*-\.\s+(.+?)\s+\.->\s*/, type: 'dotted' },
  { re: /^\s*==\s+(.+?)\s+==>\s*/, type: 'thick' }
];

const SIMPLE_LINKS: { re: RegExp; type: EdgeType }[] = [
  { re: /^\s*-\.+->\s*/, type: 'dotted' },
  { re: /^\s*={2,}>\s*/, type: 'thick' },
  { re: /^\s*-{2,}>\s*/, type: 'arrow' },
  { re: /^\s*-{3,}\s*/, type: 'open' }
];

function matchLink(s: string): LinkMatch | null {
  for (const { re, type } of LABELED_LINKS) {
    const m = s.match(re);
    if (m) return { type, label: unquoteLabel(m[1].trim()), len: m[0].length };
  }
  for (const { re, type } of SIMPLE_LINKS) {
    const m = s.match(re);
    if (m) return { type, label: '', len: m[0].length };
  }
  return null;
}

export function unquoteLabel(label: string): string {
  let out = label;
  if (out.length >= 2 && out.startsWith('"') && out.endsWith('"')) {
    out = out.slice(1, -1);
  }
  return out.replace(/#quot;/g, '"');
}

interface NodeRef {
  id: string;
  label?: string;
  shape?: NodeShape;
  len: number;
}

function parseNodeRef(s: string): NodeRef | null {
  const trimmedLeft = s.length - s.trimStart().length;
  const body = s.slice(trimmedLeft);
  const idMatch = body.match(ID_RE);
  if (!idMatch) return null;
  const id = idMatch[0];
  let rest = body.slice(id.length);
  let consumed = trimmedLeft + id.length;

  for (const { open, close, shape } of SHAPE_DELIMS) {
    if (!rest.startsWith(open)) continue;
    const inner = rest.slice(open.length);
    let labelRaw: string;
    let innerLen: number;
    if (inner.startsWith('"')) {
      const endQuote = inner.indexOf('"', 1);
      if (endQuote === -1) return null;
      if (!inner.slice(endQuote + 1).startsWith(close)) return null;
      labelRaw = inner.slice(0, endQuote + 1);
      innerLen = endQuote + 1;
    } else {
      const closeIdx = inner.indexOf(close);
      if (closeIdx === -1) return null;
      labelRaw = inner.slice(0, closeIdx);
      innerLen = closeIdx;
    }
    consumed += open.length + innerLen + close.length;
    return { id, label: unquoteLabel(labelRaw.trim()), shape, len: consumed };
  }

  return { id, len: consumed };
}

function emptyModel(): FlowModel {
  return {
    header: 'flowchart',
    direction: 'TD',
    nodes: [],
    edges: [],
    subgraphs: [],
    init: [],
    extras: []
  };
}

function registerNode(model: FlowModel, ref: NodeRef, subgraph: number | undefined): boolean {
  const existing = model.nodes.find((n) => n.id === ref.id);
  if (existing) {
    if (ref.shape !== undefined) {
      // redefinição com forma/label diferente da já registrada: fora do subconjunto
      if (existing.defined && (existing.shape !== ref.shape || existing.label !== ref.label)) {
        return false;
      }
      existing.shape = ref.shape;
      existing.label = ref.label ?? existing.id;
      existing.defined = true;
    }
    return true;
  }
  const node: FlowNode = {
    id: ref.id,
    label: ref.label ?? ref.id,
    shape: ref.shape ?? 'rect',
    defined: ref.shape !== undefined,
    subgraph
  };
  model.nodes.push(node);
  return true;
}

function parseChain(line: string, model: FlowModel, subgraph: number | undefined): boolean {
  const first = parseNodeRef(line);
  if (!first) return false;
  if (!registerNode(model, first, subgraph)) return false;
  let rest = line.slice(first.len);
  let prev = first.id;

  while (rest.trim() !== '') {
    const link = matchLink(rest);
    if (!link) return false;
    rest = rest.slice(link.len);
    const node = parseNodeRef(rest);
    if (!node) return false;
    if (!registerNode(model, node, subgraph)) return false;
    rest = rest.slice(node.len);
    model.edges.push({ from: prev, to: node.id, label: link.label, type: link.type });
    prev = node.id;
  }
  return true;
}

const EXTRA_RE = /^(classDef|class|style|linkStyle|click|accTitle|accDescr)\b/;
const HEADER_RE = /^(flowchart|graph)(?:\s+(TD|TB|BT|LR|RL))?\s*$/;
const DIRECTION_RE = /^direction\s+(TD|TB|BT|LR|RL)$/;

export function parseFlow(code: string): FlowModel | null {
  const model = emptyModel();
  let seenHeader = false;
  const sgStack: number[] = [];

  for (const rawLine of code.split('\n')) {
    let line = rawLine.trim();
    while (line.endsWith(';')) line = line.slice(0, -1).trim();
    if (!line) continue;

    if (line.startsWith('%%{')) {
      (seenHeader ? model.extras : model.init).push(line);
      continue;
    }
    if (line.startsWith('%%')) {
      if (seenHeader) model.extras.push(line);
      continue;
    }

    if (!seenHeader) {
      const m = line.match(HEADER_RE);
      if (!m) return null;
      model.header = m[1] as FlowModel['header'];
      model.direction = (m[2] as FlowDirection | undefined) ?? 'TB';
      seenHeader = true;
      continue;
    }

    if (/^subgraph\s+/.test(line)) {
      model.subgraphs.push({ raw: line.replace(/^subgraph\s+/, '').trim() });
      sgStack.push(model.subgraphs.length - 1);
      continue;
    }
    if (line === 'end') {
      if (sgStack.length === 0) return null;
      sgStack.pop();
      continue;
    }

    const dirM = line.match(DIRECTION_RE);
    if (dirM) {
      if (sgStack.length === 0) return null;
      model.subgraphs[sgStack[sgStack.length - 1]].direction = dirM[1];
      continue;
    }

    if (EXTRA_RE.test(line)) {
      model.extras.push(line);
      continue;
    }

    if (!parseChain(line, model, sgStack[sgStack.length - 1])) return null;
  }

  if (sgStack.length > 0) return null;
  return seenHeader ? model : null;
}

/** Detecta o tipo de diagrama da primeira linha útil (para a UI informar o usuário). */
export function detectDiagramType(code: string): string | null {
  for (const rawLine of code.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;
    const word = line.split(/[\s;]/)[0];
    return word || null;
  }
  return null;
}
