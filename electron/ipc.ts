import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DIAGRAM_EXTS = new Set(['.mmd', '.mermaid']);
const LAYOUT_SUFFIX = '.layout.json';
const recentsFile = () => path.join(app.getPath('userData'), 'recents.json');

export interface FileNode {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  children?: FileNode[];
}

async function scanDir(dir: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      nodes.push({ name: entry.name, path: full, kind: 'folder', children: await scanDir(full) });
    } else if (DIAGRAM_EXTS.has(path.extname(entry.name)) && !entry.name.endsWith(LAYOUT_SUFFIX)) {
      nodes.push({ name: entry.name, path: full, kind: 'file' });
    }
  }
  nodes.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name, 'pt-BR') : a.kind === 'folder' ? -1 : 1
  );
  return nodes;
}

async function readRecents(): Promise<string[]> {
  try {
    const raw = await fs.readFile(recentsFile(), 'utf8');
    const list = JSON.parse(raw) as string[];
    const existing: string[] = [];
    for (const p of list) {
      try {
        const st = await fs.stat(p);
        if (st.isDirectory()) existing.push(p);
      } catch {
        /* projeto removido */
      }
    }
    return existing;
  } catch {
    return [];
  }
}

async function uniquePath(dir: string, base: string, ext: string): Promise<string> {
  let candidate = path.join(dir, `${base}${ext}`);
  let i = 2;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${base} ${i}${ext}`);
      i++;
    } catch {
      return candidate;
    }
  }
}

export function registerIpc() {
  ipcMain.handle('dialog:newProject', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win!, {
      title: 'Novo projeto',
      buttonLabel: 'Criar projeto',
      nameFieldLabel: 'Nome do projeto',
      defaultPath: path.join(os.homedir(), 'Documents', 'Meu Projeto Mermaid'),
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    if (res.canceled || !res.filePath) return null;
    await fs.mkdir(res.filePath, { recursive: true });
    return res.filePath;
  });

  ipcMain.handle('dialog:openProject', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Abrir projeto',
      buttonLabel: 'Abrir',
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('project:tree', (_e, root: string) => scanDir(root));

  ipcMain.handle('file:read', (_e, p: string) => fs.readFile(p, 'utf8'));

  ipcMain.handle('file:write', (_e, p: string, content: string) => fs.writeFile(p, content, 'utf8'));

  ipcMain.handle('file:create', async (_e, dir: string, name: string, content: string) => {
    const ext = path.extname(name) || '.mmd';
    const base = path.basename(name, path.extname(name));
    const full = await uniquePath(dir, base, ext);
    await fs.writeFile(full, content, 'utf8');
    return full;
  });

  ipcMain.handle('folder:create', async (_e, dir: string, name: string) => {
    const full = await uniquePath(dir, name, '');
    await fs.mkdir(full, { recursive: true });
    return full;
  });

  ipcMain.handle('file:duplicate', async (_e, p: string) => {
    const dir = path.dirname(p);
    const ext = path.extname(p);
    const base = `${path.basename(p, ext)} cópia`;
    const full = await uniquePath(dir, base, ext);
    await fs.copyFile(p, full);
    try {
      await fs.copyFile(`${p}${LAYOUT_SUFFIX}`, `${full}${LAYOUT_SUFFIX}`);
    } catch {
      /* sem layout */
    }
    return full;
  });

  ipcMain.handle('fs:rename', async (_e, oldPath: string, newName: string) => {
    const full = path.join(path.dirname(oldPath), newName);
    await fs.rename(oldPath, full);
    try {
      await fs.rename(`${oldPath}${LAYOUT_SUFFIX}`, `${full}${LAYOUT_SUFFIX}`);
    } catch {
      /* sem layout */
    }
    return full;
  });

  ipcMain.handle('fs:trash', async (_e, p: string) => {
    await shell.trashItem(p);
    try {
      await shell.trashItem(`${p}${LAYOUT_SUFFIX}`);
    } catch {
      /* sem layout */
    }
  });

  ipcMain.handle('layout:read', async (_e, filePath: string) => {
    try {
      return JSON.parse(await fs.readFile(`${filePath}${LAYOUT_SUFFIX}`, 'utf8'));
    } catch {
      return {};
    }
  });

  ipcMain.handle('layout:write', async (_e, filePath: string, data: Record<string, [number, number]>) => {
    const target = `${filePath}${LAYOUT_SUFFIX}`;
    if (!data || Object.keys(data).length === 0) {
      try {
        await fs.unlink(target);
      } catch {
        /* já não existe */
      }
      return;
    }
    await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');
  });

  ipcMain.handle('recents:get', () => readRecents());

  ipcMain.handle('recents:add', async (_e, p: string) => {
    const list = await readRecents();
    const next = [p, ...list.filter((x) => x !== p)].slice(0, 8);
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    await fs.writeFile(recentsFile(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  });

  ipcMain.handle(
    'export:save',
    async (_e, opts: { defaultName: string; filterName: string; ext: string; data: string; encoding: 'utf8' | 'base64' }) => {
      const win = BrowserWindow.getFocusedWindow();
      const res = await dialog.showSaveDialog(win!, {
        title: 'Exportar',
        defaultPath: path.join(os.homedir(), 'Downloads', opts.defaultName),
        filters: [{ name: opts.filterName, extensions: [opts.ext] }]
      });
      if (res.canceled || !res.filePath) return null;
      await fs.writeFile(res.filePath, Buffer.from(opts.data, opts.encoding));
      return res.filePath;
    }
  );

  ipcMain.handle(
    'export:pdf',
    async (_e, opts: { svg: string; width: number; height: number; defaultName: string }) => {
      const win = BrowserWindow.getFocusedWindow();
      const res = await dialog.showSaveDialog(win!, {
        title: 'Exportar PDF',
        defaultPath: path.join(os.homedir(), 'Downloads', opts.defaultName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (res.canceled || !res.filePath) return null;

      const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}</style></head><body>${opts.svg}</body></html>`;
      const tmp = path.join(os.tmpdir(), `mermaid-studio-pdf-${Date.now()}.html`);
      await fs.writeFile(tmp, html, 'utf8');

      const hidden = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true }
      });
      try {
        await hidden.loadFile(tmp);
        // pequena espera para garantir fontes aplicadas
        await new Promise((r) => setTimeout(r, 300));
        const pdf = await hidden.webContents.printToPDF({
          pageSize: { width: opts.width / 96, height: opts.height / 96 },
          printBackground: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });
        await fs.writeFile(res.filePath, pdf);
        return res.filePath;
      } finally {
        hidden.destroy();
        fs.unlink(tmp).catch(() => undefined);
      }
    }
  );

  ipcMain.handle('app:version', () => app.getVersion());
}
