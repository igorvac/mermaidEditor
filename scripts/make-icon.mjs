import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/**
 * Gera build/icon.icns a partir de src/assets/logo-color.svg:
 * squircle branco (estilo macOS Big Sur) com a logo centralizada.
 */

const SIZE = 1024;
// proporções do template de ícone do macOS: o squircle ocupa ~82% do canvas
const SQUIRCLE = Math.round(SIZE * 0.82);
const RADIUS = Math.round(SQUIRCLE * 0.225);
const LOGO_H = Math.round(SQUIRCLE * 0.68);

const logoSvg = readFileSync('src/assets/logo-color.svg');

const logo = await sharp(logoSvg, { density: 300 })
  .resize({ height: LOGO_H, fit: 'inside' })
  .png()
  .toBuffer();
const logoMeta = await sharp(logo).metadata();

const background = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
     <defs>
       <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#ffffff"/>
         <stop offset="1" stop-color="#f3e9f6"/>
       </linearGradient>
     </defs>
     <rect x="${(SIZE - SQUIRCLE) / 2}" y="${(SIZE - SQUIRCLE) / 2}"
           width="${SQUIRCLE}" height="${SQUIRCLE}" rx="${RADIUS}"
           fill="url(#bg)" stroke="rgba(70,87,117,0.10)" stroke-width="4"/>
   </svg>`
);

const master = await sharp(background)
  .composite([
    {
      input: logo,
      left: Math.round((SIZE - logoMeta.width) / 2),
      top: Math.round((SIZE - logoMeta.height) / 2)
    }
  ])
  .png()
  .toBuffer();

rmSync('build/icon.iconset', { recursive: true, force: true });
mkdirSync('build/icon.iconset', { recursive: true });

for (const px of [16, 32, 64, 128, 256, 512, 1024]) {
  const buf = await sharp(master).resize(px, px).png().toBuffer();
  if (px <= 512) writeFileSync(`build/icon.iconset/icon_${px}x${px}.png`, buf);
  if (px >= 32) writeFileSync(`build/icon.iconset/icon_${px / 2}x${px / 2}@2x.png`, buf);
}

execSync('iconutil -c icns build/icon.iconset -o build/icon.icns');
writeFileSync('build/icon.png', master);
rmSync('build/icon.iconset', { recursive: true });
console.log('build/icon.icns e build/icon.png gerados');
