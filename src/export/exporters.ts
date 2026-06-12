import ubuntu400 from '@fontsource/ubuntu/files/ubuntu-latin-400-normal.woff2?url';
import ubuntu500 from '@fontsource/ubuntu/files/ubuntu-latin-500-normal.woff2?url';
import ubuntu700 from '@fontsource/ubuntu/files/ubuntu-latin-700-normal.woff2?url';

/**
 * Exportação 100% offline: a fonte Ubuntu (asset local do bundle) é embutida
 * em base64 no próprio SVG para que PNG/PDF/SVG renderizem fiéis fora do app.
 */

let fontCss: string | null = null;

async function toBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function getFontCss(): Promise<string> {
  if (fontCss) return fontCss;
  const faces = await Promise.all(
    (
      [
        [ubuntu400, 400],
        [ubuntu500, 500],
        [ubuntu700, 700]
      ] as const
    ).map(
      async ([url, weight]) =>
        `@font-face{font-family:'Ubuntu';font-weight:${weight};src:url(data:font/woff2;base64,${await toBase64(url)}) format('woff2');}`
    )
  );
  fontCss = faces.join('\n');
  return fontCss;
}

function currentSvg(): SVGSVGElement | null {
  return document.querySelector<SVGSVGElement>('#svg-host svg');
}

async function serializeForExport(): Promise<{ markup: string; width: number; height: number } | null> {
  const live = currentSvg();
  if (!live) return null;
  const clone = live.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.is-selected, .is-connect-from').forEach((el) => {
    el.classList.remove('is-selected', 'is-connect-from');
  });
  const width = parseFloat(live.getAttribute('width') ?? '0') || live.getBoundingClientRect().width;
  const height = parseFloat(live.getAttribute('height') ?? '0') || live.getBoundingClientRect().height;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `${await getFontCss()}\nsvg{font-family:'Ubuntu','Helvetica Neue',sans-serif;}`;
  clone.insertBefore(style, clone.firstChild);

  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function baseName(fileName: string): string {
  return fileName.replace(/\.(mmd|mermaid)$/i, '') || 'diagrama';
}

export async function exportSvg(fileName: string): Promise<string | null> {
  const data = await serializeForExport();
  if (!data) return null;
  return window.api.exportSave({
    defaultName: `${baseName(fileName)}.svg`,
    filterName: 'SVG',
    ext: 'svg',
    data: data.markup,
    encoding: 'utf8'
  });
}

export async function exportPng(fileName: string, scale = 2): Promise<string | null> {
  const data = await serializeForExport();
  if (!data) return null;

  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Falha ao rasterizar o SVG'));
  });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.markup)}`;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(data.width * scale));
  canvas.height = Math.max(1, Math.round(data.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL('image/png').split(',')[1];
  return window.api.exportSave({
    defaultName: `${baseName(fileName)}.png`,
    filterName: 'PNG',
    ext: 'png',
    data: base64,
    encoding: 'base64'
  });
}

export async function exportPdf(fileName: string): Promise<string | null> {
  const data = await serializeForExport();
  if (!data) return null;
  return window.api.exportPdf({
    svg: data.markup,
    width: data.width,
    height: data.height,
    defaultName: `${baseName(fileName)}.pdf`
  });
}
