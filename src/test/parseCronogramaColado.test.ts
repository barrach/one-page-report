import { describe, it, expect } from 'vitest';
import {
  lerCronogramaColado,
  lerDataCronograma,
  lerPercentual,
} from '@/lib/parseCronogramaColado';

describe('lerDataCronograma', () => {
  it('lê o formato que o Project cola, com dia da semana na frente', () => {
    const d = lerDataCronograma('Seg 01/06/26');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5);
    expect(d?.getDate()).toBe(1);
  });

  it('lê dd/mm/aaaa, dd/mmm/aa e ISO', () => {
    expect(lerDataCronograma('01/06/2026')?.getFullYear()).toBe(2026);
    expect(lerDataCronograma('01/jun/26')?.getMonth()).toBe(5);
    expect(lerDataCronograma('2026-06-01')?.getDate()).toBe(1);
  });

  it('"ND" e vazio não são data', () => {
    expect(lerDataCronograma('ND')).toBeNull();
    expect(lerDataCronograma('')).toBeNull();
  });
});

describe('lerPercentual', () => {
  it('lê com e sem o sinal', () => {
    expect(lerPercentual('45%')).toBe(45);
    expect(lerPercentual('45')).toBe(45);
  });

  it('fração vira percentual', () => {
    expect(lerPercentual('0,45')).toBe(45);
  });

  it('vazio é zero', () => {
    expect(lerPercentual('')).toBe(0);
  });
});

describe('lerCronogramaColado', () => {
  const COLAGEM = [
    'Nível\tEDT\tNome da tarefa\t% Concluída\tInício\tTérmino\tInício da linha de base\tTérmino da linha de base',
    '1\t1\tMONTAGEM ELETROMECÂNICA\t45%\tSeg 01/06/26\tSex 31/07/26\tSeg 01/06/26\tSex 24/07/26',
    '2\t1.1\tTubulação\t60%\tSeg 01/06/26\tSex 03/07/26\tSeg 01/06/26\tSex 26/06/26',
    '3\t1.1.1\tPré-fabricação\t80%\tSeg 01/06/26\tSex 19/06/26\tSeg 01/06/26\tSex 12/06/26',
  ].join('\n');

  it('reconhece as colunas pelo cabeçalho, em qualquer ordem', () => {
    const { linhas, mapeamento, faltando } = lerCronogramaColado(COLAGEM);
    expect(linhas).toHaveLength(3);
    expect(faltando).toEqual([]);
    expect(mapeamento.map((m) => m.campo).sort()).toContain('terminoBase');
  });

  it('traz nome, avanço e datas de cada tarefa', () => {
    const { linhas } = lerCronogramaColado(COLAGEM);
    expect(linhas[0].tarefa).toBe('MONTAGEM ELETROMECÂNICA');
    expect(linhas[0].previsto).toBe(45);
    expect(linhas[0].inicio).toBe('Seg 01/06/26');
    expect(linhas[0].terminoBase).toBe('Sex 24/07/26');
  });

  it('lê o nível da coluna de nível', () => {
    const { linhas } = lerCronogramaColado(COLAGEM);
    expect(linhas.map((l) => l.outlineLevel)).toEqual([1, 2, 3]);
  });

  it('sem coluna de nível, deduz pela EDT', () => {
    const semNivel = [
      'EDT\tNome da tarefa\t% Concluída\tInício\tTérmino',
      '1\tMontagem\t10%\t01/06/26\t31/07/26',
      '1.2\tTubulação\t20%\t01/06/26\t03/07/26',
      '1.2.3\tPré-fabricação\t30%\t01/06/26\t19/06/26',
    ].join('\n');
    expect(lerCronogramaColado(semNivel).linhas.map((l) => l.outlineLevel)).toEqual([1, 2, 3]);
  });

  it('pula o que vem antes do cabeçalho e as linhas sem tarefa', () => {
    const comLixo = ['Projeto GUAXE', '', COLAGEM, '\t\t\t\t\t\t\t'].join('\n');
    expect(lerCronogramaColado(comLixo).linhas).toHaveLength(3);
  });

  it('linha de base ausente vira ND, e não data vazia', () => {
    const semBase = [
      'Nome da tarefa\t% Concluída\tInício\tTérmino',
      'Montagem\t10%\t01/06/26\t31/07/26',
    ].join('\n');
    const { linhas, faltando } = lerCronogramaColado(semBase);
    expect(linhas[0].inicioBase).toBe('ND');
    expect(faltando).toContain('inicioBase');
  });

  it('colagem sem cabeçalho reconhecível não vira cronograma', () => {
    expect(lerCronogramaColado('a\tb\nc\td').linhas).toEqual([]);
  });
});

describe('colunas importadas', () => {
  const COLAGEM = [
    'Nível\tNome da tarefa\t% Concluída\tRecurso\tObservação da obra',
    '1\tMontagem\t45%\tCaldeireiro\tAguardando liberação',
    '2\tTubulação\t60%\tSoldador\t',
  ].join('\n');

  it('traz exatamente as colunas do arquivo, com os títulos originais', () => {
    const { colunas } = lerCronogramaColado(COLAGEM);
    expect(colunas.map((c) => c.titulo)).toEqual([
      'Nível', 'Nome da tarefa', '% Concluída', 'Recurso', 'Observação da obra',
    ]);
  });

  it('guarda o texto cru de cada coluna, inclusive as que não são campo conhecido', () => {
    const { linhas, colunas } = lerCronogramaColado(COLAGEM);
    const recurso = colunas.find((c) => c.titulo === 'Recurso')!;
    const obs = colunas.find((c) => c.titulo === 'Observação da obra')!;
    expect(linhas[0].celulas?.[recurso.chave]).toBe('Caldeireiro');
    expect(linhas[0].celulas?.[obs.chave]).toBe('Aguardando liberação');
    expect(linhas[1].celulas?.[obs.chave]).toBe('');
  });

  it('marca qual coluna é a da tarefa, para o relatório indentar por nível', () => {
    const { colunas } = lerCronogramaColado(COLAGEM);
    expect(colunas.find((c) => c.campo === 'tarefa')?.titulo).toBe('Nome da tarefa');
    expect(colunas.find((c) => c.campo === 'nivel')?.titulo).toBe('Nível');
    // Coluna que o app não conhece fica sem campo, mas continua sendo exibida.
    expect(colunas.find((c) => c.titulo === 'Recurso')?.campo).toBeUndefined();
  });

  it('coluna sem título não vira coluna', () => {
    const comVazia = ['Nome da tarefa\t\t% Concluída', 'Montagem\tx\t10%'].join('\n');
    expect(lerCronogramaColado(comVazia).colunas.map((c) => c.titulo))
      .toEqual(['Nome da tarefa', '% Concluída']);
  });
});

describe('nivel da estrutura de topicos', () => {
  it('reconhece o nome real da coluna no MS Project pt-BR', () => {
    const colagem = [
      'Nível da estrutura de tópicos\tNome da tarefa\t% Concluída',
      '0\tUNIPAR_PROJETO_SPCI\t53%',
      '1\tMARCOS CONTRATUAIS\t0%',
      '2\tCWA (ÁREA 2)\t93%',
    ].join('\n');
    const { linhas, colunas } = lerCronogramaColado(colagem);
    expect(colunas.find((c) => c.campo === 'nivel')?.titulo).toBe('Nível da estrutura de tópicos');
    expect(linhas.map((l) => l.outlineLevel)).toEqual([0, 1, 2]);
  });

  it('nivel zero e a tarefa-resumo do projeto, nao vira nivel 1', () => {
    const colagem = ['Nível\tNome da tarefa', '0\tProjeto', '1\tFase'].join('\n');
    expect(lerCronogramaColado(colagem).linhas[0].outlineLevel).toBe(0);
  });

  it('ainda aceita a coluna chamada so "Nível"', () => {
    const colagem = ['Nível\tNome da tarefa', '2\tTubulação'].join('\n');
    expect(lerCronogramaColado(colagem).linhas[0].outlineLevel).toBe(2);
  });
});
