/**
 * Evidências fotográficas da obra.
 *
 * A foto vai para o Storage do Supabase; o projeto guarda só o ponteiro e a
 * legenda. Guardar a imagem dentro do JSON do projeto estouraria tudo: o store
 * espelha o projeto inteiro no localStorage a cada alteração, e uma foto de
 * celular em base64 passa dos 5 MB de cota sozinha.
 */

export const BUCKET_EVIDENCIAS = 'evidencias';

export interface Evidencia {
  id: string;
  /** Caminho dentro do bucket. */
  caminho: string;
  legenda: string;
  /** ISO de quando foi enviada. */
  data: string;
  autor?: string;
}

/**
 * Reduz a foto antes de subir.
 *
 * Foto de celular chega com 3 a 8 MB. Numa obra com sinal ruim isso é minutos de
 * upload, e no PDF cada foto vira uma página pesada sem ganho nenhum de leitura
 * — 1600 px de lado maior já é mais do que o papel A4 aproveita.
 *
 * Se a imagem não puder ser lida, devolve o arquivo original em vez de falhar: é
 * melhor subir grande do que não subir.
 */
export const reduzirImagem = async (
  arquivo: File,
  ladoMaximo = 1600,
  qualidade = 0.8,
): Promise<Blob> => {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const maior = Math.max(bitmap.width, bitmap.height);
    const escala = maior > ladoMaximo ? ladoMaximo / maior : 1;

    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext('2d');
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      tela.toBlob(resolve, 'image/jpeg', qualidade),
    );
    // Só vale a pena trocar se realmente ficou menor.
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    return arquivo;
  }
};

/** Nome de arquivo seguro para o Storage: sem acento, espaço nem barra. */
export const nomeSeguro = (nome: string): string =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'foto.jpg';

/**
 * Caminho da foto no bucket.
 *
 * O id do projeto é a primeira pasta: separa as obras e deixa a política do
 * Storage poder ser apertada por projeto depois, sem migrar arquivo.
 */
export const caminhoDaEvidencia = (projetoId: string, nomeArquivo: string, carimbo: number): string =>
  `${projetoId}/${carimbo}-${nomeSeguro(nomeArquivo)}`;

/** "2,4 MB" — para a tela dizer o tamanho antes e depois da redução. */
export const formatarTamanho = (bytes: number): string => {
  if (!isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};
