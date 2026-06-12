import type { Api, FileNode, LayoutOverrides } from './types';
import { DEFAULT_DIAGRAM } from './store/appStore';

/**
 * Mock em memória de window.api para quando o renderer roda num navegador
 * comum (fora do Electron) — útil para desenvolvimento e testes de UI.
 * No app empacotado o preload real define window.api antes deste módulo rodar.
 */
export function installMockApi() {
  if (window.api) return;

  const ROOT = '/demo';
  const files = new Map<string, string>([
    [`${ROOT}/fluxo-principal.mmd`, DEFAULT_DIAGRAM],
    [
      `${ROOT}/sequencia.mmd`,
      'sequenceDiagram\n  participant A as Ana\n  participant B as Bruno\n  A->>B: Olá!\n  B-->>A: Oi, tudo bem?\n'
    ]
  ]);
  const layouts = new Map<string, LayoutOverrides>();

  const tree = (): FileNode[] =>
    [...files.keys()].sort().map((p) => ({ name: p.split('/').pop()!, path: p, kind: 'file' as const }));

  const api: Api = {
    newProjectDialog: async () => ROOT,
    openProjectDialog: async () => ROOT,
    readTree: async () => tree(),
    readFile: async (p) => files.get(p) ?? '',
    writeFile: async (p, c) => void files.set(p, c),
    createFile: async (dir, name, content) => {
      let path = `${dir}/${name}`;
      let i = 2;
      while (files.has(path)) path = `${dir}/${name.replace(/\.mmd$/, '')} ${i++}.mmd`;
      files.set(path, content);
      return path;
    },
    createFolder: async (dir, name) => `${dir}/${name}`,
    duplicateFile: async (p) => {
      const copy = p.replace(/\.mmd$/, ' cópia.mmd');
      files.set(copy, files.get(p) ?? '');
      return copy;
    },
    renamePath: async (oldPath, newName) => {
      const next = `${oldPath.split('/').slice(0, -1).join('/')}/${newName}`;
      files.set(next, files.get(oldPath) ?? '');
      files.delete(oldPath);
      return next;
    },
    trashPath: async (p) => void files.delete(p),
    readLayout: async (p) => layouts.get(p) ?? {},
    writeLayout: async (p, data) => void layouts.set(p, data),
    getRecents: async () => [ROOT],
    addRecent: async () => [ROOT],
    exportSave: async (opts) => {
      const blob =
        opts.encoding === 'base64'
          ? new Blob([Uint8Array.from(atob(opts.data), (c) => c.charCodeAt(0))])
          : new Blob([opts.data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = opts.defaultName;
      a.click();
      return opts.defaultName;
    },
    exportPdf: async () => {
      alert('Exportação em PDF disponível apenas no app desktop.');
      return null;
    },
    updaterCheck: async () => undefined,
    updaterDownload: async () => undefined,
    updaterInstall: async () => undefined,
    openReleases: async () => undefined,
    getVersion: async () => 'dev',
    onMenu: () => () => undefined,
    onUpdaterEvent: () => () => undefined
  };

  window.api = api;
}
