import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useProjectStore, type Project } from '@/store/projectStore';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';
import { fmtDinheiro, lerValor } from '@/lib/eapFinanceira';
import { projetarTermino } from '@/lib/previsaoTermino';
import { clienteDaObra } from '@/lib/acesso';
import {
  CONTRATO_VAZIO, aditivoVazio, diaDoFaturamento, exposicaoDeMulta,
  janelaDeMedicao, medicaoVazia, pleitoVazio, resumoDoContrato, STATUS_PLEITO,
  vigenciaDoContrato,
  type Aditivo, type CompetenciaMedicao, type DadosContrato,
  type Pleito, type StatusPleito,
} from '@/lib/contrato';

/**
 * Dados do contrato, no consolidado.
 *
 * As outras perguntas respondem "a obra anda?". Esta responde "a obra paga?",
 * e numa obra industrial as duas respostas divergem com frequência — é a
 * segunda que decide se o contrato foi bom.
 *
 * Ela mora aqui, e não na aba de dados, porque a leitura que importa é a da
 * carteira: uma obra com R$ 400 mil travados na aprovação do cliente não é um
 * problema daquela obra, é o caixa da empresa. Na visão de todos aparece o
 * quadro somado; clicando numa obra, ela abre para lançamento.
 */

const celula = 'border border-border px-1 py-1 align-middle';
const campo = 'w-full bg-transparent outline-none text-xs rounded px-1 py-0.5 hover:bg-muted/40 focus:bg-muted/60 focus:ring-1 focus:ring-primary/40 disabled:hover:bg-transparent disabled:cursor-default';
const cabecalho = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left whitespace-nowrap';

const num = (v: string) => lerValor(v);

/** O IDP da obra — o mesmo do cabeçalho do relatório, para não haver dois. */
const idpDaObra = (p: Project) => {
  const prev = Number(p.info?.avancoPrev) || 0;
  const real = Number(p.info?.avancoReal) || 0;
  return prev > 0 ? (real / prev) * 100 : 0;
};

/**
 * Posição de contrato de uma obra: o que ela vale hoje e o que está preso.
 *
 * A exposição a multa sai do MESMO IDP que projeta o término no relatório.
 * Uma segunda projeção só para a multa daria dois atrasos diferentes para a
 * mesma obra na mesma tela.
 */
const posicaoDaObra = (p: Project) => {
  const resumo = resumoDoContrato(Number(p.info?.valorContrato) || 0, p.contratoDados);
  const previsao = projetarTermino(
    p.info?.inicio ?? '',
    resumo.terminoVigente || p.info?.terminoLB || '',
    idpDaObra(p),
  );
  const multa = exposicaoDeMulta(
    previsao?.desvioDias ?? 0,
    p.contratoDados?.multaDiaria,
    resumo.valorVigente,
    p.contratoDados?.tetoMultaPercentual,
  );
  const vigencia = vigenciaDoContrato(p.info?.inicio ?? '', resumo.terminoVigente);
  return { id: p.id, nome: p.name, cliente: clienteDaObra(p), info: p.info, dados: p.contratoDados, resumo, multa, vigencia };
};

type Posicao = ReturnType<typeof posicaoDaObra>;

const somarPosicoes = (posicoes: Posicao[]) => posicoes.reduce((t, p) => ({
  original: t.original + p.resumo.valorOriginal,
  aditivos: t.aditivos + p.resumo.valorAditivos,
  vigente: t.vigente + p.resumo.valorVigente,
  pleitos: t.pleitos + p.resumo.pleitosAbertos.valor,
  travado: t.travado + p.resumo.medicao.travadoNaAprovacao,
  aReceber: t.aReceber + p.resumo.medicao.aReceber,
  desvioCusto: t.desvioCusto + p.resumo.custo.desvio,
  multa: t.multa + (p.multa?.exposicao ?? 0),
}), {
  original: 0, aditivos: 0, vigente: 0, pleitos: 0,
  travado: 0, aReceber: 0, desvioCusto: 0, multa: 0,
});

const Numero = ({ rotulo, valor, detalhe, cor }: {
  rotulo: string; valor: string; detalhe?: string; cor?: string;
}) => (
  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</div>
    <div className={cn('text-base font-bold tabular-nums truncate', cor ?? 'text-foreground')}>{valor}</div>
    {detalhe && <div className="text-[10px] text-muted-foreground truncate">{detalhe}</div>}
  </div>
);

const Grupo = ({ titulo, explicacao, indicadores, children, aoAdicionar, rotuloAdicionar, podeEditar }: {
  titulo: string;
  explicacao: string;
  indicadores?: ReactNode;
  children: ReactNode;
  aoAdicionar: () => void;
  rotuloAdicionar: string;
  podeEditar: boolean;
}) => (
  <div className="rounded-lg border border-border p-3 space-y-3">
    <div>
      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">{titulo}</h4>
      <p className="text-xs text-muted-foreground max-w-[80ch]">{explicacao}</p>
    </div>
    {indicadores}
    <div className="overflow-x-auto">{children}</div>
    {podeEditar && (
      <button
        onClick={aoAdicionar}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> {rotuloAdicionar}
      </button>
    )}
  </div>
);

const BotaoRemover = ({ onClick, podeEditar }: { onClick: () => void; podeEditar: boolean }) => (
  <td className={cn(celula, 'text-center w-8')}>
    {podeEditar && (
      <button
        onClick={onClick}
        className="p-1 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Remover linha"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )}
  </td>
);

// ─── Detalhe de UMA obra ──────────────────────────────────────────────────

export const DetalheDoContrato = ({ projeto, podeEditar, aoConcluir }: {
  projeto: Project;
  podeEditar: boolean;
  /**
   * Fecha o detalhe e devolve a carteira. Opcional porque com uma obra só na
   * visão o detalhe é a única tela possível — não há para onde voltar.
   */
  aoConcluir?: () => void;
}) => {
  const setContratoDados = useProjectStore((s) => s.setContratoDados);
  const dados: DadosContrato = projeto.contratoDados ?? CONTRATO_VAZIO;
  const info = projeto.info;

  const { resumo, multa, vigencia } = useMemo(() => posicaoDaObra(projeto), [projeto]);

  const gravar = (patch: Partial<DadosContrato>) =>
    setContratoDados(projeto.id, { ...dados, ...patch });

  const editarLista = <T extends { id: string }>(
    chave: 'aditivos' | 'pleitos' | 'medicoes',
    lista: T[],
    i: number,
    patch: Partial<T>,
  ) => gravar({ [chave]: lista.map((x, k) => (k === i ? { ...x, ...patch } : x)) } as Partial<DadosContrato>);

  return (
    <div className="space-y-4">

      {/* Quem chega aqui chegou clicando numa obra da carteira, e o detalhe
          ocupa o bloco inteiro no lugar dela: sem esta faixa não sobra nada
          dizendo qual obra está aberta, nem por onde se sai. */}
      {aoConcluir && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground truncate">{projeto.name}</span>
          <button
            type="button"
            onClick={aoConcluir}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Voltar à carteira de contratos"
          >
            <Check className="h-3.5 w-3.5" />
            Concluir
          </button>
        </div>
      )}

      {/* ── O contrato em si ────────────────────────────────────────── */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">O contrato</h4>
          <p className="text-xs text-muted-foreground max-w-[80ch]">
            Início e término previsto vêm das Informações do Projeto. O{' '}
            <strong>término contratual</strong> é outra data: é a que tem multa, e ela pode
            não coincidir com a linha de base do cronograma.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Início da obra</label>
            <div className="text-sm font-semibold text-foreground px-1 py-1.5">
              {formatDateBR(info?.inicio ?? '') || '—'}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Término previsto</label>
            <div className="text-sm font-semibold text-foreground px-1 py-1.5">
              {formatDateBR(info?.terminoPrev ?? '') || '—'}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Término contratual</label>
            <input
              type="date" disabled={!podeEditar}
              value={dados.terminoContratual ?? ''}
              onChange={(e) => gravar({ terminoContratual: e.target.value })}
              className={cn(campo, 'text-sm border border-border py-1.5')}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Multa por dia de atraso (R$)</label>
            <input
              inputMode="decimal" disabled={!podeEditar}
              value={dados.multaDiaria || ''}
              onChange={(e) => gravar({ multaDiaria: num(e.target.value) })}
              placeholder="0,00"
              className={cn(campo, 'text-sm border border-border py-1.5')}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Teto da multa (% do contrato)</label>
            <input
              inputMode="decimal" disabled={!podeEditar}
              value={dados.tetoMultaPercentual || ''}
              onChange={(e) => gravar({ tetoMultaPercentual: num(e.target.value) })}
              placeholder="10"
              className={cn(campo, 'text-sm border border-border py-1.5')}
            />
          </div>
          {/* A cadência: dias do mês, não datas. Ela se repete todo mês —
              lançá-la como data obrigaria a reescrever a mesma coisa doze
              vezes por ano. */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Medição abre (dia)</label>
            <input
              inputMode="numeric" disabled={!podeEditar}
              value={dados.medicaoDiaInicio || ''}
              onChange={(e) => gravar({ medicaoDiaInicio: num(e.target.value) })}
              placeholder="21"
              className={cn(campo, 'text-sm border border-border py-1.5')}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Corte da medição (dia)</label>
            <input
              inputMode="numeric" disabled={!podeEditar}
              value={dados.medicaoDiaFim || ''}
              onChange={(e) => gravar({ medicaoDiaFim: num(e.target.value) })}
              placeholder="20"
              className={cn(campo, 'text-sm border border-border py-1.5')}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Faturamento (dia)</label>
            <input
              inputMode="numeric" disabled={!podeEditar}
              value={dados.diaFaturamento || ''}
              onChange={(e) => gravar({ diaFaturamento: num(e.target.value) })}
              placeholder="30"
              className={cn(campo, 'text-sm border border-border py-1.5')}
            />
          </div>
        </div>

        {/* A ficha do contrato em uma linha: é o que se pergunta primeiro na
            reunião, antes de qualquer valor. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>
            Vigência:{' '}
            {vigencia ? (
              <strong className={cn(
                vigencia.vencida ? 'text-destructive'
                  : vigencia.restantes <= 30 ? 'text-destructive'
                  : vigencia.restantes <= 90 ? 'text-amber-600 dark:text-amber-500'
                  : 'text-foreground',
              )}>
                {vigencia.vencida
                  ? `vencido há ${Math.abs(vigencia.restantes)} dias`
                  : `${vigencia.restantes} dias restantes`}
              </strong>
            ) : <strong className="text-foreground">—</strong>}
          </span>
          <span>Período de medição: <strong className="text-foreground">{janelaDeMedicao(dados)}</strong></span>
          <span>Faturamento: <strong className="text-foreground">{diaDoFaturamento(dados)}</strong></span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Numero rotulo="Valor original" valor={fmtDinheiro(resumo.valorOriginal)} />
          <Numero
            rotulo="Aditivos"
            valor={fmtDinheiro(resumo.valorAditivos)}
            detalhe={resumo.diasAditados !== 0 ? `${resumo.diasAditados > 0 ? '+' : ''}${resumo.diasAditados} dias` : undefined}
            cor={resumo.valorAditivos < 0 ? 'text-destructive' : undefined}
          />
          {/* É contra o vigente que o avanço deve ser medido: com aditivo, o
              escopo cresceu e o denominador não pode continuar o mesmo. */}
          <Numero rotulo="Valor vigente" valor={fmtDinheiro(resumo.valorVigente)} cor="text-primary" />
          <Numero
            rotulo="Término vigente"
            valor={formatDateBR(resumo.terminoVigente) || '—'}
            detalhe={resumo.diasAditados !== 0 ? 'contratual + prorrogações' : 'sem prorrogação'}
          />
        </div>

        {multa && (
          <p className={cn(
            'text-xs px-3 py-2 rounded-lg border',
            multa.noTeto
              ? 'border-amber-500/40 bg-amber-500/5 text-foreground'
              : 'border-destructive/40 bg-destructive/5 text-foreground',
          )}>
            No ritmo atual, o atraso chega a <strong>{multa.dias} dias</strong> além do término
            vigente — <strong>{fmtDinheiro(multa.exposicao)}</strong> de multa.
            {multa.noTeto && (
              <> A multa bateu no teto de {fmtDinheiro(multa.teto ?? 0)}: a partir daqui, atrasar
              mais não custa mais multa.</>
            )}
          </p>
        )}
      </div>

      {/* ── Aditivos ────────────────────────────────────────────────── */}
      <Grupo
        titulo="Aditivos"
        explicacao="Todo acréscimo de escopo, reajuste ou prorrogação assinado. Sem eles, o avanço percentual está sendo medido contra a base errada — o escopo cresceu e o denominador ficou parado."
        podeEditar={podeEditar}
        aoAdicionar={() => gravar({ aditivos: [...dados.aditivos, aditivoVazio()] })}
        rotuloAdicionar="Adicionar aditivo"
      >
        <table className="w-full border-collapse min-w-[46rem]">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className={cn(cabecalho, 'w-20')}>Nº</th>
              <th className={cn(cabecalho, 'w-32')}>Assinatura</th>
              <th className={cabecalho}>Objeto</th>
              <th className={cn(cabecalho, 'w-36 text-right')}>Valor</th>
              <th className={cn(cabecalho, 'w-24 text-right')}>Dias</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {dados.aditivos.map((a, i) => (
              <tr key={a.id}>
                <td className={celula}>
                  <input className={campo} value={a.numero} disabled={!podeEditar}
                    onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { numero: e.target.value })} />
                </td>
                <td className={celula}>
                  <input type="date" className={cn(campo, 'text-[11px]')} value={a.data} disabled={!podeEditar}
                    onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { data: e.target.value })} />
                </td>
                <td className={celula}>
                  <input className={campo} value={a.objeto} placeholder="O que mudou no contrato" disabled={!podeEditar}
                    onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { objeto: e.target.value })} />
                </td>
                <td className={celula}>
                  <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={a.valor || ''} disabled={!podeEditar}
                    onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { valor: num(e.target.value) })} />
                </td>
                <td className={celula}>
                  <input inputMode="numeric" className={cn(campo, 'text-right tabular-nums')} value={a.dias || ''} disabled={!podeEditar}
                    onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { dias: num(e.target.value) })} />
                </td>
                <BotaoRemover podeEditar={podeEditar}
                  onClick={() => gravar({ aditivos: dados.aditivos.filter((_, k) => k !== i) })} />
              </tr>
            ))}
            {dados.aditivos.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-3 text-xs text-muted-foreground text-center border border-border">
                Nenhum aditivo lançado. O valor vigente é o original.
              </td></tr>
            )}
          </tbody>
        </table>
      </Grupo>

      {/* ── Pleitos ─────────────────────────────────────────────────── */}
      <Grupo
        titulo="Pleitos"
        explicacao="Reivindicações abertas com o cliente: paralisação por terceiros, projeto atrasado, chuva além do contratual. A data de protocolo é obrigatória na prática — pleito tem prazo de caducidade contratual."
        podeEditar={podeEditar}
        aoAdicionar={() => gravar({ pleitos: [...dados.pleitos, pleitoVazio()] })}
        rotuloAdicionar="Adicionar pleito"
        indicadores={
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <Numero
              rotulo="Em aberto"
              valor={fmtDinheiro(resumo.pleitosAbertos.valor)}
              detalhe={`${resumo.pleitosAbertos.quantidade} pleito(s)`}
              cor="text-amber-600 dark:text-amber-500"
            />
            <Numero
              rotulo="Reconhecido"
              valor={fmtDinheiro(resumo.pleitosGanhos.valor)}
              detalhe={`${resumo.pleitosGanhos.quantidade} aprovado(s)`}
              cor="text-success"
            />
            <Numero
              rotulo="Negado"
              valor={fmtDinheiro(resumo.pleitosNegados.valor)}
              detalhe={`${resumo.pleitosNegados.quantidade} pleito(s)`}
              cor="text-destructive"
            />
          </div>
        }
      >
        <table className="w-full border-collapse min-w-[52rem]">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className={cabecalho}>Descrição</th>
              <th className={cn(cabecalho, 'w-32')}>Protocolo</th>
              <th className={cn(cabecalho, 'w-32 text-right')}>Pleiteado</th>
              <th className={cn(cabecalho, 'w-32 text-right')}>Reconhecido</th>
              <th className={cn(cabecalho, 'w-40')}>Status</th>
              <th className={cn(cabecalho, 'w-32')}>Resposta</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {dados.pleitos.map((p, i) => (
              <tr key={p.id}>
                <td className={celula}>
                  <textarea rows={1} className={cn(campo, 'resize-y min-h-[1.75rem]')} value={p.descricao}
                    placeholder="O que gerou o pleito" disabled={!podeEditar}
                    onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { descricao: e.target.value })} />
                </td>
                <td className={celula}>
                  <input type="date" className={cn(campo, 'text-[11px]')} value={p.dataProtocolo} disabled={!podeEditar}
                    onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { dataProtocolo: e.target.value })} />
                </td>
                <td className={celula}>
                  <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={p.valor || ''} disabled={!podeEditar}
                    onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { valor: num(e.target.value) })} />
                </td>
                {/* Reconhecido separado do pleiteado: "aprovado parcial" é
                    justamente o caso em que os dois números diferem. */}
                <td className={celula}>
                  <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={p.valorAprovado || ''} disabled={!podeEditar}
                    onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { valorAprovado: num(e.target.value) })} />
                </td>
                <td className={celula}>
                  <select className={cn(campo, 'text-[11px]')} value={p.status} disabled={!podeEditar}
                    onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { status: e.target.value as StatusPleito })}>
                    {STATUS_PLEITO.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={celula}>
                  <input type="date" className={cn(campo, 'text-[11px]')} value={p.dataResposta} disabled={!podeEditar}
                    onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { dataResposta: e.target.value })} />
                </td>
                <BotaoRemover podeEditar={podeEditar}
                  onClick={() => gravar({ pleitos: dados.pleitos.filter((_, k) => k !== i) })} />
              </tr>
            ))}
            {dados.pleitos.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-3 text-xs text-muted-foreground text-center border border-border">
                Nenhum pleito registrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </Grupo>

      {/* ── Ciclo da medição ────────────────────────────────────────── */}
      <Grupo
        titulo="Ciclo da medição"
        explicacao="Medido não é recebido. Cada competência percorre enviada → aprovada → faturada → recebida, e é entre um estágio e outro que o dinheiro da empresa fica parado no cliente."
        podeEditar={podeEditar}
        aoAdicionar={() => gravar({ medicoes: [...dados.medicoes, medicaoVazia()] })}
        rotuloAdicionar="Adicionar competência"
        indicadores={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Numero rotulo="Medido" valor={fmtDinheiro(resumo.medicao.medido)} />
            <Numero
              rotulo="Travado na aprovação"
              valor={fmtDinheiro(resumo.medicao.travadoNaAprovacao)}
              detalhe="enviado e sem resposta"
              cor={resumo.medicao.travadoNaAprovacao > 0 ? 'text-amber-600 dark:text-amber-500' : undefined}
            />
            <Numero rotulo="A faturar" valor={fmtDinheiro(resumo.medicao.aFaturar)} detalhe="aprovado e sem nota" />
            <Numero
              rotulo="A receber"
              valor={fmtDinheiro(resumo.medicao.aReceber)}
              detalhe="faturado e sem entrada"
              cor={resumo.medicao.aReceber > 0 ? 'text-destructive' : undefined}
            />
          </div>
        }
      >
        <table className="w-full border-collapse min-w-[48rem]">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className={cn(cabecalho, 'w-32')}>Competência</th>
              <th className={cn(cabecalho, 'text-right')}>Medido</th>
              <th className={cn(cabecalho, 'text-right')}>Enviado</th>
              <th className={cn(cabecalho, 'text-right')}>Aprovado</th>
              <th className={cn(cabecalho, 'text-right')}>Faturado</th>
              <th className={cn(cabecalho, 'text-right')}>Recebido</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {dados.medicoes.map((m, i) => (
              <tr key={m.id}>
                <td className={celula}>
                  <input type="month" className={cn(campo, 'text-[11px]')} value={m.mes} disabled={!podeEditar}
                    onChange={(e) => editarLista<CompetenciaMedicao>('medicoes', dados.medicoes, i, { mes: e.target.value })} />
                </td>
                {(['medido', 'enviado', 'aprovado', 'faturado', 'recebido'] as const).map((c) => (
                  <td key={c} className={celula}>
                    <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={m[c] || ''} disabled={!podeEditar}
                      onChange={(e) => editarLista<CompetenciaMedicao>('medicoes', dados.medicoes, i, { [c]: num(e.target.value) })} />
                  </td>
                ))}
                <BotaoRemover podeEditar={podeEditar}
                  onClick={() => gravar({ medicoes: dados.medicoes.filter((_, k) => k !== i) })} />
              </tr>
            ))}
            {dados.medicoes.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-3 text-xs text-muted-foreground text-center border border-border">
                Nenhuma competência lançada.
              </td></tr>
            )}
          </tbody>
          {dados.medicoes.length > 0 && (
            <tfoot>
              <tr className="bg-muted/50 font-semibold text-xs">
                <td className={cn(celula, 'px-2')}>Total</td>
                <td className={cn(celula, 'text-right tabular-nums px-2')}>{fmtDinheiro(resumo.medicao.medido)}</td>
                <td className={cn(celula, 'text-right tabular-nums px-2')}>{fmtDinheiro(resumo.medicao.enviado)}</td>
                <td className={cn(celula, 'text-right tabular-nums px-2')}>{fmtDinheiro(resumo.medicao.aprovado)}</td>
                <td className={cn(celula, 'text-right tabular-nums px-2')}>{fmtDinheiro(resumo.medicao.faturado)}</td>
                <td className={cn(celula, 'text-right tabular-nums px-2')}>{fmtDinheiro(resumo.medicao.recebido)}</td>
                <td className={celula} />
              </tr>
            </tfoot>
          )}
        </table>
      </Grupo>

      {/* O mesmo botão no fim: aditivos, pleitos, medições e custo fazem uma
          página longa, e sem repeti-lo aqui concluir obriga a subir tudo de
          volta. */}
      {aoConcluir && (
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            O lançamento salva sozinho a cada campo.
          </span>
          <button
            type="button"
            onClick={aoConcluir}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Voltar à carteira de contratos"
          >
            <Check className="h-3.5 w-3.5" />
            Concluir
          </button>
        </div>
      )}
    </div>
  );
};


// ─── A ficha de um contrato ───────────────────────────────────────────────

/** Um dado da ficha: rótulo em cima, valor embaixo. */
const Item = ({ rotulo, valor, cor }: { rotulo: string; valor: ReactNode; cor?: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{rotulo}</div>
    <div className={cn('text-xs font-semibold tabular-nums truncate', cor ?? 'text-foreground')}>{valor}</div>
  </div>
);

const corDaVigencia = (v: Posicao['vigencia']) => {
  if (!v) return undefined;
  if (v.vencida || v.restantes <= 30) return 'text-destructive';
  if (v.restantes <= 90) return 'text-amber-600 dark:text-amber-500';
  return undefined;
};

const textoDaVigencia = (v: Posicao['vigencia']) => {
  if (!v) return '—';
  if (v.vencida) return `vencido há ${Math.abs(v.restantes)} dias`;
  return v.total > 0 ? `${v.restantes} de ${v.total} dias` : `${v.restantes} dias`;
};

/**
 * A ficha de um contrato: tudo o que se pergunta sobre ele, de uma vez.
 *
 * Em duas faixas, porque são duas conversas: em cima o contrato — até quando
 * vale, quando fecha a medição, quando fatura. Embaixo o dinheiro — quanto
 * vale, quanto está preso e quanto o atraso custa.
 *
 * Ficha e não linha de tabela: são treze dados por contrato, e numa tabela
 * eles viram treze colunas que só cabem rolando de lado — leitura que ninguém
 * faz numa reunião.
 */
const FichaDoContrato = ({ p, aoAbrir }: { p: Posicao; aoAbrir: () => void }) => (
  <div className="rounded-lg border border-border bg-card p-3 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-sm font-bold text-foreground">{p.nome}</span>
      <button
        onClick={aoAbrir}
        className="text-xs text-primary hover:underline whitespace-nowrap"
      >
        Abrir contrato
      </button>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2">
      <Item rotulo="Início" valor={formatDateBR(p.info?.inicio ?? '') || '—'} />
      <Item rotulo="Término previsto" valor={formatDateBR(p.info?.terminoPrev ?? '') || '—'} />
      {/* O vigente, não o assinado: com prorrogação lançada, é ele que vale —
          e é contra ele que a multa corre. */}
      <Item
        rotulo="Término contratual"
        valor={
          <>
            {formatDateBR(p.resumo.terminoVigente) || '—'}
            {p.resumo.diasAditados !== 0 && (
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                ({p.resumo.diasAditados > 0 ? '+' : ''}{p.resumo.diasAditados}d)
              </span>
            )}
          </>
        }
      />
      <Item rotulo="Vigência" valor={textoDaVigencia(p.vigencia)} cor={corDaVigencia(p.vigencia)} />
      <Item rotulo="Período de medição" valor={janelaDeMedicao(p.dados)} />
      <Item rotulo="Faturamento" valor={diaDoFaturamento(p.dados)} />
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-2 pt-3 border-t border-border">
      <Item rotulo="Original" valor={fmtDinheiro(p.resumo.valorOriginal)} />
      <Item
        rotulo="Aditivos"
        valor={p.resumo.valorAditivos ? fmtDinheiro(p.resumo.valorAditivos) : '—'}
        cor={p.resumo.valorAditivos < 0 ? 'text-destructive' : undefined}
      />
      <Item rotulo="Vigente" valor={fmtDinheiro(p.resumo.valorVigente)} cor="text-primary" />
      <Item
        rotulo="Pleitos abertos"
        valor={p.resumo.pleitosAbertos.valor ? fmtDinheiro(p.resumo.pleitosAbertos.valor) : '—'}
        cor={p.resumo.pleitosAbertos.valor > 0 ? 'text-amber-600 dark:text-amber-500' : undefined}
      />
      <Item
        rotulo="Travado"
        valor={p.resumo.medicao.travadoNaAprovacao ? fmtDinheiro(p.resumo.medicao.travadoNaAprovacao) : '—'}
        cor={p.resumo.medicao.travadoNaAprovacao > 0 ? 'text-amber-600 dark:text-amber-500' : undefined}
      />
      <Item
        rotulo="A receber"
        valor={p.resumo.medicao.aReceber ? fmtDinheiro(p.resumo.medicao.aReceber) : '—'}
        cor={p.resumo.medicao.aReceber > 0 ? 'text-destructive' : undefined}
      />
      <Item
        rotulo="Desvio de custo"
        valor={p.resumo.custo.desvio ? fmtDinheiro(p.resumo.custo.desvio) : '—'}
        cor={p.resumo.custo.desvio > 0 ? 'text-destructive' : p.resumo.custo.desvio < 0 ? 'text-success' : undefined}
      />
      <Item
        rotulo="Multa projetada"
        valor={p.multa ? fmtDinheiro(p.multa.exposicao) : '—'}
        cor={p.multa ? 'text-destructive' : undefined}
      />
    </div>
  </div>
);

// ─── A carteira, por cliente ──────────────────────────────────────────────

/**
 * A carteira agrupada por cliente.
 *
 * Duas tabelas planas com todas as obras juntas obrigavam a caçar as linhas de
 * um cliente no meio das dos outros. Aqui o cliente é a unidade: a barra dele
 * já responde quanto vale e quanto está preso, e abrir mostra os contratos —
 * porque a conversa "e a UNIPAR?" vem antes de "e a FRIGO?".
 */
const CarteiraPorCliente = ({ posicoes, aoFocar }: {
  posicoes: Posicao[];
  aoFocar: (id: string) => void;
}) => {
  const grupos = useMemo(() => {
    const mapa = new Map<string, Posicao[]>();
    posicoes.forEach((p) => {
      const c = p.cliente;
      if (!mapa.has(c)) mapa.set(c, []);
      mapa.get(c)!.push(p);
    });
    return [...mapa.entries()]
      .map(([cliente, lista]) => ({ cliente, lista, total: somarPosicoes(lista) }))
      .sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR', { sensitivity: 'base' }));
  }, [posicoes]);

  // Cliente único: a barra seria um clique a mais para chegar no óbvio.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(grupos.length === 1 ? [grupos[0].cliente] : []),
  );

  const alternar = (c: string) => setAbertos((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(c)) proximo.delete(c); else proximo.add(c);
    return proximo;
  });

  const total = useMemo(() => somarPosicoes(posicoes), [posicoes]);

  return (
    <div className="space-y-2">
      {grupos.map((g) => {
        const aberto = abertos.has(g.cliente);
        return (
          <div key={g.cliente} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => alternar(g.cliente)}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-90')} />
              <span className="text-sm font-bold text-foreground truncate">{g.cliente}</span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {g.lista.length} contrato{g.lista.length > 1 ? 's' : ''}
              </span>
              {/* O resumo do cliente fica na barra: fechado, ele ainda
                  responde a pergunta que traz alguém até aqui. */}
              <span className="ml-auto flex items-center gap-4 text-xs tabular-nums whitespace-nowrap">
                <span className="text-muted-foreground hidden sm:inline">
                  Vigente <strong className="text-primary">{fmtDinheiro(g.total.vigente)}</strong>
                </span>
                {g.total.travado > 0 && (
                  <span className="text-muted-foreground hidden md:inline">
                    Travado <strong className="text-amber-600 dark:text-amber-500">{fmtDinheiro(g.total.travado)}</strong>
                  </span>
                )}
                {g.total.aReceber > 0 && (
                  <span className="text-muted-foreground hidden md:inline">
                    A receber <strong className="text-destructive">{fmtDinheiro(g.total.aReceber)}</strong>
                  </span>
                )}
              </span>
            </button>

            {aberto && (
              <div className="p-2 space-y-2 bg-background">
                {g.lista.map((p) => (
                  <FichaDoContrato key={p.id} p={p} aoAbrir={() => aoFocar(p.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {grupos.length > 1 && (
        <div className="rounded-lg border border-border px-3 py-2.5 flex items-center gap-4 flex-wrap text-xs tabular-nums">
          <span className="text-sm font-bold text-foreground">Carteira</span>
          <span className="text-muted-foreground">
            Vigente <strong className="text-primary">{fmtDinheiro(total.vigente)}</strong>
          </span>
          <span className="text-muted-foreground">
            Travado <strong className={cn(total.travado > 0 && 'text-amber-600 dark:text-amber-500')}>
              {fmtDinheiro(total.travado)}
            </strong>
          </span>
          <span className="text-muted-foreground">
            A receber <strong className={cn(total.aReceber > 0 && 'text-destructive')}>
              {fmtDinheiro(total.aReceber)}
            </strong>
          </span>
          <span className="text-muted-foreground">
            Multa projetada <strong className={cn(total.multa > 0 && 'text-destructive')}>
              {fmtDinheiro(total.multa)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

// ─── O bloco ──────────────────────────────────────────────────────────────

const ContratoConsolidado = ({ obras, foco, podeEditar, aoFocar, aoConcluir }: {
  obras: Project[];
  /** Obra em foco no consolidado; quando há uma, ela abre para lançamento. */
  foco: string | null;
  podeEditar: boolean;
  aoFocar: (id: string) => void;
  /** Fecha o lançamento e devolve o consolidado no topo. */
  aoConcluir: () => void;
}) => {
  const posicoes = useMemo(() => obras.map(posicaoDaObra), [obras]);
  const obraEmFoco = foco ? obras.find((o) => o.id === foco) : null;

  if (obras.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma obra na visão.</p>;
  }

  // Uma obra só: a árvore seria uma casca em volta de um item.
  //
  // `aoConcluir` só vai quando há obra em foco: sem foco não se entrou pela
  // carteira, e não há volta a oferecer.
  if (obraEmFoco || obras.length === 1) {
    return (
      <DetalheDoContrato
        projeto={obraEmFoco ?? obras[0]}
        podeEditar={podeEditar}
        aoConcluir={obraEmFoco ? aoConcluir : undefined}
      />
    );
  }

  return (
    <div className="space-y-3">
      <CarteiraPorCliente posicoes={posicoes} aoFocar={aoFocar} />
      <p className="text-[11px] text-muted-foreground max-w-[80ch]">
        Abra um cliente para ver os contratos dele. Em "abrir contrato" entram aditivos, pleitos,
        medições e custo. A multa projetada usa o mesmo IDP que projeta o término no relatório,
        para não haver dois atrasos diferentes para a mesma obra.
      </p>
    </div>
  );
};

export default ContratoConsolidado;
