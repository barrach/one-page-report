/**
 * Prepara as telas do One Page Report para uso em material de divulgacao:
 * remove a barra lateral (que traz o logo) e substitui os dados do projeto real
 * por dados de demonstracao, repintando o fundo a partir de uma linha limpa.
 *
 * Uso: node catalogo/sanitizar-telas.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ORIGEM = path.join(__dirname, '..', 'OnePageReport');
const DESTINO = path.join(__dirname, 'img');

const SIDEBAR_FIM = 222;   // primeira coluna de conteudo, depois da barra lateral
const SCROLLBAR = 1902;    // primeira coluna da barra de rolagem
const FONTE = 'Segoe UI, Inter, Arial, sans-serif';
const MONO = 'Consolas, Courier New, monospace';

const PROJETO = 'MONTAGEM ELETROMECANICA - UNIDADE 200';
const TAREFA_RAIZ = 'Unidade 200 - Montagem Eletromecanica & Elétrica/Instrumentação';
const CLIENTE = 'CLIENTE DEMONSTRAÇÃO';
const GESTOR = 'Ana Martins';
const CONTRATO = 'CT-2026-0142';
const ARQUIVO = '06- Report semanal - Semana 24.xlsx';

const TELAS = [
  {
    origem: 'Captura de tela 2026-08-20 084747.png',
    saida: '01-relatorio-indicadores',
    patches: [
      { box: [270, 67, 348, 20], srcY: 64,
        linhas: [{ t: PROJETO, x: 272, base: 81, size: 15, peso: 600, ls: 0.2 }] },
      { box: [275, 126, 281, 16], srcY: 158,
        linhas: [{ t: CLIENTE, x: 277, base: 138, size: 13, peso: 600 }] },
      { box: [275, 142, 281, 14], srcY: 158,
        linhas: [{ t: CONTRATO, x: 277, base: 153, size: 11, peso: 400 }] },
      { box: [606, 133, 300, 16], srcY: 158,
        linhas: [{ t: GESTOR, x: 608, base: 145, size: 13, peso: 500 }] },
    ],
  },
  { origem: 'Captura de tela 2026-08-20 084825.png', saida: '02-curvas-histograma', patches: [] },
  {
    origem: 'Captura de tela 2026-08-20 084853.png',
    saida: '03-cronograma',
    patches: [
      { box: [495, 177, 204, 16], srcY: 178,
        linhas: [{ t: 'Unidade 200 - Montagem', x: 497, base: 189, size: 13, peso: 700 }] },
    ],
  },
  { origem: 'Captura de tela 2026-08-20 084926.png', saida: '04-pontos-atencao', patches: [] },
  {
    origem: 'Captura de tela 2026-08-20 084956.png',
    saida: '05-dados-importacao',
    patches: [
      { box: [252, 27, 347, 17], srcY: 24,
        linhas: [{ t: PROJETO, x: 254, base: 40, size: 15, peso: 400 }] },
      { box: [277, 385, 350, 19], srcY: 382,
        linhas: [{ t: PROJETO, x: 279, base: 399, size: 15, peso: 400 }] },
      { box: [815, 385, 200, 19], srcY: 382,
        linhas: [{ t: CLIENTE, x: 817, base: 399, size: 15, peso: 400 }] },
      { box: [1354, 385, 200, 19], srcY: 382,
        linhas: [{ t: GESTOR, x: 1356, base: 399, size: 15, peso: 400 }] },
    ],
  },
  {
    origem: 'Captura de tela 2026-08-20 085030.png',
    saida: '06-import-inteligente',
    patches: [
      { box: [252, 29, 347, 17], srcY: 26,
        linhas: [{ t: PROJETO, x: 254, base: 41, size: 15, peso: 400 }] },
      { box: [277, 386, 297, 19], srcY: 384,
        linhas: [{ t: PROJETO, x: 279, base: 400, size: 15, peso: 400 }] },
      { box: [1353, 387, 200, 19], srcY: 384,
        linhas: [{ t: GESTOR, x: 1356, base: 400, size: 15, peso: 400 }] },
      { box: [917, 533, 265, 15], srcY: 530,
        linhas: [{ t: ARQUIVO, x: 923, base: 544, size: 10.5, peso: 400, fam: MONO }] },
      { box: [944, 583, 265, 15], srcY: 580,
        linhas: [{ t: ARQUIVO, x: 950, base: 594, size: 10.5, peso: 400, fam: MONO }] },
      { box: [884, 633, 265, 15], srcY: 630,
        linhas: [{ t: ARQUIVO, x: 890, base: 644, size: 10.5, peso: 400, fam: MONO }] },
      { box: [988, 683, 265, 15], srcY: 680,
        linhas: [{ t: ARQUIVO, x: 994, base: 694, size: 10.5, peso: 400, fam: MONO }] },
    ],
  },
  {
    origem: 'Captura de tela 2026-08-20 085059.png',
    saida: '07-dados-tabelas',
    patches: [
      { box: [390, 634, 430, 15], srcY: 633,
        linhas: [{ t: TAREFA_RAIZ, x: 393, base: 645, size: 12, peso: 700 }] },
    ],
  },
];

const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** cor de fundo dominante e cor do traco do texto dentro da caixa */
function amostrar(raw, info, [x, y, w, h]) {
  const ch = info.channels;
  const at = (px, py) => { const i = (py * info.width + px) * ch; return [raw[i], raw[i + 1], raw[i + 2]]; };
  const contagem = new Map();
  const pixels = [];
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const c = at(px, py);
      contagem.set(c.join(','), (contagem.get(c.join(',')) || 0) + 1);
      pixels.push(c);
    }
  }
  const fundo = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  const dist = (c) => Math.abs(c[0] - fundo[0]) + Math.abs(c[1] - fundo[1]) + Math.abs(c[2] - fundo[2]);
  const nucleo = pixels.sort((a, b) => dist(b) - dist(a)).slice(0, Math.max(1, Math.round(pixels.length * 0.06)));
  const traco = [0, 1, 2].map((k) => nucleo.reduce((s, c) => s + c[k], 0) / nucleo.length);
  return { fundo, traco };
}

(async () => {
  fs.mkdirSync(DESTINO, { recursive: true });
  for (const tela of TELAS) {
    const src = path.join(ORIGEM, tela.origem);
    const meta = await sharp(src).metadata();
    const { data: raw, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
    const camadas = [];

    for (const p of tela.patches) {
      const [x, y, w, h] = p.box;
      const { traco } = amostrar(raw, info, p.box);
      // fundo: estica uma linha limpa da propria imagem, preservando gradiente
      const tile = await sharp(src)
        .extract({ left: x, top: p.srcY, width: w, height: 1 })
        .resize({ width: w, height: h, kernel: 'nearest', fit: 'fill' })
        .png().toBuffer();
      camadas.push({ input: tile, left: x, top: y });

      const textos = p.linhas.map((l) => {
        const fam = l.fam || FONTE;
        const ls = l.ls ? ` letter-spacing="${l.ls}"` : '';
        return `<text x="${l.x - x}" y="${l.base - y}" font-family="${fam}" font-size="${l.size}"`
          + ` font-weight="${l.peso}" fill="${l.cor || hex(traco)}"${ls}>${esc(l.t)}</text>`;
      }).join('');
      const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
        + `<defs><clipPath id="c"><rect width="${w}" height="${h}"/></clipPath></defs>`
        + `<g clip-path="url(#c)">${textos}</g></svg>`
      );
      camadas.push({ input: svg, left: x, top: y });
      console.log(`  ${tela.saida} patch ${p.box.join(',')} traco=${hex(traco)}`);
    }

    let img = sharp(src);
    if (camadas.length) img = sharp(await img.composite(camadas).png().toBuffer());
    await img
      .extract({ left: SIDEBAR_FIM, top: 0, width: SCROLLBAR - SIDEBAR_FIM, height: meta.height })
      .png({ compressionLevel: 9 })
      .toFile(path.join(DESTINO, tela.saida + '.png'));
    console.log(`${tela.saida}.png pronto`);
  }
})();
