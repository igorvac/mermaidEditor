import { useCallback, useRef, useState } from 'react';
import { useApp } from '../store/appStore';
import logoColor from '../assets/logo-color.svg';
import { Sidebar } from './Sidebar';
import { CodePanel } from './CodePanel';
import { CanvasArea } from './CanvasArea';

export function Editor() {
  const projectName = useApp((s) => s.projectName);
  const fileName = useApp((s) => s.fileName);
  const dirty = useApp((s) => s.code !== s.savedCode);
  const appVersion = useApp((s) => s.appVersion);
  const showCode = useApp((s) => s.showCode);
  const showSidebar = useApp((s) => s.showSidebar);

  const [codeWidth, setCodeWidth] = useState(() => {
    const stored = Number(localStorage.getItem('codeWidth'));
    return stored >= 240 && stored <= 720 ? stored : 380;
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onSplitterDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startW: codeWidth };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const w = Math.min(720, Math.max(240, dragRef.current.startW + ev.clientX - dragRef.current.startX));
        setCodeWidth(w);
      };
      const onUp = () => {
        dragRef.current = null;
        setCodeWidth((w) => {
          localStorage.setItem('codeWidth', String(w));
          return w;
        });
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
    },
    [codeWidth]
  );

  return (
    <>
      <header className="titlebar">
        <img src={logoColor} className="titlebar-logo" alt="" draggable={false} />
        <span className="crumb-strong">OpenMermaid</span>
        <span className="crumb-sep">›</span>
        <span>{projectName}</span>
        {fileName && (
          <>
            <span className="crumb-sep">›</span>
            <span className="crumb-strong">{fileName}</span>
            {dirty && <span className="dirty-dot" title="Alterações não salvas" />}
          </>
        )}
        <span className="spacer" />
        {appVersion && <span className="version-chip">v{appVersion}</span>}
      </header>
      <main className="workspace">
        {showSidebar && <Sidebar />}
        {showCode && (
          <>
            <div className="code-panel" style={{ width: codeWidth }}>
              <CodePanel />
            </div>
            <div className="splitter" onMouseDown={onSplitterDown} />
          </>
        )}
        <CanvasArea />
      </main>
    </>
  );
}
