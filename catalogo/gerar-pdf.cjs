/**
 * Renderiza catalogo/catalogo.html em PDF A4 usando o Chrome instalado.
 *
 * A folha de impressao do template cuida do resto: paleta clara forcada, capa
 * na primeira pagina, e uma pagina em paisagem para cada captura de tela — em
 * retrato o texto dos paineis fica pequeno demais para ler no papel.
 *
 * Uso: node catalogo/gerar-pdf.cjs
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const ENTRADA = path.join(AQUI, 'catalogo.html');
const SAIDA = path.join(AQUI, 'One Page Report - catalogo.pdf');

const CANDIDATOS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const navegador = CANDIDATOS.find((c) => fs.existsSync(c));
if (!navegador) {
  console.error('Nenhum Chrome ou Edge encontrado nos caminhos conhecidos.');
  process.exit(1);
}
if (!fs.existsSync(ENTRADA)) {
  console.error('Falta catalogo/catalogo.html — rode antes: node catalogo/montar.cjs');
  process.exit(1);
}

execFileSync(navegador, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-pdf-header-footer',
  // as fontes vem do Google Fonts; o orcamento de tempo virtual espera o carregamento
  '--virtual-time-budget=12000',
  '--print-to-pdf=' + SAIDA,
  'file:///' + ENTRADA.replace(/\\/g, '/'),
], { stdio: 'inherit' });

const mb = (fs.statSync(SAIDA).size / 1024 / 1024).toFixed(2);
console.log(`\n${path.basename(SAIDA)}: ${mb} MB`);
