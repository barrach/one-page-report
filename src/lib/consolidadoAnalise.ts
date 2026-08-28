import type { Project } from '@/store/projectStore';
import type { Consolidado, LinhaObra } from '@/lib/consolidado';
import { datasDaCurva, parseISOLocal, semanaDaAnalise } from '@/lib/dateUtils';

/**
 * As sete perguntas do consolidado.
 *
 * RESULTADO → DRIVER → RISCO → AÇÃO. A ordem não é estética: o consolidado
 * antigo parava no primeiro passo — dizia QUANTO o cliente está atrasado e
 * deixava a reunião descobrir sozinha por quê, onde e o que fazer.
 *
 * Cada função aqui responde uma pergunta e nada mais. Nenhuma inventa dado:
 * quando falta lançamento, elas devolvem vazio para a tela poder dizer o que
 * falta em vez de desenhar um gráfico bonito e falso.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── 2. POR QUÊ — a ponte do desvio ─────────────────────────────────────

export interface ContribuicaoObra {
  id: string;
  nome: string;
  /** Pontos percentuais que esta obra tira (ou põe) no desvio do cliente. */
  contribuicao: number;
  /** Fatia do peso total — o quanto ela manda no número consolidado. */
  peso: number;
}

/**
 * Quanto cada obra explica do desvio consolidado.
 *
 * A conta fecha por construção: o desvio consolidado é a média ponderada dos
 * desvios, então a soma das contribuições É o desvio. É isso que torna a ponte
 * honesta — nenhuma barra sobra nem falta para o total bater.
 *
 * Sem isso a leitura vira injusta com obra pequena: uma obra 30 p.p. atrasada
 * que vale 2% do contrato aparece igual a uma 3 p.p. atrasada que vale 60%, e
 * a reunião vai atrás da errada.
 */
export const pontePorObra = (
  obras: LinhaObra[],
  ponderacao: Consolidado['ponderacao'],
): ContribuicaoObra[] => {
  const pesoDe = (o: LinhaObra) => (ponderacao === 'contrato' ? o.valorContrato : 1);
  const total = obras.reduce((s, o) => s + pesoDe(o), 0);
  if (total <= 0) return [];

  return obras
    .map((o) => ({
      id: o.id,
      nome: o.nome,
      contribuicao: r2((o.desvio * pesoDe(o)) / total),
      peso: r2((pesoDe(o) / total) * 100),
    }))
    // Da que mais puxa para baixo à que mais puxa para cima: a ponte se lê da
    // esquerda para a direita e o problema tem que aparecer primeiro.
    .sort((a, b) => a.contribuicao - b.contribuicao);
};

// ─── 2b. CASCATA DA MEDIÇÃO DO MÊS ──────────────────────────────────────

export interface PassoMedicao {
  id: string;
  nome: string;
  previsto: number;
  realizado: number;
  /** Realizado menos previsto: negativo é medição que não saiu. */
  delta: number;
}

export interface CascataMedicao {
  previstoTotal: number;
  realizadoTotal: number;
  /** Uma parcela por obra, da que mais tira à que mais devolve. */
  passos: PassoMedicao[];
}

/**
 * Do previsto do mês ao realizado, obra a obra.
 *
 * Aqui a cascata funciona e na do avanço não funcionava: lá o total era um
 * NÍVEL (78%) e os degraus eram diferenças de dois pontos — grandezas
 * incomparáveis, e o degrau virava um risco invisível. Em dinheiro os dois são
 * a mesma grandeza, então a barra do degrau tem tamanho comparável à do total
 * e a cascata diz o que promete.
 *
 * A conta fecha por construção: previsto + Σ(realizado − previsto) = realizado.
 */
export const cascataDaMedicao = (obras: LinhaObra[]): CascataMedicao | null => {
  const comMedicao = obras.filter((o) => o.previstoMes > 0 || o.realizadoMes > 0);
  if (comMedicao.length === 0) return null;

  return {
    previstoTotal: comMedicao.reduce((s, o) => s + o.previstoMes, 0),
    realizadoTotal: comMedicao.reduce((s, o) => s + o.realizadoMes, 0),
    passos: comMedicao
      .map((o) => ({
        id: o.id,
        nome: o.nome,
        previsto: o.previstoMes,
        realizado: o.realizadoMes,
        delta: o.realizadoMes - o.previstoMes,
      }))
      .sort((a, b) => a.delta - b.delta),
  };
};

/**
 * A semana de análise do cliente.
 *
 * Sai do campo "Semana de análise" de cada obra, na aba Dados. Obras em semanas
 * DIFERENTES é problema de verdade e a tela precisa dizer: a reunião estaria
 * comparando obras medidas em momentos distintos como se fossem o mesmo
 * instante, e o consolidado inteiro passa a somar coisas que não se somam.
 */
export const semanaDeAnalise = (projetos: Project[]): { texto: string; divergente: boolean } => {
  const semanas = [...new Set(projetos.map((p) => semanaDaAnalise(p.info)).filter(Boolean))];
  return {
    texto: semanas.join(' · '),
    divergente: semanas.length > 1,
  };
};

// ─── 3. ONDE ESTÁ O PROBLEMA — matriz de variação ───────────────────────

export type Severidade = 'ok' | 'atencao' | 'ruim' | 'sem_dado';

export interface CelulaMatriz {
  texto: string;
  severidade: Severidade;
}

export interface LinhaMatriz {
  id: string;
  nome: string;
  celulas: CelulaMatriz[];
}

export const COLUNAS_MATRIZ = ['Avanço', 'Prazo', 'Medição do mês', 'Ações abertas'] as const;

const semDado: CelulaMatriz = { texto: '—', severidade: 'sem_dado' };

const pp = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} p.p.`;

/**
 * Uma linha por obra, uma coluna por dimensão que pode dar errado.
 *
 * Quatro dimensões porque são quatro problemas diferentes: avançar devagar,
 * estourar a data, não medir o que executou e deixar ação parada. Uma obra
 * pode estar bem em três e mal na quarta, e é exatamente essa a informação que
 * a tabela de avanço sozinha escondia.
 */
export const matrizDeVariacao = (
  obras: LinhaObra[],
  acoesAbertasPorObra: Record<string, number>,
): LinhaMatriz[] =>
  obras.map((o) => {
    const avanco: CelulaMatriz = o.status === 'sem_dado'
      ? semDado
      : {
        texto: pp(o.desvio),
        severidade: o.desvio >= -1 ? 'ok' : o.desvio >= -5 ? 'atencao' : 'ruim',
      };

    const prazo: CelulaMatriz = o.desvioDias == null
      ? semDado
      : {
        texto: o.desvioDias === 0 ? 'no prazo' : `${o.desvioDias > 0 ? '+' : ''}${o.desvioDias} d`,
        severidade: o.desvioDias <= 0 ? 'ok' : o.desvioDias <= 15 ? 'atencao' : 'ruim',
      };

    // Medição do mês só faz sentido contra o tamanho do contrato: R$ 200 mil é
    // muito numa obra de 2 milhões e quase nada numa de 80.
    const percentualMes = o.valorContrato > 0 ? (o.realizadoMes / o.valorContrato) * 100 : null;
    const medicao: CelulaMatriz = percentualMes == null
      ? semDado
      : {
        texto: `${percentualMes.toFixed(1).replace('.', ',')}%`,
        severidade: percentualMes >= 4 ? 'ok' : percentualMes >= 1 ? 'atencao' : 'ruim',
      };

    const abertas = acoesAbertasPorObra[o.id] ?? 0;
    const acoes: CelulaMatriz = {
      texto: String(abertas),
      severidade: abertas === 0 ? 'ok' : abertas <= 3 ? 'atencao' : 'ruim',
    };

    return { id: o.id, nome: o.nome, celulas: [avanco, prazo, medicao, acoes] };
  });

/** Ações que ainda cobram alguém: nem concluídas, nem canceladas. */
export const acoesAbertas = (projetos: Project[]): Record<string, number> => {
  const mapa: Record<string, number> = {};
  projetos.forEach((p) => {
    mapa[p.id] = (p.actions ?? []).filter((a) => {
      const s = String(a.status ?? '').toUpperCase();
      return a.atividade?.trim() && s !== 'CONCLUÍDO' && s !== 'CANCELADO';
    }).length;
  });
  return mapa;
};

// ─── 4. QUAL A TENDÊNCIA — curva consolidada ────────────────────────────

export interface PontoTendencia {
  /** ISO do primeiro dia do mês. */
  mes: string;
  rotulo: string;
  previsto: number;
  real: number | null;
}

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Avanço consolidado mês a mês, no calendário.
 *
 * Por mês e não por semana porque as obras do cliente começam em datas
 * diferentes: a "semana 12" de uma não é a da outra, e sobrepor por semana da
 * obra produziria uma curva que não corresponde a mês nenhum do calendário —
 * justamente o eixo em que o cliente pensa.
 *
 * Obra que ainda não começou entra como 0% (é o avanço dela mesmo); obra
 * terminada entra com o último valor. Excluir qualquer uma faria o consolidado
 * saltar quando ela entra ou sai.
 *
 * O real para depois da data de status: projetar realizado é inventar.
 */
export const tendenciaConsolidada = (
  projetos: Project[],
  pesos: Record<string, number>,
  atualizadoEm: string,
): PontoTendencia[] => {
  const corte = parseISOLocal(atualizadoEm);

  // Cada obra vira um mapa mês → { previsto, real } com o último ponto do mês.
  const porObra = projetos.map((p) => {
    const curva = p.sCurveData ?? [];
    const inicio = p.info?.curvaInicio || p.info?.inicio || '';
    const datas = datasDaCurva(curva.length, inicio, p.info?.curvaPeriodicidade ?? 'semanal');

    const meses = new Map<string, { previsto: number; real: number | null }>();
    curva.forEach((ponto, i) => {
      const d = datas[i];
      if (!d) return;
      const passouDoStatus = corte != null && d.getTime() > corte.getTime();
      meses.set(chaveMes(d), {
        previsto: Number(ponto.previsto) || 0,
        real: passouDoStatus ? null : (Number(ponto.real) || 0),
      });
    });

    return { id: p.id, meses, primeiro: datas.find((d) => d) ?? null };
  });

  const todosOsMeses = [...new Set(porObra.flatMap((o) => [...o.meses.keys()]))].sort();
  if (todosOsMeses.length === 0) return [];

  const pesoTotal = porObra.reduce((s, o) => s + (pesos[o.id] ?? 0), 0);
  if (pesoTotal <= 0) return [];

  // Último valor conhecido de cada obra: entre um mês e outro a curva pode não
  // ter ponto, e cair para zero ali daria um dente de serra que não existe.
  const ultimo: Record<string, { previsto: number; real: number | null }> = {};

  return todosOsMeses.map((mes) => {
    let previsto = 0;
    let real = 0;
    let pesoComReal = 0;

    porObra.forEach((o) => {
      const peso = pesos[o.id] ?? 0;
      const ponto = o.meses.get(mes) ?? ultimo[o.id];
      if (ponto) ultimo[o.id] = ponto;

      previsto += (ponto?.previsto ?? 0) * peso;
      if (ponto?.real != null) { real += ponto.real * peso; pesoComReal += peso; }
    });

    const [ano, m] = mes.split('-');
    return {
      mes: `${mes}-01`,
      rotulo: `${MESES[Number(m) - 1]}/${ano.slice(2)}`,
      previsto: r2(previsto / pesoTotal),
      // Mês inteiramente no futuro não tem real — e uma linha caindo a zero
      // ali seria lida como obra que parou.
      real: pesoComReal > 0 ? r2(real / pesoTotal) : null,
    };
  });
};

// ─── 4b. TENDÊNCIA DE PRAZO ─────────────────────────────────────────────

export interface PontoPrazo {
  mes: string;
  rotulo: string;
  /** Dias além (+) ou aquém (−) da linha de base, no ritmo daquele mês. */
  desvioDias: number;
}

/**
 * IDP mínimo para a projeção de prazo valer alguma coisa.
 *
 * Nos primeiros meses o previsto acumulado é de 2 ou 3 por cento; um ponto de
 * diferença ali vira meses de projeção e a linha começa com um pico que não
 * significa nada. Abaixo deste avanço planejado o mês simplesmente não entra.
 */
const AVANCO_MINIMO_PARA_PROJETAR = 5;

const diasEntre = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));

/**
 * Quantos dias o cliente está ganhando ou perdendo, mês a mês.
 *
 * Cada mês responde: com o ritmo ATÉ ALI, a obra terminaria quantos dias além
 * da linha de base? A inclinação da linha é o que interessa — subindo, a obra
 * está perdendo prazo mesmo que o avanço continue crescendo; descendo, está
 * recuperando. É o que a curva de avanço não conta.
 */
export const tendenciaDePrazo = (
  projetos: Project[],
  pesos: Record<string, number>,
  atualizadoEm: string,
): PontoPrazo[] => {
  const corte = parseISOLocal(atualizadoEm);

  const porObra = projetos.map((p) => {
    const inicio = parseISOLocal(p.info?.inicio ?? '');
    const termino = parseISOLocal(p.info?.terminoLB ?? '');
    const duracaoLB = inicio && termino ? diasEntre(inicio, termino) : 0;

    const curva = p.sCurveData ?? [];
    const datas = datasDaCurva(
      curva.length,
      p.info?.curvaInicio || p.info?.inicio || '',
      p.info?.curvaPeriodicidade ?? 'semanal',
    );

    const meses = new Map<string, number>();
    if (duracaoLB > 0) {
      curva.forEach((ponto, i) => {
        const d = datas[i];
        if (!d) return;
        if (corte && d.getTime() > corte.getTime()) return;

        const previsto = Number(ponto.previsto) || 0;
        const real = Number(ponto.real) || 0;
        if (previsto < AVANCO_MINIMO_PARA_PROJETAR || real <= 0) return;

        const idp = real / previsto;
        meses.set(chaveMes(d), Math.round(duracaoLB / idp) - duracaoLB);
      });
    }
    return { id: p.id, meses };
  });

  const todos = [...new Set(porObra.flatMap((o) => [...o.meses.keys()]))].sort();

  return todos.map((mes) => {
    let soma = 0;
    let peso = 0;
    porObra.forEach((o) => {
      const dias = o.meses.get(mes);
      if (dias == null) return;
      const w = pesos[o.id] ?? 0;
      soma += dias * w;
      peso += w;
    });

    const [ano, m] = mes.split('-');
    return {
      mes: `${mes}-01`,
      rotulo: `${MESES[Number(m) - 1]}/${ano.slice(2)}`,
      desvioDias: peso > 0 ? Math.round(soma / peso) : 0,
    };
  });
};

// ─── 5. VAMOS ENTREGAR NO PRAZO? ────────────────────────────────────────

export interface EntregaNoPrazo {
  /** Última data de término da linha de base entre as obras do cliente. */
  terminoBase: string;
  /** Última data projetada — quando o cliente realmente fecha. */
  terminoProjetado: string;
  /** Dias entre as duas. */
  desvioDias: number;
  /** A obra que define a data final projetada. */
  obraCritica: string;
  noPrazo: number;
  atrasadas: number;
  semProjecao: number;
  /** Desvio de cada obra, da pior para a melhor. */
  porObra: Array<{ id: string; nome: string; dias: number }>;
}

/**
 * Quando o cliente realmente fecha.
 *
 * O contrato do cliente termina quando termina a ÚLTIMA obra — não na média
 * das datas. Média de datas de término é um número que não corresponde a
 * entrega nenhuma: com uma obra fechando em março e outra em dezembro, a média
 * daria agosto, e em agosto o cliente não recebeu nada.
 */
export const entregaNoPrazo = (obras: LinhaObra[]): EntregaNoPrazo | null => {
  const comData = obras.filter((o) => o.terminoBase);
  if (comData.length === 0) return null;

  const terminoBase = comData.map((o) => o.terminoBase).sort().pop() ?? '';

  const comProjecao = comData.filter((o) => o.terminoProjetado);
  const critica = comProjecao.length > 0
    ? comProjecao.reduce((pior, o) => (o.terminoProjetado! > pior.terminoProjetado! ? o : pior))
    : null;

  const base = parseISOLocal(terminoBase);
  const proj = parseISOLocal(critica?.terminoProjetado ?? '');

  return {
    terminoBase,
    terminoProjetado: critica?.terminoProjetado ?? '',
    desvioDias: base && proj ? diasEntre(base, proj) : 0,
    obraCritica: critica?.nome ?? '',
    noPrazo: comData.filter((o) => (o.desvioDias ?? 0) <= 0 && o.desvioDias != null).length,
    atrasadas: comData.filter((o) => (o.desvioDias ?? 0) > 0).length,
    semProjecao: comData.filter((o) => o.desvioDias == null).length,
    porObra: comData
      .filter((o) => o.desvioDias != null)
      .map((o) => ({ id: o.id, nome: o.nome, dias: o.desvioDias as number }))
      .sort((a, b) => b.dias - a.dias),
  };
};

// ─── 5b. (mantido) projeção de avanço ───────────────────────────────────

export interface ProjecaoEntrega {
  /** Avanço real consolidado hoje. */
  hoje: number;
  /** Onde o ritmo atual leva o cliente na data de término da linha de base. */
  projetado: number;
  /** O que falta para 100% se o ritmo não mudar. */
  lacuna: number;
  /** Obras que o ritmo atual não entrega no prazo. */
  obrasEmFalta: number;
}

/**
 * Onde o ritmo atual leva o contrato.
 *
 * A projeção usa o mesmo IDP do resto do relatório: mantido o desempenho até
 * aqui, no término da linha de base a obra chega a 100% × IDP. É uma conta
 * simples e é a mesma que já produz o "término projetado" de cada obra — duas
 * projeções diferentes no mesmo painel seria pior que uma imperfeita.
 */
export const projecaoDeEntrega = (
  obras: LinhaObra[],
  pesos: Record<string, number>,
): ProjecaoEntrega | null => {
  const comIdp = obras.filter((o) => o.status !== 'sem_dado');
  const pesoTotal = comIdp.reduce((s, o) => s + (pesos[o.id] ?? 0), 0);
  if (comIdp.length === 0 || pesoTotal <= 0) return null;

  const media = (pegar: (o: LinhaObra) => number) =>
    comIdp.reduce((s, o) => s + pegar(o) * (pesos[o.id] ?? 0), 0) / pesoTotal;

  const hoje = r2(media((o) => o.avancoReal));
  const projetado = r2(media((o) => Math.min(100, o.idp)));

  return {
    hoje,
    projetado,
    lacuna: r2(Math.max(0, 100 - projetado)),
    obrasEmFalta: comIdp.filter((o) => o.idp < 100).length,
  };
};

// ─── 6. QUAL O RISCO — impacto × probabilidade ──────────────────────────

export interface PontoRisco {
  id: string;
  nome: string;
  /** 0–100: quanto do contrato do cliente está nesta obra. */
  impacto: number;
  /** 0–100: quanto o desempenho até aqui sugere que ela não entrega. */
  probabilidade: number;
  quadrante: 'critico' | 'monitorar' | 'conviver' | 'tranquilo';
}

/**
 * Risco de cada obra, montado do que já está lançado.
 *
 * Impacto é a fatia do contrato — é o que o cliente perde se a obra falhar.
 * Probabilidade sai do IDP: 100% de aderência é risco baixo, e cada ponto
 * abaixo disso é evidência de que o prazo não se cumpre sozinho.
 *
 * Não é uma matriz de riscos clássica, com evento nomeado e probabilidade
 * estimada por alguém — para isso o app precisaria de um cadastro de riscos
 * que ninguém lançou ainda. É o risco que os NÚMEROS já demonstram, e por isso
 * não depende de mais digitação para existir.
 */
export const riscoDasObras = (
  obras: LinhaObra[],
  ponderacao: Consolidado['ponderacao'],
): PontoRisco[] => {
  const pesoDe = (o: LinhaObra) => (ponderacao === 'contrato' ? o.valorContrato : 1);
  const total = obras.reduce((s, o) => s + pesoDe(o), 0);
  if (total <= 0) return [];

  return obras
    .filter((o) => o.status !== 'sem_dado')
    .map((o) => {
      const impacto = r2((pesoDe(o) / total) * 100);
      const probabilidade = r2(Math.max(0, Math.min(100, 100 - o.idp)));
      const alto = impacto >= 100 / Math.max(1, obras.length);
      const provavel = probabilidade >= 10;

      return {
        id: o.id,
        nome: o.nome,
        impacto,
        probabilidade,
        quadrante: alto && provavel ? 'critico'
          : alto ? 'monitorar'
            : provavel ? 'conviver' : 'tranquilo',
      } as PontoRisco;
    })
    .sort((a, b) => (b.impacto * b.probabilidade) - (a.impacto * a.probabilidade));
};

// ─── 7. O QUE DEVEMOS FAZER — prioridades ───────────────────────────────

export interface Prioridade {
  id: string;
  nome: string;
  /** Por que esta obra está no topo. */
  motivo: string;
  /** Ações já lançadas na obra que ainda cobram alguém. */
  acoes: string[];
  /** Não há ação lançada — a própria falta é o que precisa ser resolvido. */
  semAcao: boolean;
}

const MAX_ACOES = 3;

/**
 * Para onde a equipe vai primeiro.
 *
 * A ordem sai do risco (impacto × probabilidade), e o texto sai do que a obra
 * já tem lançado — nenhuma ação é inventada aqui. Obra crítica SEM ação
 * cadastrada aparece assim mesmo, marcada: uma obra que puxa o cliente para
 * baixo e não tem nenhuma ação aberta não é uma obra tranquila, é uma obra
 * sem plano, e essa é a informação mais acionável do painel.
 */
export const prioridades = (
  riscos: PontoRisco[],
  projetos: Project[],
  obras: LinhaObra[],
  limite = 3,
): Prioridade[] => {
  const porId = new Map(projetos.map((p) => [p.id, p]));
  const linhaPorId = new Map(obras.map((o) => [o.id, o]));

  return riscos.slice(0, limite).map((r) => {
    const linha = linhaPorId.get(r.id);
    const abertas = (porId.get(r.id)?.actions ?? [])
      .filter((a) => {
        const s = String(a.status ?? '').toUpperCase();
        return a.atividade?.trim() && s !== 'CONCLUÍDO' && s !== 'CANCELADO';
      })
      .map((a) => a.atividade.trim());

    const partes: string[] = [];
    if (linha && linha.desvio < 0) partes.push(`${pp(linha.desvio)} de desvio`);
    if (linha?.desvioDias != null && linha.desvioDias > 0) partes.push(`${linha.desvioDias} dias além da linha de base`);
    partes.push(`${r.impacto.toFixed(0)}% do contrato do cliente`);

    return {
      id: r.id,
      nome: r.nome,
      motivo: partes.join(' · '),
      acoes: abertas.slice(0, MAX_ACOES),
      semAcao: abertas.length === 0,
    };
  });
};

/** Pesos por obra, na mesma regra do consolidado — para reuso nas 7 perguntas. */
export const pesosDasObras = (
  obras: LinhaObra[],
  ponderacao: Consolidado['ponderacao'],
): Record<string, number> => {
  const mapa: Record<string, number> = {};
  obras.forEach((o) => { mapa[o.id] = ponderacao === 'contrato' ? o.valorContrato : 1; });
  return mapa;
};
