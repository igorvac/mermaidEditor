import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../store/appStore';
import type { FlowDirection, NodeShape } from '../types';
import { exportPdf, exportPng, exportSvg } from '../export/exporters';
import { Icon } from './Icon';

const SHAPES: { shape: NodeShape; label: string; path: ReactNode }[] = [
  { shape: 'rect', label: 'Retângulo', path: <rect x="3" y="7" width="22" height="14" rx="1.5" /> },
  { shape: 'round', label: 'Cantos redondos', path: <rect x="3" y="7" width="22" height="14" rx="6" /> },
  { shape: 'stadium', label: 'Estádio', path: <rect x="3" y="7" width="22" height="14" rx="7" /> },
  { shape: 'circle', label: 'Círculo', path: <circle cx="14" cy="14" r="9" /> },
  { shape: 'diamond', label: 'Decisão', path: <polygon points="14,4 26,14 14,24 2,14" /> },
  { shape: 'hexagon', label: 'Hexágono', path: <polygon points="8,7 20,7 26,14 20,21 8,21 2,14" /> },
  {
    shape: 'subroutine',
    label: 'Sub-rotina',
    path: (
      <>
        <rect x="3" y="7" width="22" height="14" />
        <line x1="6.5" y1="7" x2="6.5" y2="21" />
        <line x1="21.5" y1="7" x2="21.5" y2="21" />
      </>
    )
  },
  {
    shape: 'cylinder',
    label: 'Banco de dados',
    path: (
      <>
        <path d="M4 9 v11 a10 3.4 0 0 0 20 0 V9" fill="none" />
        <ellipse cx="14" cy="9" rx="10" ry="3.4" />
      </>
    )
  },
  { shape: 'asymmetric', label: 'Bandeira', path: <polygon points="3,7 25,7 25,21 3,21 8,14" /> }
];

const DIRECTIONS: { dir: FlowDirection; label: string; icon: string }[] = [
  { dir: 'TD', label: 'De cima para baixo', icon: 'south' },
  { dir: 'BT', label: 'De baixo para cima', icon: 'north' },
  { dir: 'LR', label: 'Da esquerda p/ direita', icon: 'east' },
  { dir: 'RL', label: 'Da direita p/ esquerda', icon: 'west' }
];

type Popover = 'shapes' | 'direction' | 'export' | null;

export function Toolbar() {
  const tool = useApp((s) => s.tool);
  const model = useApp((s) => s.model);
  const selection = useApp((s) => s.selection);
  const layout = useApp((s) => s.layout);
  const renderSvg = useApp((s) => s.renderSvg);
  const fileName = useApp((s) => s.fileName);
  const direction = useApp((s) => s.model?.direction);

  const [popover, setPopover] = useState<Popover>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPopover(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const s = useApp.getState();
  const canEdit = model !== null;
  const hasLayout = Object.keys(layout).length > 0;

  return (
    <div className="toolbar" ref={rootRef}>
      <button
        className={`tool-btn${tool === 'select' ? ' active' : ''}`}
        title="Selecionar e mover (Esc)"
        onClick={() => {
          s.setTool('select');
          setPopover(null);
        }}
      >
        <Icon name="arrow_selector_tool" />
      </button>

      <button
        className={`tool-btn${tool === 'connect' ? ' active' : ''}`}
        title="Conectar nós"
        disabled={!canEdit}
        onClick={() => {
          s.setTool(tool === 'connect' ? 'select' : 'connect');
          setPopover(null);
        }}
      >
        <Icon name="conversion_path" />
      </button>

      <button
        className={`tool-btn${popover === 'shapes' ? ' active' : ''}`}
        title="Adicionar nó"
        disabled={!canEdit}
        onClick={() => setPopover(popover === 'shapes' ? null : 'shapes')}
      >
        <Icon name="add_box" />
      </button>

      <button
        className={`tool-btn${popover === 'direction' ? ' active' : ''}`}
        title="Direção do fluxo"
        disabled={!canEdit}
        onClick={() => setPopover(popover === 'direction' ? null : 'direction')}
      >
        <Icon name="alt_route" />
      </button>

      <button
        className="tool-btn"
        title="Excluir seleção (Delete)"
        disabled={!canEdit || !selection}
        onClick={() => s.deleteSelection()}
      >
        <Icon name="delete" />
      </button>

      <button
        className="tool-btn"
        title="Restaurar layout automático (limpa posições arrastadas)"
        disabled={!hasLayout}
        onClick={() => s.clearLayout()}
      >
        <Icon name="auto_fix_high" />
      </button>

      <div className="tool-sep" />

      <button
        className={`tool-btn${popover === 'export' ? ' active' : ''}`}
        title="Exportar"
        disabled={!renderSvg}
        onClick={() => setPopover(popover === 'export' ? null : 'export')}
      >
        <Icon name="download" />
      </button>

      <button className="tool-btn" title="Alternar painel de código (⇧⌘L)" onClick={() => s.toggleCode()}>
        <Icon name="code" />
      </button>

      {popover === 'shapes' && (
        <div className="popover" style={{ top: 8 }}>
          <div className="popover-title">Adicionar nó</div>
          <div className="shape-grid">
            {SHAPES.map(({ shape, label, path }) => (
              <button
                key={shape}
                className="shape-btn"
                title={label}
                onClick={() => {
                  s.addNode(shape);
                  setPopover(null);
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {path}
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {popover === 'direction' && (
        <div className="popover" style={{ top: 60 }}>
          <div className="popover-title">Direção do fluxo</div>
          <div className="menu-list">
            {DIRECTIONS.map(({ dir, label, icon }) => (
              <button
                key={dir}
                className={`menu-item${direction === dir || (dir === 'TD' && direction === 'TB') ? ' active' : ''}`}
                onClick={() => {
                  s.setDirection(dir);
                  setPopover(null);
                }}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {popover === 'export' && (
        <div className="popover" style={{ bottom: 8 }}>
          <div className="popover-title">Exportar diagrama</div>
          <div className="menu-list">
            <button
              className="menu-item"
              onClick={() => {
                void exportSvg(fileName);
                setPopover(null);
              }}
            >
              <Icon name="polyline" />
              SVG (vetorial)
            </button>
            <button
              className="menu-item"
              onClick={() => {
                void exportPng(fileName);
                setPopover(null);
              }}
            >
              <Icon name="image" />
              PNG (2x)
            </button>
            <button
              className="menu-item"
              onClick={() => {
                void exportPdf(fileName);
                setPopover(null);
              }}
            >
              <Icon name="picture_as_pdf" />
              PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
