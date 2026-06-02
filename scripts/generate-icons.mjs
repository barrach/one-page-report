import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fundo azul escuro com bordas arredondadas
  const radius = size * 0.22;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Letra "M" branca centralizada
  const fontSize = size * 0.55;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', size / 2, size / 2 + size * 0.03);

  return canvas.toBuffer('image/png');
}

const targets = [
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/apple-touch-icon.png', 180],
  ['public/favicon-32x32.png', 32],
  ['public/favicon-16x16.png', 16],
];

for (const [file, size] of targets) {
  writeFileSync(file, generateIcon(size));
  console.log('wrote', file, `(${size}x${size})`);
}
console.log('Ícones gerados com sucesso.');
