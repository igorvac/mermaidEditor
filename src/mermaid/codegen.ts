import type { EdgeType, FlowEdge, FlowModel, FlowNode, NodeShape } from '../types';
import { SHAPE_DELIMS } from './parser';

const SHAPE_MAP = new Map<NodeShape, { open: string; close: string }>(
  SHAPE_DELIMS.map((d) => [d.shape, { open: d.open, close: d.close }])
);

const LINK_MAP: Record<EdgeType, string> = {
  arrow: '-->',
  open: '---',
  dotted: '-.->',
  thick: '==>'
};

function quoteLabel(label: string): string {
  return `"${label.replace(/"/g, '#quot;')}"`;
}

function nodeDef(node: FlowNode): string {
  if (!node.defined && node.label === node.id && node.shape === 'rect') {
    // declaração simples (usada para registrar pertencimento a subgraph)
    return node.id;
  }
  const delim = SHAPE_MAP.get(node.shape) ?? SHAPE_MAP.get('rect')!;
  return `${node.id}${delim.open}${quoteLabel(node.label)}${delim.close}`;
}

function edgeLine(edge: FlowEdge): string {
  const link = LINK_MAP[edge.type];
  const label = edge.label ? `|${quoteLabel(edge.label)}|` : '';
  return `${edge.from} ${link}${label} ${edge.to}`;
}

function isReferenced(node: FlowNode, model: FlowModel): boolean {
  return model.edges.some((e) => e.from === node.id || e.to === node.id);
}

export function genFlow(model: FlowModel): string {
  const out: string[] = [];
  const IND = '  ';

  out.push(...model.init);
  out.push(`${model.header} ${model.direction}`);

  model.subgraphs.forEach((sg, i) => {
    out.push(`${IND}subgraph ${sg.raw}`);
    if (sg.direction) out.push(`${IND}${IND}direction ${sg.direction}`);
    for (const node of model.nodes.filter((n) => n.subgraph === i)) {
      out.push(`${IND}${IND}${nodeDef(node)}`);
    }
    out.push(`${IND}end`);
  });

  for (const node of model.nodes.filter((n) => n.subgraph === undefined)) {
    const needsDef = node.defined || node.label !== node.id || node.shape !== 'rect';
    if (needsDef || !isReferenced(node, model)) {
      out.push(`${IND}${nodeDef(node)}`);
    }
  }

  for (const edge of model.edges) {
    out.push(`${IND}${edgeLine(edge)}`);
  }

  out.push(...model.extras.map((l) => `${IND}${l}`));
  return out.join('\n') + '\n';
}

/** id de nó ainda não usado no modelo (n1, n2, …) */
export function nextNodeId(model: FlowModel): string {
  let i = 1;
  while (model.nodes.some((n) => n.id === `n${i}`)) i++;
  return `n${i}`;
}
