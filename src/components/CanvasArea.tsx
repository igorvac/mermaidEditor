import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../store/appStore';
import {
  applyLayout,
  applySelection,
  edgeIndexFromTarget,
  enhanceHitAreas,
  extractNodeId,
  nodeIdFromTarget,
  prepareSvg
} from '../canvas/svgLayout';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { Icon } from './Icon';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface RenameBox {
  id: string;
  value: string;
  left: number;
  top: number;
  width: number;
}

function ZoomControls() {
  const zoom = useApp((s) => s.zoom);
  const send = (detail: string) => window.dispatchEvent(new CustomEvent('canvas-zoom', { detail }));
  return (
    <div className="zoom-controls">
      <button className="icon-btn" title="Reduzir" onClick={() => send('out')}>
        <Icon name="remove" />
      </button>
      <span className="zoom-label" title="Zoom 100%" onClick={() => send('reset')}>
        {Math.round(zoom * 100)}%
      </span>
      <button className="icon-btn" title="Ampliar" onClick={() => send('in')}>
        <Icon name="add" />
      </button>
      <button className="icon-btn" title="Ajustar à tela" onClick={() => send('fit')}>
        <Icon name="fit_screen" />
      </button>
    </div>
  );
}

export function CanvasArea() {
  const renderSvg = useApp((s) => s.renderSvg);
  const svgRev = useApp((s) => s.svgRev);
  const renderError = useApp((s) => s.renderError);
  const model = useApp((s) => s.model);
  const layout = useApp((s) => s.layout);
  const selection = useApp((s) => s.selection);
  const tool = useApp((s) => s.tool);
  const connectFrom = useApp((s) => s.connectFrom);
  const zoom = useApp((s) => s.zoom);
  const pan = useApp((s) => s.pan);
  const filePath = useApp((s) => s.filePath);
  const diagramType = useApp((s) => s.diagramType);

  const viewportRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const fittedFileRef = useRef<string | null>(null);
  const [renameBox, setRenameBox] = useState<RenameBox | null>(null);

  const getSvg = () => hostRef.current?.querySelector('svg') ?? null;

  const fitView = useCallback(() => {
    const vp = viewportRef.current;
    const svg = getSvg();
    if (!vp || !svg) return;
    const w = parseFloat(svg.getAttribute('width') ?? '0');
    const h = parseFloat(svg.getAttribute('height') ?? '0');
    if (!w || !h) return;
    const rect = vp.getBoundingClientRect();
    const z = clamp(Math.min((rect.width - 100) / w, (rect.height - 100) / h), 0.08, 1.5);
    useApp.getState().setView(z, { x: (rect.width - w * z) / 2, y: (rect.height - h * z) / 2 });
  }, []);

  // injeção do SVG renderizado
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = renderSvg;
    const svg = getSvg();
    if (!svg) return;
    prepareSvg(svg);
    const s = useApp.getState();
    enhanceHitAreas(svg);
    applyLayout(svg, s.model, s.layout);
    applySelection(svg, s.model, s.selection, s.connectFrom);
    if (filePath && fittedFileRef.current !== filePath) {
      fittedFileRef.current = filePath;
      fitView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderSvg, svgRev]);

  useLayoutEffect(() => {
    const svg = getSvg();
    if (svg) applyLayout(svg, model, layout);
  }, [layout, model, svgRev]);

  useLayoutEffect(() => {
    const svg = getSvg();
    if (svg) applySelection(svg, model, selection, connectFrom);
  }, [selection, connectFrom, model, svgRev]);

  // wheel: scroll = pan, ctrl/cmd (e pinch do trackpad) = zoom — não-passivo
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useApp.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = vp.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const newZoom = clamp(s.zoom * Math.exp(-e.deltaY * 0.01), 0.08, 4);
        const px = (cx - s.pan.x) / s.zoom;
        const py = (cy - s.pan.y) / s.zoom;
        s.setView(newZoom, { x: cx - px * newZoom, y: cy - py * newZoom });
      } else {
        s.setPan({ x: s.pan.x - e.deltaX, y: s.pan.y - e.deltaY });
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  // zoom vindo do menu nativo / controles
  useEffect(() => {
    const onZoom = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      const vp = viewportRef.current;
      if (!vp) return;
      const s = useApp.getState();
      const rect = vp.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const applyZoom = (nz: number) => {
        const px = (cx - s.pan.x) / s.zoom;
        const py = (cy - s.pan.y) / s.zoom;
        s.setView(nz, { x: cx - px * nz, y: cy - py * nz });
      };
      if (detail === 'in') applyZoom(clamp(s.zoom * 1.25, 0.08, 4));
      else if (detail === 'out') applyZoom(clamp(s.zoom / 1.25, 0.08, 4));
      else if (detail === 'reset') applyZoom(1);
      else if (detail === 'fit') fitView();
    };
    window.addEventListener('canvas-zoom', onZoom);
    return () => window.removeEventListener('canvas-zoom', onZoom);
  }, [fitView]);

  // teclado: delete / esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      const s = useApp.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection && s.model) {
        e.preventDefault();
        s.deleteSelection();
      }
      if (e.key === 'Escape') {
        s.setSelection(null);
        s.setTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || renameBox) return;
    const target = e.target as Element;
    const s = useApp.getState();
    const svg = getSvg();

    // clique em aresta seleciona
    if (svg && s.model) {
      const edgeIdx = edgeIndexFromTarget(svg, target);
      if (edgeIdx !== null) {
        s.setSelection({ kind: 'edge', index: edgeIdx });
        return;
      }
    }

    const nodeId = nodeIdFromTarget(target);
    if (nodeId && s.model && s.tool === 'select') {
      // arrastar nó (ou selecionar, se não houver movimento)
      const base = s.layout[nodeId] ?? ([0, 0] as [number, number]);
      const start = { x: e.clientX, y: e.clientY };
      let moved = false;
      const onMove = (ev: MouseEvent) => {
        const st = useApp.getState();
        const dx = (ev.clientX - start.x) / st.zoom;
        const dy = (ev.clientY - start.y) / st.zoom;
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3) moved = true;
        if (!moved) return;
        const liveSvg = getSvg();
        if (!liveSvg || !st.model) return;
        applyLayout(liveSvg, st.model, {
          ...st.layout,
          [nodeId]: [base[0] + dx, base[1] + dy]
        });
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const st = useApp.getState();
        if (moved) {
          const dx = (ev.clientX - start.x) / st.zoom;
          const dy = (ev.clientY - start.y) / st.zoom;
          st.setNodeOffset(nodeId, [base[0] + dx, base[1] + dy]);
        } else {
          st.setSelection({ kind: 'node', id: nodeId });
        }
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    if (nodeId) {
      // modo conectar ou diagrama sem modelo: tratado no onClick / sem drag
      if (s.tool === 'connect') return;
      if (!s.model) return;
    }

    // pan no fundo do canvas
    const start = { x: e.clientX, y: e.clientY };
    const basePan = { ...s.pan };
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3) moved = true;
      if (!moved) return;
      useApp.getState().setPan({
        x: basePan.x + ev.clientX - start.x,
        y: basePan.y + ev.clientY - start.y
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) {
        const st = useApp.getState();
        st.setSelection(null);
        if (st.tool === 'connect') st.setConnectFrom(null);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onClick = (e: React.MouseEvent) => {
    const s = useApp.getState();
    if (s.tool !== 'connect' || !s.model) return;
    const id = nodeIdFromTarget(e.target as Element);
    if (!id) return;
    if (!s.connectFrom) s.setConnectFrom(id);
    else if (s.connectFrom !== id) s.addEdge(s.connectFrom, id);
    else s.setConnectFrom(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const s = useApp.getState();
    if (!s.model) return;
    const g = (e.target as Element).closest('g.node') as SVGGElement | null;
    if (!g) return;
    const id = extractNodeId(g);
    const node = id ? s.model.nodes.find((n) => n.id === id) : null;
    if (!id || !node) return;
    const rect = g.getBoundingClientRect();
    const vpRect = viewportRef.current!.getBoundingClientRect();
    setRenameBox({
      id,
      value: node.label,
      left: rect.left - vpRect.left,
      top: rect.top - vpRect.top + rect.height / 2 - 16,
      width: Math.max(rect.width, 100)
    });
  };

  const commitRename = () => {
    if (renameBox && renameBox.value.trim()) {
      useApp.getState().renameNode(renameBox.id, renameBox.value.trim());
    }
    setRenameBox(null);
  };

  const showInfoChip = !renderError && renderSvg && !model;
  const isFlowSyntax = diagramType === 'flowchart' || diagramType === 'graph';

  return (
    <div className={`canvas-wrap${tool === 'connect' ? ' connect-mode' : ''}`}>
      <div
        className="canvas-viewport"
        ref={viewportRef}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <div
          className="svg-stage"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <div id="svg-host" ref={hostRef} />
        </div>
      </div>

      {!renderSvg && !renderError && (
        <div className="empty-state">
          {filePath ? 'Digite código mermaid para começar.' : 'Crie ou selecione um diagrama na barra lateral.'}
        </div>
      )}

      {renameBox && (
        <input
          className="node-rename"
          style={{ left: renameBox.left, top: renameBox.top, width: renameBox.width }}
          value={renameBox.value}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setRenameBox({ ...renameBox, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenameBox(null);
          }}
          onBlur={commitRename}
        />
      )}

      <Toolbar />
      <ZoomControls />
      {selection && model && <Inspector />}

      {tool === 'connect' && model && (
        <div className="chip chip-info">
          <Icon name="conversion_path" />
          {connectFrom
            ? 'Agora clique no nó de destino.'
            : 'Clique no nó de origem para criar uma conexão.'}
        </div>
      )}

      {showInfoChip && tool !== 'connect' && (
        <div className="chip chip-info">
          <Icon name="info" />
          {isFlowSyntax
            ? 'Sintaxe avançada detectada — edição visual desativada; edite pelo código.'
            : `Diagrama "${diagramType}" renderizado ao vivo. A edição visual está disponível para flowcharts.`}
        </div>
      )}

      {renderError && (
        <div className="chip chip-error" title={renderError}>
          <Icon name="error" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Erro de sintaxe — mantendo o último diagrama válido.
          </span>
        </div>
      )}
    </div>
  );
}
