import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api = {
  newProjectDialog: (): Promise<string | null> => invoke('dialog:newProject') as Promise<string | null>,
  openProjectDialog: (): Promise<string | null> => invoke('dialog:openProject') as Promise<string | null>,
  readTree: (root: string) => invoke('project:tree', root),
  readFile: (p: string) => invoke('file:read', p),
  writeFile: (p: string, content: string) => invoke('file:write', p, content),
  createFile: (dir: string, name: string, content: string) => invoke('file:create', dir, name, content),
  createFolder: (dir: string, name: string) => invoke('folder:create', dir, name),
  duplicateFile: (p: string) => invoke('file:duplicate', p),
  renamePath: (oldPath: string, newName: string) => invoke('fs:rename', oldPath, newName),
  trashPath: (p: string) => invoke('fs:trash', p),
  readLayout: (filePath: string) => invoke('layout:read', filePath),
  writeLayout: (filePath: string, data: Record<string, [number, number]>) =>
    invoke('layout:write', filePath, data),
  getRecents: () => invoke('recents:get'),
  addRecent: (p: string) => invoke('recents:add', p),
  exportSave: (opts: {
    defaultName: string;
    filterName: string;
    ext: string;
    data: string;
    encoding: 'utf8' | 'base64';
  }) => invoke('export:save', opts),
  exportPdf: (opts: { svg: string; width: number; height: number; defaultName: string }) =>
    invoke('export:pdf', opts),
  updaterCheck: () => invoke('updater:check'),
  updaterDownload: () => invoke('updater:download'),
  updaterInstall: () => invoke('updater:install'),
  openReleases: () => invoke('updater:openReleases'),
  getVersion: () => invoke('app:version'),
  onMenu: (cb: (action: string) => void) => {
    const listener = (_e: IpcRendererEvent, action: string) => cb(action);
    ipcRenderer.on('menu', listener);
    return () => ipcRenderer.removeListener('menu', listener);
  },
  onUpdaterEvent: (cb: (ev: { type: string; [k: string]: unknown }) => void) => {
    const listener = (_e: IpcRendererEvent, ev: { type: string }) => cb(ev);
    ipcRenderer.on('updater:event', listener);
    return () => ipcRenderer.removeListener('updater:event', listener);
  }
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
