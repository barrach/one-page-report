/**
 * Divide a altura de uma captura em páginas, cortando em pontos de quebra.
 *
 * Recebe as posições onde é seguro cortar (fim de cada bloco do relatório, fim de
 * cada linha de tabela) e escolhe, para cada página, a última quebra que ainda
 * cabe. Assim nenhum card nem linha de tabela é partido ao meio.
 *
 * Quando um único bloco é mais alto que a página, não há alternativa: corta no
 * limite da página — melhor isso do que devolver uma página vazia e travar.
 */
export const paginar = (
  alturaTotal: number,
  alturaPagina: number,
  pontosQuebra: number[],
  /** Sobra mínima de página para valer a pena cortar ali. */
  minimoUtil = 40,
): { inicio: number; fim: number }[] => {
  if (alturaTotal <= 0 || alturaPagina <= 0) return [];

  const pontos = [...new Set(pontosQuebra)]
    .filter((y) => y > 0 && y <= alturaTotal)
    .sort((a, b) => a - b);

  const paginas: { inicio: number; fim: number }[] = [];
  let y = 0;

  while (y < alturaTotal) {
    const limite = y + alturaPagina;

    // Se o que falta cabe numa página, fecha aqui.
    if (limite >= alturaTotal) {
      paginas.push({ inicio: y, fim: alturaTotal });
      break;
    }

    const candidatos = pontos.filter((q) => q > y + minimoUtil && q <= limite);
    const fim = candidatos.length ? candidatos[candidatos.length - 1] : limite;

    // Salvaguarda: sem avanço, o laço seria infinito.
    if (fim <= y) {
      paginas.push({ inicio: y, fim: alturaTotal });
      break;
    }

    paginas.push({ inicio: y, fim });
    y = fim;
  }

  return paginas;
};
