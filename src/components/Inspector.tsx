import { useEffect, useState } from 'react';
import { useApp } from '../store/appStore';
import type { EdgeType, NodeShape } from '../types';
import { Icon } from './Icon';

const SHAPE_OPTIONS: { value: NodeShape; label: string }[] = [
  { value: 'rect', label: 'Retângulo' },
  { value: 'round', label: 'Cantos redondos' },
  { value: 'stadium', label: 'Estádio' },
  { value: 'circle', label: 'Círculo' },
  { value: 'diamond', label: 'Decisão (losango)' },
  { value: 'hexagon', label: 'Hexágono' },
  { value: 'subroutine', label: 'Sub-rotina' },
  { value: 'cylinder', label: 'Banco de dados' },
  { value: 'asymmetric', label: 'Bandeira' }
];

const EDGE_OPTIONS: { value: EdgeType; label: string }[] = [
  { value: 'arrow', label: 'Seta' },
  { value: 'open', label: 'Linha (sem seta)' },
  { value: 'dotted', label: 'Pontilhada' },
  { value: 'thick', label: 'Espessa' }
];

const FILL_SWATCHES = ['#D4CDF4', '#59C9A5', '#EF6F6C', '#F6E8EA', '#FFFFFF', '#465775'];

export function Inspector() {
  const selection = useApp((s) => s.selection);
  const model = useApp((s) => s.model);
  const [label, setLabel] = useState('');

  const node =
    selection?.kind === 'node' ? model?.nodes.find((n) => n.id === selection.id) : undefined;
  const edge = selection?.kind === 'edge' ? model?.edges[selection.index] : undefined;

  useEffect(() => {
    setLabel(node?.label ?? edge?.label ?? '');
  }, [selection, node?.label, edge?.label]);

  if (!model || !selection || (!node && !edge)) return null;
  const s = useApp.getState();

  const commitLabel = () => {
    if (node && label.trim() && label !== node.label) s.renameNode(node.id, label.trim());
    if (edge && selection.kind === 'edge' && label !== edge.label) {
      s.setEdgeLabel(selection.index, label.trim());
    }
  };

  const currentFill = node
    ? model.extras
        .map((l) => l.match(new RegExp(`^style\\s+${node.id}\\s+.*fill:(#[0-9a-fA-F]{3,8})`)))
        .find(Boolean)?.[1]
        ?.toUpperCase() ?? null
    : null;

  return (
    <div className="inspector">
      <div className="inspector-head">
        <Icon name={node ? 'crop_square' : 'conversion_path'} filled />
        <span className="grow">{node ? 'Nó selecionado' : 'Conexão selecionada'}</span>
        <button className="icon-btn" title="Fechar" onClick={() => s.setSelection(null)}>
          <Icon name="close" />
        </button>
      </div>

      {node && (
        <>
          <div className="field">
            <label>Rótulo</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
            />
          </div>
          <div className="field">
            <label>Forma</label>
            <select
              value={node.shape}
              onChange={(e) => s.setNodeShape(node.id, e.target.value as NodeShape)}
            >
              {SHAPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cor de preenchimento</label>
            <div className="swatches">
              {FILL_SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`swatch${currentFill === c ? ' active' : ''}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => s.setNodeFill(node.id, c)}
                />
              ))}
              <button
                className={`swatch${currentFill === null ? ' active' : ''}`}
                title="Padrão do tema"
                onClick={() => s.setNodeFill(node.id, null)}
              >
                <Icon name="format_color_reset" />
              </button>
            </div>
          </div>
          <div className="hint">id: {node.id} · duplo-clique no nó também renomeia</div>
        </>
      )}

      {edge && selection.kind === 'edge' && (
        <>
          <div className="field">
            <label>Rótulo</label>
            <input
              value={label}
              placeholder="(sem rótulo)"
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
            />
          </div>
          <div className="field">
            <label>Tipo de linha</label>
            <select
              value={edge.type}
              onChange={(e) => s.setEdgeType(selection.index, e.target.value as EdgeType)}
            >
              {EDGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hint">
            {edge.from} → {edge.to}
          </div>
        </>
      )}
    </div>
  );
}
