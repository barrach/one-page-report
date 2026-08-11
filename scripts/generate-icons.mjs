// Gera todos os ícones (PWA, apple-touch, favicons) a partir de um único PNG mestre.
// Uso: node scripts/generate-icons.mjs
import { writeFileSync } from 'fs';
import sharp from 'sharp';

const SOURCE = 'logo pwa - one page report.png';

const targets = [
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/apple-touch-icon.png', 180],
  ['public/favicon-32x32.png', 32],
  ['public/favicon-32.png', 32],
  ['public/favicon-16x16.png', 16],
];

const render = (size) =>
  sharp(SOURCE).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

for (const [file, size] of targets) {
  writeFileSync(file, await render(size));
  console.log('wrote', file, `(${size}x${size})`);
}

// Ícone maskable: o Android recorta ~20% das bordas, então o logo entra reduzido
// sobre o mesmo fundo do PNG mestre (rgb 40,45,45).
const MASKABLE = 512;
const inner = Math.round(MASKABLE * 0.72);
// A moldura usa a cor dominante do PNG mestre, para não aparecer emenda entre fundo e logo.
const { dominant } = await sharp(SOURCE).stats();
writeFileSync(
  'public/pwa-maskable-512.png',
  await sharp({
    create: { width: MASKABLE, height: MASKABLE, channels: 4, background: { ...dominant, alpha: 1 } },
  })
    .composite([{ input: await render(inner), gravity: 'centre' }])
    .png()
    .toBuffer()
);
console.log('wrote public/pwa-maskable-512.png (512x512, maskable)');

// favicon.ico com um único frame 32x32 em PNG embutido (formato aceito por todos os browsers atuais)
const png32 = await render(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // palette colors
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // color planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14); // size of image data
header.writeUInt32LE(22, 18); // offset of image data
writeFileSync('public/favicon.ico', Buffer.concat([header, png32]));
console.log('wrote public/favicon.ico (32x32)');

console.log('Ícones gerados com sucesso a partir de', SOURCE);
