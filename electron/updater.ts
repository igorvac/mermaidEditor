import { app, ipcMain, shell, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

// Mesmo OWNER/REPO do electron-builder.yml — o repositório precisa ser público
// para o updater consultar as releases sem token.
export const GITHUB_OWNER = 'igorvac';
export const GITHUB_REPO = 'mermaidEditor';

const releasesUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

let mainWindow: BrowserWindow | null = null;

function send(type: string, data: Record<string, unknown> = {}) {
  mainWindow?.webContents.send('updater:event', { type, ...data });
}

export function checkForUpdates(userInitiated = false) {
  if (!app.isPackaged) {
    if (userInitiated) send('dev-mode');
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    if (userInitiated) send('error', { message: String(err?.message ?? err) });
  });
}

export function setupUpdater(win: BrowserWindow) {
  mainWindow = win;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => send('not-available'));
  autoUpdater.on('download-progress', (p) => send('progress', { percent: p.percent }));
  autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => send('error', { message: String(err?.message ?? err) }));

  ipcMain.handle('updater:check', () => checkForUpdates(true));
  ipcMain.handle('updater:download', () =>
    autoUpdater.downloadUpdate().catch((err) => send('error', { message: String(err?.message ?? err) }))
  );
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());
  ipcMain.handle('updater:openReleases', () => shell.openExternal(releasesUrl));

  if (app.isPackaged) {
    setTimeout(() => checkForUpdates(), 5000);
    setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000);
  }
}
