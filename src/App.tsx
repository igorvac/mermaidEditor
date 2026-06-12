import { useEffect } from 'react';
import { useApp } from './store/appStore';
import { Welcome } from './components/Welcome';
import { Editor } from './components/Editor';
import { UpdateBanner } from './components/UpdateBanner';
import { exportPdf, exportPng, exportSvg } from './export/exporters';

function handleMenu(action: string) {
  const s = useApp.getState();
  switch (action) {
    case 'new-file':
      void s.newFile();
      break;
    case 'new-project':
      void s.newProject();
      break;
    case 'open-project':
      void s.openProjectDialog();
      break;
    case 'close-project':
      void s.closeProject();
      break;
    case 'save':
      void s.saveNow();
      break;
    case 'export-svg':
      if (s.renderSvg) void exportSvg(s.fileName);
      break;
    case 'export-png':
      if (s.renderSvg) void exportPng(s.fileName);
      break;
    case 'export-pdf':
      if (s.renderSvg) void exportPdf(s.fileName);
      break;
    case 'toggle-code':
      s.toggleCode();
      break;
    case 'toggle-sidebar':
      s.toggleSidebar();
      break;
    case 'zoom-in':
    case 'zoom-out':
    case 'zoom-reset':
    case 'zoom-fit':
      window.dispatchEvent(new CustomEvent('canvas-zoom', { detail: action.replace('zoom-', '') }));
      break;
  }
}

export default function App() {
  const projectPath = useApp((s) => s.projectPath);

  useEffect(() => {
    void useApp.getState().bootstrap();
  }, []);

  useEffect(() => window.api.onMenu(handleMenu), []);

  useEffect(
    () => window.api.onUpdaterEvent((ev) => useApp.getState().handleUpdaterEvent(ev)),
    []
  );

  return (
    <div className="app">
      {projectPath ? <Editor /> : <Welcome />}
      <UpdateBanner />
    </div>
  );
}
