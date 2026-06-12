import type { FlowModel, LayoutOverrides, Selection } from '../types';

/**
 * Pós-processamento do SVG gerado pelo Mermaid: aplica offsets manuais de
 * posição (drag & drop) e re-roteia as arestas afetadas. O Mermaid não
 * suporta posições fixas na sintaxe, então os offsets vivem num sidecar
 * `<arquivo>.layout.json` e são reaplicados a cada render.
 */

export interface NodeRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function extractNodeId(g: SVGGElement): string | null {
  const dataId = g.getAttribute('data-id');
  if (dataId) return dataId;
  // formato: "<renderId->flowchart-<nodeId>-<n>" (o prefixo varia entre versões)
  const m = (g.id || '').match(/(?:^|-)flowchart-(.+)-\d+$/);
  return m ? m[1] : null;
}

export function parseTranslate(transform: string | null): { x: number; y: number } {
  const m = (transform ?? '').match(/translate\(\s*([-\d.eE]+)[\s,]+([-\d.eE]+)\s*\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

/** Dimensiona o SVG em unidades 1:1 com px e retorna o tamanho. */
export function prepareSvg(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  const height = vb && vb.height ? vb.height : svg.getBoundingClientRect().height;
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.style.maxWidth = 'none';
  return { width, height };
}

export function nodeGroups(svg: SVGSVGElement): Map<string, SVGGElement> {
  const map = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('g.node').forEach((g) => {
    const id = extractNodeId(g);
    if (id) map.set(id, g);
  });
  return map;
}

export function edgePaths(svg: SVGSVGElement): SVGPathElement[] {
  return Array.from(svg.querySelectorAll<SVGPathElement>('.edgePaths path:not(.edge-hit)'));
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Áreas de clique generosas: um clone invisível e largo para cada aresta e um
 * retângulo transparente cobrindo cada nó (forma + rótulo + folga).
 */
export function enhanceHitAreas(svg: SVGSVGElement) {
  edgePaths(svg).forEach((path, i) => {
    let hit = path.nextElementSibling as SVGPathElement | null;
    if (!hit || !hit.classList.contains('edge-hit')) {
      hit = path.cloneNode(false) as SVGPathElement;
      hit.classList.add('edge-hit');
      hit.removeAttribute('id');
      hit.removeAttribute('marker-start');
      hit.removeAttribute('marker-end');
      hit.removeAttribute('style');
      hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke', 'rgba(0,0,0,0)');
      hit.setAttribute('stroke-width', '16');
      path.after(hit);
    }
    hit.dataset.edgeIndex = String(i);
    hit.setAttribute('d', path.getAttribute('d') ?? '');
  });

  svg.querySelectorAll<SVGGElement>('g.node').forEach((g) => {
    if (g.querySelector(':scope > rect.node-hit')) return;
    const box = g.getBBox();
    const pad = 6;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.classList.add('node-hit');
    rect.setAttribute('x', String(box.x - pad));
    rect.setAttribute('y', String(box.y - pad));
    rect.setAttribute('width', String(box.width + pad * 2));
    rect.setAttribute('height', String(box.height + pad * 2));
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('stroke', 'none');
    g.prepend(rect);
  });
}

/** mantém os clones de hit das arestas alinhados com os paths visíveis */
function syncEdgeHits(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGPathElement>('.edgePaths path.edge-hit').forEach((hit) => {
    const original = hit.previousElementSibling as SVGPathElement | null;
    if (original) hit.setAttribute('d', original.getAttribute('d') ?? '');
  });
}

export function edgeLabels(svg: SVGSVGElement): SVGGElement[] {
  return Array.from(svg.querySelectorAll<SVGGElement>('.edgeLabels .edgeLabel'));
}

function ensureBase(el: SVGElement, attr: 'transform' | 'd', key: string) {
  if (el.dataset[key] === undefined) {
    el.dataset[key] = el.getAttribute(attr) ?? '';
  }
}

function nodeRect(g: SVGGElement): NodeRect {
  const t = parseTranslate(g.getAttribute('transform'));
  const box = g.getBBox();
  return {
    cx: t.x + box.x + box.width / 2,
    cy: t.y + box.y + box.height / 2,
    w: box.width,
    h: box.height
  };
}

/** ponto na borda do retângulo `rect` na direção do alvo (tx, ty) */
function clipToRect(rect: NodeRect, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - rect.cx;
  const dy = ty - rect.cy;
  if (dx === 0 && dy === 0) return { x: rect.cx, y: rect.cy };
  const pad = 4;
  const sx = dx !== 0 ? (rect.w / 2 + pad) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (rect.h / 2 + pad) / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy, 1);
  return { x: rect.cx + dx * t, y: rect.cy + dy * t };
}

function curvePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
}

/**
 * Aplica (ou remove) todos os offsets manuais. Idempotente: cada elemento
 * guarda seu estado original em data-attributes na primeira aplicação.
 */
export function applyLayout(svg: SVGSVGElement, model: FlowModel | null, layout: LayoutOverrides) {
  const nodes = nodeGroups(svg);

  nodes.forEach((g, id) => {
    ensureBase(g, 'transform', 'baseTransform');
    const base = parseTranslate(g.dataset.baseTransform ?? '');
    const off = layout[id];
    if (off) {
      g.setAttribute('transform', `translate(${base.x + off[0]}, ${base.y + off[1]})`);
    } else if (g.dataset.baseTransform) {
      g.setAttribute('transform', g.dataset.baseTransform);
    } else {
      g.removeAttribute('transform');
    }
  });

  if (!model) return;
  const paths = edgePaths(svg);
  const labels = edgeLabels(svg);

  model.edges.forEach((edge, i) => {
    const path = paths[i];
    if (!path) return;
    ensureBase(path, 'd', 'baseD');
    const label = labels[i];
    if (label) ensureBase(label, 'transform', 'baseTransform');

    const moved = layout[edge.from] || layout[edge.to];
    if (!moved) {
      if (path.dataset.baseD) path.setAttribute('d', path.dataset.baseD);
      if (label) {
        if (label.dataset.baseTransform) label.setAttribute('transform', label.dataset.baseTransform);
        else label.removeAttribute('transform');
      }
      return;
    }

    const gFrom = nodes.get(edge.from);
    const gTo = nodes.get(edge.to);
    if (!gFrom || !gTo) return;
    const rFrom = nodeRect(gFrom);
    const rTo = nodeRect(gTo);
    const a = clipToRect(rFrom, rTo.cx, rTo.cy);
    const b = clipToRect(rTo, rFrom.cx, rFrom.cy);
    path.setAttribute('d', curvePath(a, b));
    if (label) {
      label.setAttribute('transform', `translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2})`);
    }
  });

  syncEdgeHits(svg);
}

/** Marca visualmente seleção e origem do modo conectar. */
export function applySelection(
  svg: SVGSVGElement,
  model: FlowModel | null,
  selection: Selection,
  connectFrom: string | null
) {
  svg.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
  svg.querySelectorAll('.is-connect-from').forEach((el) => el.classList.remove('is-connect-from'));

  if (connectFrom) {
    const g = nodeGroups(svg).get(connectFrom);
    g?.classList.add('is-connect-from');
  }
  if (!selection) return;
  if (selection.kind === 'node') {
    nodeGroups(svg).get(selection.id)?.classList.add('is-selected');
  } else if (model) {
    edgePaths(svg)[selection.index]?.classList.add('is-selected');
  }
}

/** índice da aresta a partir de um alvo de clique (path, clone de hit ou rótulo) */
export function edgeIndexFromTarget(svg: SVGSVGElement, target: Element): number | null {
  const label = target.closest('.edgeLabels .edgeLabel');
  if (label) {
    const idx = edgeLabels(svg).indexOf(label as SVGGElement);
    return idx >= 0 ? idx : null;
  }
  const path = target.closest('path');
  if (!path || !path.closest('.edgePaths')) return null;
  if (path.classList.contains('edge-hit')) {
    const idx = Number(path.dataset.edgeIndex);
    return Number.isFinite(idx) ? idx : null;
  }
  const idx = edgePaths(svg).indexOf(path as SVGPathElement);
  return idx >= 0 ? idx : null;
}

export function nodeIdFromTarget(target: Element): string | null {
  const g = target.closest('g.node') as SVGGElement | null;
  return g ? extractNodeId(g) : null;
}
