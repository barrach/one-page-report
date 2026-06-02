import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext('2d');

// Fundo gradiente azul escuro
const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
gradient.addColorStop(0, '#0F172A');
gradient.addColorStop(1, '#1E3A5F');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1200, 630);

// Logo "M" grande à esquerda
ctx.fillStyle = '#3B82F6';
ctx.font = 'bold 180px Arial';
ctx.fillText('M', 80, 300);

// Linha divisória vertical
ctx.strokeStyle = '#3B82F6';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(300, 100);
ctx.lineTo(300, 530);
ctx.stroke();

// Texto principal
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 72px Arial';
ctx.fillText('MegaHub', 340, 200);

// Subtítulo
ctx.fillStyle = '#94A3B8';
ctx.font = '36px Arial';
ctx.fillText('Plataforma Integrada MEGASTEAM', 340, 270);

// Linha separadora
ctx.strokeStyle = '#334155';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(340, 310);
ctx.lineTo(1100, 310);
ctx.stroke();

// 4 módulos
const modules = [
  { icon: '📊', name: 'MegaPricing', desc: 'Orçamentos' },
  { icon: '💰', name: 'Controladoria', desc: 'Financeiro' },
  { icon: '⚡', name: 'ProdControl', desc: 'Produtividade' },
  { icon: '📋', name: 'One Page Report', desc: 'Relatórios IA' },
];
modules.forEach((m, i) => {
  const x = 340 + i * 190;
  ctx.fillStyle = '#1E293B';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, 340, 170, 120, 10);
    ctx.fill();
  } else {
    ctx.fillRect(x, 340, 170, 120);
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '28px Arial';
  ctx.fillText(m.icon, x + 15, 395);
  ctx.font = 'bold 18px Arial';
  ctx.fillText(m.name, x + 15, 425);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px Arial';
  ctx.fillText(m.desc, x + 15, 448);
});

// URL no rodapé
ctx.fillStyle = '#64748B';
ctx.font = '22px Arial';
ctx.fillText('megahub-nu.vercel.app', 340, 580);

writeFileSync('public/og-image.png', canvas.toBuffer('image/png'));
console.log('og-image.png gerado com sucesso!');
