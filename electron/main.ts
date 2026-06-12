import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { setupUpdater, checkForUpdates } from './updater';

const devUrl = process.env.VITE_DEV_SERVER_URL;

function sendMenu(action: string) {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu', action);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    backgroundColor: '#F6E8EA',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.once('ready-to-show', () => win.show());

  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'Sobre o OpenMermaid' },
        { label: 'Verificar atualizações…', click: () => checkForUpdates(true) },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar' },
        { role: 'hideOthers', label: 'Ocultar outros' },
        { role: 'unhide', label: 'Mostrar tudo' },
        { type: 'separator' },
        { role: 'quit', label: 'Encerrar OpenMermaid' }
      ]
    },
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Novo diagrama', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new-file') },
        { label: 'Novo projeto…', accelerator: 'Shift+CmdOrCtrl+N', click: () => sendMenu('new-project') },
        { label: 'Abrir projeto…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open-project') },
        { type: 'separator' },
        { label: 'Salvar', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
        { type: 'separator' },
        {
          label: 'Exportar',
          submenu: [
            { label: 'SVG…', click: () => sendMenu('export-svg') },
            { label: 'PNG…', accelerator: 'Shift+CmdOrCtrl+E', click: () => sendMenu('export-png') },
            { label: 'PDF…', click: () => sendMenu('export-pdf') }
          ]
        },
        { type: 'separator' },
        { label: 'Fechar projeto', click: () => sendMenu('close-project') }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Ampliar', accelerator: 'CmdOrCtrl+=', click: () => sendMenu('zoom-in') },
        { label: 'Reduzir', accelerator: 'CmdOrCtrl+-', click: () => sendMenu('zoom-out') },
        { label: 'Zoom 100%', accelerator: 'CmdOrCtrl+0', click: () => sendMenu('zoom-reset') },
        { label: 'Ajustar à tela', accelerator: 'Shift+CmdOrCtrl+0', click: () => sendMenu('zoom-fit') },
        { type: 'separator' },
        { label: 'Alternar painel de código', accelerator: 'Shift+CmdOrCtrl+L', click: () => sendMenu('toggle-code') },
        { label: 'Alternar barra lateral', accelerator: 'Shift+CmdOrCtrl+B', click: () => sendMenu('toggle-sidebar') },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' }
      ]
    },
    {
      label: 'Janela',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        { type: 'separator' },
        { role: 'front', label: 'Trazer tudo para frente' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  const win = createWindow();
  setupUpdater(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
