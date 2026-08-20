/**
 * Monta o catalogo final: troca cada {{IMG:nome}} do template pela imagem
 * correspondente de catalogo/img embutida como data URI, para que o arquivo
 * seja autossuficiente (o Artifact bloqueia qualquer host externo).
 *
 * Uso: node catalogo/montar.cjs
 */
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const template = fs.readFileSync(path.join(AQUI, 'catalogo.template.html'), 'utf8');

let faltando = [];
const html = template.replace(/\{\{IMG:([\w-]+)\}\}/g, (_, nome) => {
  const arquivo = path.join(AQUI, 'img', nome + '.webp');
  if (!fs.existsSync(arquivo)) {
    faltando.push(nome);
    return '';
  }
  return 'data:image/webp;base64,' + fs.readFileSync(arquivo).toString('base64');
});

if (faltando.length) {
  console.error('imagens ausentes:', faltando.join(', '));
  process.exit(1);
}

const saida = path.join(AQUI, 'catalogo.html');
fs.writeFileSync(saida, html);
console.log('catalogo.html:', (fs.statSync(saida).size / 1024 / 1024).toFixed(2) + ' MB');
