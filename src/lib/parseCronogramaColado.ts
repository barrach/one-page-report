import type { ScheduleRow } from '@/store/projectStore';

/**
 * Cronograma colado direto do MS Project.
 *
 * O caminho de arquivo (XLSX/XML) continua existindo; isto aqui cobre o jeito
 * que a obra realmente trabalha — selecionar as colunas no Project, copiar e
 * colar na tela. O mapeamento é pelo CABEÇALHO, não pela posição: cada
 * planejador monta a visão do Project com as colunas que quer, em qualquer
 * ordem, e exigir uma ordem fixa quebraria a cada projeto novo.
 */

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Date → "Seg 01/06/26", o mesmo formato que a importação por arquivo grava. */
export const formatarDataCronograma = (d: Date): string => {
  if (!d || isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  return `${DIAS_PT[d.getDay()]} ${dd}/${mm}/${aa}`;
};

const MESES_ABREV: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  feb: 1, apr: 3, may: 4, aug: 7, sep: 8, oct: 9, dec: 11,
};

/**
 * Lê a data como o Project cola: "Seg 01/06/26", "01/06/2026", "01/jun/26" ou
 * ISO. O dia da semana na frente é do próprio Project e precisa sair antes.
 */
export const lerDataCronograma = (bruto: string): Date | null => {
  const txt = String(bruto ?? '')
    .trim()
    .replace(/^(seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç]*\.?\s+/i, '');
  if (!txt || /^(na|nd|n\/?d)$/i.test(txt)) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const partes = txt.split(/[/\-.]/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 3) return null;

  const dia = parseInt(partes[0], 10);
  const mesTxt = partes[1].toLowerCase();
  const mes = /^\d+$/.test(mesTxt) ? parseInt(mesTxt, 10) - 1 : MESES_ABREV[mesTxt.slice(0, 3)];
  let ano = parseInt(partes[2], 10);
  if (!isFinite(dia) || mes == null || mes < 0 || mes > 11 || !isFinite(ano)) return null;
  if (ano < 100) ano += 2000;

  const d = new Date(ano, mes, dia);
  return isNaN(d.getTime()) ? null : d;
};

/** "45%", "0,45", "45" → 45. Fração vira percentual; o resto vem como está. */
export const lerPercentual = (bruto: string): number => {
  const txt = String(bruto ?? '').trim();
  if (!txt) return 0;
  const temSinal = txt.includes('%');
  const n = parseFloat(txt.replace('%', '').replace(/\s/g, '').replace(',', '.'));
  if (!isFinite(n)) return 0;
  return !temSinal && n > 0 && n <= 1 ? n * 100 : n;
};

export type CampoCronograma =
  | 'id' | 'tarefa' | 'nivel' | 'previsto' | 'trabalhoConcluido' | 'desvio'
  | 'inicio' | 'termino' | 'inicioBase' | 'terminoBase';

const normalizar = (v: string): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Mesma tabela de sinônimos da importação por arquivo — os dois caminhos têm de
 * reconhecer as mesmas colunas, senão o mesmo cronograma entraria diferente
 * dependendo de como foi trazido.
 *
 * A ordem importa: o mais específico primeiro, para a linha de base tomar a
 * coluna antes do início/término genéricos.
 */
const RECONHECEDORES: Array<{ campo: CampoCronograma; casa: (h: string) => boolean }> = [
  { campo: 'tarefa', casa: (h) => /nome.*tarefa|task\s*name|^tarefa$|^atividade$|^descricao$|^name$/.test(h) },
  { campo: 'nivel', casa: (h) => /^(nivel|nivel de topico|level|outline\s*level)$/.test(h) },
  { campo: 'inicioBase', casa: (h) => (h.includes('base') || h.includes('linha')) && (h.includes('inicio') || h.includes('start')) },
  { campo: 'terminoBase', casa: (h) => (h.includes('base') || h.includes('linha')) && (h.includes('termino') || h.includes('fim') || h.includes('finish')) },
  { campo: 'trabalhoConcluido', casa: (h) => (h.includes('trabalho') || h.includes('work')) && (h.includes('%') || h.includes('conclu')) },
  { campo: 'previsto', casa: (h) => !h.includes('trabalho') && !h.includes('work') && /%\s*previsto|%\s*prev\b|^previsto$|%\s*conclu|percent\s*complete|fisico\s*prev|avanco\s*prev/.test(h) },
  { campo: 'desvio', casa: (h) => /\b(desvio|variance|spi|diferenca)\b/.test(h) },
  { campo: 'inicio', casa: (h) => !h.includes('base') && !h.includes('linha') && /\b(inicio|start)\b/.test(h) },
  { campo: 'termino', casa: (h) => !h.includes('base') && !h.includes('linha') && /\b(termino|finish|conclusao)\b/.test(h) },
  { campo: 'id', casa: (h) => /^(id|wbs|edt|codigo|cod|numero|n)$/.test(h) },
];

export interface ColunaMapeada {
  campo: CampoCronograma;
  coluna: number;
  cabecalho: string;
}

export interface LeituraCronograma {
  linhas: ScheduleRow[];
  mapeamento: ColunaMapeada[];
  /** Campos que nenhuma coluna preencheu — a tela avisa antes de aplicar. */
  faltando: CampoCronograma[];
}

const VAZIO: LeituraCronograma = { linhas: [], mapeamento: [], faltando: [] };

const mapear = (cabecalhos: string[]): Partial<Record<CampoCronograma, ColunaMapeada>> => {
  const mapa: Partial<Record<CampoCronograma, ColunaMapeada>> = {};
  const usadas = new Set<number>();
  for (const { campo, casa } of RECONHECEDORES) {
    if (mapa[campo]) continue;
    for (let c = 0; c < cabecalhos.length; c++) {
      if (usadas.has(c) || !cabecalhos[c]) continue;
      if (casa(cabecalhos[c])) {
        mapa[campo] = { campo, coluna: c, cabecalho: cabecalhos[c] };
        usadas.add(c);
        break;
      }
    }
  }
  return mapa;
};

/** Nível vindo da EDT ("1.2.3" → 3), para quando não há coluna de nível. */
const nivelPelaEdt = (edt: string): number | null => {
  const t = String(edt ?? '').trim();
  if (!/^\d+(\.\d+)*$/.test(t)) return null;
  return t.split('.').length;
};

/**
 * Lê o cronograma colado.
 *
 * A linha de cabeçalho é a primeira que reconhece ao menos dois campos — antes
 * dela costuma vir o nome do projeto ou uma linha em branco que o Project
 * arrasta junto.
 */
export const lerCronogramaColado = (texto: string): LeituraCronograma => {
  const linhas = String(texto ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((c) => c.some((v) => v.trim() !== ''));
  if (linhas.length < 2) return VAZIO;

  let idxCabecalho = -1;
  let mapa: Partial<Record<CampoCronograma, ColunaMapeada>> = {};
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    const tentativa = mapear(linhas[i].map(normalizar));
    if (Object.keys(tentativa).length >= 2) { idxCabecalho = i; mapa = tentativa; break; }
  }
  if (idxCabecalho < 0) return VAZIO;

  const valor = (celulas: string[], campo: CampoCronograma): string => {
    const col = mapa[campo]?.coluna;
    return col == null ? '' : (celulas[col] ?? '').trim();
  };

  const corpo = linhas.slice(idxCabecalho + 1);
  const resultado: ScheduleRow[] = [];

  for (const celulas of corpo) {
    const tarefa = valor(celulas, 'tarefa');
    if (!tarefa) continue; // linha de total, separador ou sobra da seleção

    const id = valor(celulas, 'id');
    const nivelBruto = parseInt(valor(celulas, 'nivel'), 10);
    const nivel = isFinite(nivelBruto) && nivelBruto > 0
      ? nivelBruto
      : (nivelPelaEdt(id) ?? 1);

    const dataOu = (campo: CampoCronograma, quandoFalta = ''): string => {
      const d = lerDataCronograma(valor(celulas, campo));
      return d ? formatarDataCronograma(d) : quandoFalta;
    };

    resultado.push({
      id,
      tarefa,
      previsto: lerPercentual(valor(celulas, 'previsto')),
      trabalhoConcluido: lerPercentual(valor(celulas, 'trabalhoConcluido')),
      desvio: lerPercentual(valor(celulas, 'desvio')),
      inicio: dataOu('inicio'),
      termino: dataOu('termino'),
      // Linha de base sem data é "ND" — o relatório distingue não planejado de vazio.
      inicioBase: dataOu('inicioBase', 'ND'),
      terminoBase: dataOu('terminoBase', 'ND'),
      outlineLevel: nivel,
    });
  }

  const mapeamento = Object.values(mapa) as ColunaMapeada[];
  const faltando = (['tarefa', 'previsto', 'inicio', 'termino', 'inicioBase', 'terminoBase'] as CampoCronograma[])
    .filter((c) => !mapa[c]);

  return { linhas: resultado, mapeamento, faltando };
};
