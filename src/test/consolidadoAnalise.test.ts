import { describe, it, expect } from 'vitest';
import type { LinhaObra } from '@/lib/consolidado';
import {
  acoesAbertas, matrizDeVariacao, pesosDasObras, pontePorObra, prioridades,
  projecaoDeEntrega, riscoDasObras, tendenciaConsolidada, tendenciaDePrazo, entregaNoPrazo,
} from '@/lib/consolidadoAnalise';

const obra = (p: Partial<LinhaObra>): LinhaObra => ({
  id: 'x', nome: 'X', avancoPrev: 50, avancoReal: 50, desvio: 0, idp: 100,
  status: 'ok', terminoBase: '', terminoProjetado: null, desvioDias: null,
  valorContrato: 0, previstoMes: 0, realizadoMes: 0, acumulado: 0, atualizadoEm: '2026-08-28',
  ...p,
});

describe('pontePorObra', () => {
  it('as contribuições somam exatamente o desvio consolidado', () => {
    // É esta identidade que torna a ponte honesta: nenhuma barra sobra nem
    // falta para o total bater.
    const obras = [
      obra({ id: 'a', desvio: -10, valorContrato: 1_000_000 }),
      obra({ id: 'b', desvio: +5, valorContrato: 1_000_000 }),
    ];
    const soma = pontePorObra(obras, 'contrato').reduce((s, c) => s + c.contribuicao, 0);
    expect(soma).toBeCloseTo(-2.5, 5);
  });

  it('obra pequena não pesa como obra grande', () => {
    // 30 p.p. de atraso em 2% do contrato não pode aparecer como o problema.
    const obras = [
      obra({ id: 'pequena', nome: 'Pequena', desvio: -30, valorContrato: 100_000 }),
      obra({ id: 'grande', nome: 'Grande', desvio: -3, valorContrato: 4_900_000 }),
    ];
    const ponte = pontePorObra(obras, 'contrato');
    const pequena = ponte.find((c) => c.id === 'pequena')!;
    const grande = ponte.find((c) => c.id === 'grande')!;
    expect(Math.abs(grande.contribuicao)).toBeGreaterThan(Math.abs(pequena.contribuicao));
  });

  it('ordena da que mais puxa para baixo', () => {
    const obras = [obra({ id: 'a', desvio: 5 }), obra({ id: 'b', desvio: -8 })];
    expect(pontePorObra(obras, 'media')[0].id).toBe('b');
  });

  it('sem peso nenhum devolve vazio em vez de dividir por zero', () => {
    expect(pontePorObra([obra({ valorContrato: 0 })], 'contrato')).toEqual([]);
  });
});

describe('matrizDeVariacao', () => {
  it('marca cada dimensão pela sua própria régua', () => {
    const linha = matrizDeVariacao(
      [obra({ id: 'a', desvio: -9, desvioDias: 3, valorContrato: 1_000_000, realizadoMes: 50_000 })],
      { a: 6 },
    )[0];
    const [avanco, prazo, medicao, acoes] = linha.celulas;
    expect(avanco.severidade).toBe('ruim');      // -9 p.p.
    expect(prazo.severidade).toBe('atencao');    // +3 dias
    expect(medicao.severidade).toBe('ok');       // 5% do contrato no mês
    expect(acoes.severidade).toBe('ruim');       // 6 ações abertas
  });

  it('obra sem avanço lançado não vira obra ruim', () => {
    const linha = matrizDeVariacao([obra({ status: 'sem_dado', desvio: -50 })], {})[0];
    expect(linha.celulas[0].severidade).toBe('sem_dado');
  });

  it('sem contrato, a medição do mês fica sem régua', () => {
    const linha = matrizDeVariacao([obra({ valorContrato: 0, realizadoMes: 90_000 })], {})[0];
    expect(linha.celulas[2].severidade).toBe('sem_dado');
  });
});

describe('acoesAbertas', () => {
  const acao = (status: string, atividade = 'Cobrar material') => ({
    id: 1, problema: '', causa: '', impacto: '', atividade,
    responsavel: '', prazo: '', necessidade: '', status,
  });

  it('conta só o que ainda cobra alguém', () => {
    const projetos = [{
      id: 'a',
      actions: [acao('EM ANDAMENTO'), acao('ATRASADO'), acao('CONCLUÍDO'), acao('CANCELADO')],
    }] as never;
    expect(acoesAbertas(projetos).a).toBe(2);
  });

  it('linha em branco não conta como ação', () => {
    const projetos = [{ id: 'a', actions: [acao('EM ANDAMENTO', '   ')] }] as never;
    expect(acoesAbertas(projetos).a).toBe(0);
  });
});

describe('projecaoDeEntrega', () => {
  it('projeta pelo mesmo IDP do resto do relatório', () => {
    const obras = [obra({ id: 'a', avancoReal: 40, idp: 80 })];
    const p = projecaoDeEntrega(obras, { a: 1 })!;
    expect(p.hoje).toBe(40);
    expect(p.projetado).toBe(80);
    expect(p.lacuna).toBe(20);
    expect(p.obrasEmFalta).toBe(1);
  });

  it('obra adiantada não projeta acima de 100%', () => {
    const p = projecaoDeEntrega([obra({ id: 'a', idp: 130 })], { a: 1 })!;
    expect(p.projetado).toBe(100);
    expect(p.lacuna).toBe(0);
  });

  it('obra sem avanço lançado fica fora da conta', () => {
    expect(projecaoDeEntrega([obra({ status: 'sem_dado' })], { x: 1 })).toBeNull();
  });
});

describe('riscoDasObras', () => {
  it('obra grande e atrasada vai para o quadrante crítico', () => {
    const obras = [
      obra({ id: 'grande', idp: 60, valorContrato: 9_000_000 }),
      obra({ id: 'pequena', idp: 99, valorContrato: 1_000_000 }),
    ];
    const riscos = riscoDasObras(obras, 'contrato');
    expect(riscos[0].id).toBe('grande');
    expect(riscos[0].quadrante).toBe('critico');
    expect(riscos[0].probabilidade).toBe(40);
  });

  it('obra sem avanço lançado não entra na matriz', () => {
    expect(riscoDasObras([obra({ status: 'sem_dado' })], 'media')).toEqual([]);
  });

  it('IDP acima de 100 não vira probabilidade negativa', () => {
    expect(riscoDasObras([obra({ idp: 140 })], 'media')[0].probabilidade).toBe(0);
  });
});

describe('prioridades', () => {
  it('obra crítica sem ação lançada é marcada, não escondida', () => {
    const obras = [obra({ id: 'a', nome: 'FRIGO', desvio: -8, desvioDias: 40 })];
    const riscos = riscoDasObras(obras, 'media');
    const p = prioridades(riscos, [{ id: 'a', actions: [] }] as never, obras);
    expect(p[0].semAcao).toBe(true);
    expect(p[0].motivo).toContain('40 dias');
  });

  it('usa as ações já lançadas, sem inventar nenhuma', () => {
    const obras = [obra({ id: 'a', idp: 50 })];
    const projetos = [{
      id: 'a',
      actions: [{ id: 1, problema: '', causa: '', impacto: '', atividade: 'Liberar frente 3', responsavel: '', prazo: '', necessidade: '', status: 'EM ANDAMENTO' }],
    }] as never;
    const p = prioridades(riscoDasObras(obras, 'media'), projetos, obras);
    expect(p[0].acoes).toEqual(['Liberar frente 3']);
    expect(p[0].semAcao).toBe(false);
  });
});

describe('tendenciaConsolidada', () => {
  const projeto = (id: string, inicio: string, curva: { previsto: number; real: number }[]) => ({
    id,
    info: { curvaInicio: inicio, curvaPeriodicidade: 'semanal' },
    sCurveData: curva.map((c) => ({ date: '', ...c, tendencia: 0 })),
  });

  it('agrega por mês do calendário e pondera pelo peso', () => {
    const serie = tendenciaConsolidada(
      [
        projeto('a', '2026-01-05', [{ previsto: 10, real: 8 }, { previsto: 20, real: 16 }]),
        projeto('b', '2026-01-05', [{ previsto: 30, real: 30 }, { previsto: 40, real: 40 }]),
      ] as never,
      { a: 1, b: 1 },
      '2026-12-31',
    );
    expect(serie).toHaveLength(1);
    expect(serie[0].previsto).toBe(30);  // último ponto do mês: (20+40)/2
    expect(serie[0].real).toBe(28);      // (16+40)/2
  });

  it('o real para na data de status, o previsto segue', () => {
    const serie = tendenciaConsolidada(
      [projeto('a', '2026-01-05', [{ previsto: 10, real: 8 }])] as never,
      { a: 1 },
      '2026-01-01',
    );
    expect(serie[0].previsto).toBe(10);
    expect(serie[0].real).toBeNull();
  });

  it('sem data de início da curva não há série', () => {
    const serie = tendenciaConsolidada(
      [projeto('a', '', [{ previsto: 10, real: 8 }])] as never,
      { a: 1 },
      '2026-12-31',
    );
    expect(serie).toEqual([]);
  });
});

describe('pesosDasObras', () => {
  it('peso é o contrato quando se pondera por contrato', () => {
    expect(pesosDasObras([obra({ id: 'a', valorContrato: 500 })], 'contrato')).toEqual({ a: 500 });
  });

  it('peso é igual na média simples', () => {
    expect(pesosDasObras([obra({ id: 'a', valorContrato: 500 })], 'media')).toEqual({ a: 1 });
  });
});

describe('entregaNoPrazo', () => {
  it('o cliente fecha quando fecha a ULTIMA obra, nao na media das datas', () => {
    // Com marco e dezembro, a media daria agosto - e em agosto o cliente nao
    // recebeu nada.
    const obras = [
      obra({ id: 'a', nome: 'A', terminoBase: '2026-03-31', terminoProjetado: '2026-04-10', desvioDias: 10 }),
      obra({ id: 'b', nome: 'B', terminoBase: '2026-12-20', terminoProjetado: '2027-02-10', desvioDias: 52 }),
    ];
    const e = entregaNoPrazo(obras)!;
    expect(e.terminoBase).toBe('2026-12-20');
    expect(e.terminoProjetado).toBe('2027-02-10');
    expect(e.obraCritica).toBe('B');
    expect(e.desvioDias).toBe(52);
  });

  it('separa no prazo, atrasada e sem projecao', () => {
    const obras = [
      obra({ id: 'a', terminoBase: '2026-03-31', terminoProjetado: '2026-03-20', desvioDias: -11 }),
      obra({ id: 'b', terminoBase: '2026-04-30', terminoProjetado: '2026-05-30', desvioDias: 30 }),
      obra({ id: 'c', terminoBase: '2026-05-30', terminoProjetado: null, desvioDias: null }),
    ];
    const e = entregaNoPrazo(obras)!;
    expect(e.noPrazo).toBe(1);
    expect(e.atrasadas).toBe(1);
    expect(e.semProjecao).toBe(1);
    expect(e.porObra).toHaveLength(2);
  });

  it('sem termino de linha de base nao ha o que projetar', () => {
    expect(entregaNoPrazo([obra({ terminoBase: '' })])).toBeNull();
  });
});

describe('tendenciaDePrazo', () => {
  const projeto = (id: string, curva: { previsto: number; real: number }[]) => ({
    id,
    info: {
      inicio: '2026-01-05', terminoLB: '2026-04-05',
      curvaInicio: '2026-01-05', curvaPeriodicidade: 'semanal',
    },
    sCurveData: curva.map((c) => ({ date: '', ...c, tendencia: 0 })),
  });

  it('IDP de 50% dobra a duracao projetada', () => {
    // 90 dias de linha de base a metade do ritmo = 180 dias, ou seja +90.
    const serie = tendenciaDePrazo(
      [projeto('a', [{ previsto: 20, real: 10 }])] as never,
      { a: 1 },
      '2026-12-31',
    );
    expect(serie[0].desvioDias).toBe(90);
  });

  it('mes com pouco planejado fica de fora - ali um ponto vira meses', () => {
    const serie = tendenciaDePrazo(
      [projeto('a', [{ previsto: 2, real: 1 }])] as never,
      { a: 1 },
      '2026-12-31',
    );
    expect(serie).toEqual([]);
  });

  it('nao projeta depois da data de status', () => {
    const serie = tendenciaDePrazo(
      [projeto('a', [{ previsto: 20, real: 10 }])] as never,
      { a: 1 },
      '2026-01-01',
    );
    expect(serie).toEqual([]);
  });

  it('obra sem termino de linha de base nao entra', () => {
    const semTermino = {
      id: 'a',
      info: { inicio: '2026-01-05', terminoLB: '', curvaInicio: '2026-01-05', curvaPeriodicidade: 'semanal' },
      sCurveData: [{ date: '', previsto: 20, real: 10, tendencia: 0 }],
    };
    expect(tendenciaDePrazo([semTermino] as never, { a: 1 }, '2026-12-31')).toEqual([]);
  });
});
