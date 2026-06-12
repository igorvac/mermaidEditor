/**
 * Captura docs/screenshot.png a partir do app rodando no vite dev server.
 * Uso: npx vite & npx electron scripts/capture-screenshot.cjs
 * Sem preload o renderer usa o mock de window.api (projeto demo em memória).
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1360,
    height: 850,
    show: false,
    backgroundColor: '#F6E8EA'
  });
  await win.loadURL(process.env.CAPTURE_URL ?? 'http://localhost:5180');
  await new Promise((r) => setTimeout(r, 1800));
  await win.webContents.executeJavaScript(`document.querySelector('.recent-card')?.click()`);
  await new Promise((r) => setTimeout(r, 2600));
  const image = await win.webContents.capturePage();
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/screenshot.png', image.toPNG());
  console.log('docs/screenshot.png gerado');
  app.quit();
});
