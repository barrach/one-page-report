import { useMemo, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';
import { fmtDinheiro, lerValor } from '@/lib/eapFinanceira';
import { projetarTermino } from '@/lib/previsaoTermino';
import {
  CONTRATO_VAZIO, aditivoVazio, custoVazio, exposicaoDeMulta, medicaoVazia,
  pleitoVazio, resumoDoContrato, rotuloDaCompetencia, STATUS_PLEITO,
  type Aditivo, type CompetenciaMedicao, type CustoMes, type DadosContrato,
  type Pleito, type StatusPleito,
} from '@/lib/contrato';

/**
 * Dados do contrato.
 *
 * O relatório sempre soube responder "a obra anda?". Esta seção existe para ele
 * responder "a obra paga?" — e numa obra industrial as duas respostas divergem
 * com frequência.
 *
 * Cada tabela aqui é um lançamento que já existe em algum lugar da empresa: o
 * aditivo assinado, o pleito protocolado, a medição enviada, o custo do mês. O
 * trabalho não é produzir dado novo, é trazer para perto do avanço o dado que
 * hoje mora numa planilha separada de cada um.
 */

const celula = 'border border-border px-1 py-1 align-middle';
const campo = 'w-full bg-transparent outline-none text-xs rounded px-1 py-0.5 hover:bg-muted/40 focus:bg-muted/60 focus:ring-1 focus:ring-primary/40';
const cabecalho = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left whitespace-nowrap';

/** Indicador do topo de cada bloco — o que o lançamento produz. */
const Numero = ({ rotulo, valor, detalhe, cor }: {
  rotulo: string; valor: string; detalhe?: string; cor?: string;
}) => (
  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</div>
    <div className={cn('text-base font-bold tabular-nums truncate', cor ?? 'text-foreground')}>{valor}</div>
    {detalhe && <div className="text-[10px] text-muted-foreground truncate">{detalhe}</div>}
  </div>
);

const Bloco = ({ titulo, explicacao, indicadores, children, aoAdicionar, rotuloAdicionar }: {
  titulo: string;
  explicacao: string;
  indicadores?: ReactNode;
  children: ReactNode;
  aoAdicionar: () => void;
  rotuloAdicionar: string;
}) => (
  <div className="rounded-lg border border-border p-3 space-y-3">
    <div>
      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">{titulo}</h4>
      <p className="text-xs text-muted-foreground max-w-[80ch]">{explicacao}</p>
    </div>
    {indicadores}
    <div className="overflow-x-auto">{children}</div>
    <button
      onClick={aoAdicionar}
      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
    >
      <Plus className="h-3.5 w-3.5" /> {rotuloAdicionar}
    </button>
  </div>
);

const BotaoRemover = ({ onClick }: { onClick: () => void }) => (
  <td className={cn(celula, 'text-center w-8')}>
    <button
      onClick={onClick}
      className="p-1 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
      title="Remover linha"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  </td>
);

const DadosContratoInput = () => {
  const { info, contratoDados } = useCurrentProject();
  const setContratoDados = useProjectStore((s) => s.setContratoDados);

  const dados: DadosContrato = contratoDados ?? CONTRATO_VAZIO;
  const valorOriginal = Number(info?.valorContrato) || 0;

  const resumo = useMemo(() => resumoDoContrato(valorOriginal, dados), [valorOriginal, dados]);

  /**
   * A exposição a multa sai do MESMO IDP que o resto do relatório usa para
   * projetar o término. Uma segunda projeção só para a multa daria dois
   * atrasos diferentes na mesma tela.
   */
  const multa = useMemo(() => {
    const prev = Number(info?.avancoPrev) || 0;
    const real = Number(info?.avancoReal) || 0;
    const idp = prev > 0 ? (real / prev) * 100 : 0;
    const previsao = projetarTermino(info?.inicio ?? '', resumo.terminoVigente || info?.terminoLB || '', idp);
    return exposicaoDeMulta(
      previsao?.desvioDias ?? 0,
      dados.multaDiaria,
      resumo.valorVigente,
      dados.tetoMultaPercentual,
    );
  }, [info, dados.multaDiaria, dados.tetoMultaPercentual, resumo.terminoVigente, resumo.valorVigente]);

  const gravar = (patch: Partial<DadosContrato>) => setContratoDados({ ...dados, ...patch });

  const editarLista = <T extends { id: string }>(
    chave: 'aditivos' | 'pleitos' | 'medicoes' | 'custos',
    lista: T[],
    i: number,
    patch: Partial<T>,
  ) => gravar({ [chave]: lista.map((x, k) => (k === i ? { ...x, ...patch } : x)) } as Partial<DadosContrato>);

  const num = (v: string) => lerValor(v);

  return (
    <SecaoRecolhivel
      id="dados-contrato"
      titulo="Dados do Contrato"
      descricao="Aditivos, pleitos, ciclo da medição e custo incorrido — o que responde se a obra paga, e não só se ela anda."
      padrao={false}
      resumo={
        resumo.valorVigente > 0 ? (
          <span className="text-xs text-muted-foreground">
            Vigente {fmtDinheiro(resumo.valorVigente)}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">

        {/* ── O contrato em si ──────────────────────────────────────── */}
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
                type="date"
                value={dados.terminoContratual ?? ''}
                onChange={(e) => gravar({ terminoContratual: e.target.value })}
                className={cn(campo, 'text-sm border border-border py-1.5')}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Multa por dia de atraso (R$)</label>
              <input
                inputMode="decimal"
                value={dados.multaDiaria || ''}
                onChange={(e) => gravar({ multaDiaria: num(e.target.value) })}
                placeholder="0,00"
                className={cn(campo, 'text-sm border border-border py-1.5')}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Teto da multa (% do contrato)</label>
              <input
                inputMode="decimal"
                value={dados.tetoMultaPercentual || ''}
                onChange={(e) => gravar({ tetoMultaPercentual: num(e.target.value) })}
                placeholder="10"
                className={cn(campo, 'text-sm border border-border py-1.5')}
              />
            </div>
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

        {/* ── Aditivos ──────────────────────────────────────────────── */}
        <Bloco
          titulo="Aditivos"
          explicacao="Todo acréscimo de escopo, reajuste ou prorrogação assinado. Sem eles, o avanço percentual está sendo medido contra a base errada — o escopo cresceu e o denominador ficou parado."
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
                    <input className={campo} value={a.numero}
                      onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { numero: e.target.value })} />
                  </td>
                  <td className={celula}>
                    <input type="date" className={cn(campo, 'text-[11px]')} value={a.data}
                      onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { data: e.target.value })} />
                  </td>
                  <td className={celula}>
                    <input className={campo} value={a.objeto} placeholder="O que mudou no contrato"
                      onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { objeto: e.target.value })} />
                  </td>
                  <td className={celula}>
                    <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={a.valor || ''}
                      onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { valor: num(e.target.value) })} />
                  </td>
                  <td className={celula}>
                    <input inputMode="numeric" className={cn(campo, 'text-right tabular-nums')} value={a.dias || ''}
                      onChange={(e) => editarLista<Aditivo>('aditivos', dados.aditivos, i, { dias: num(e.target.value) })} />
                  </td>
                  <BotaoRemover onClick={() => gravar({ aditivos: dados.aditivos.filter((_, k) => k !== i) })} />
                </tr>
              ))}
              {dados.aditivos.length === 0 && (
                <tr><td colSpan={6} className="px-2 py-3 text-xs text-muted-foreground text-center border border-border">
                  Nenhum aditivo lançado. O valor vigente é o original.
                </td></tr>
              )}
            </tbody>
          </table>
        </Bloco>

        {/* ── Pleitos ───────────────────────────────────────────────── */}
        <Bloco
          titulo="Pleitos"
          explicacao="Reivindicações abertas com o cliente: paralisação por terceiros, projeto atrasado, chuva além do contratual. A data de protocolo é obrigatória na prática — pleito tem prazo de caducidade contratual."
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
                      placeholder="O que gerou o pleito"
                      onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { descricao: e.target.value })} />
                  </td>
                  <td className={celula}>
                    <input type="date" className={cn(campo, 'text-[11px]')} value={p.dataProtocolo}
                      onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { dataProtocolo: e.target.value })} />
                  </td>
                  <td className={celula}>
                    <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={p.valor || ''}
                      onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { valor: num(e.target.value) })} />
                  </td>
                  {/* Reconhecido separado do pleiteado: "aprovado parcial" é
                      justamente o caso em que os dois números diferem. */}
                  <td className={celula}>
                    <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={p.valorAprovado || ''}
                      onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { valorAprovado: num(e.target.value) })} />
                  </td>
                  <td className={celula}>
                    <select className={cn(campo, 'text-[11px]')} value={p.status}
                      onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { status: e.target.value as StatusPleito })}>
                      {STATUS_PLEITO.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className={celula}>
                    <input type="date" className={cn(campo, 'text-[11px]')} value={p.dataResposta}
                      onChange={(e) => editarLista<Pleito>('pleitos', dados.pleitos, i, { dataResposta: e.target.value })} />
                  </td>
                  <BotaoRemover onClick={() => gravar({ pleitos: dados.pleitos.filter((_, k) => k !== i) })} />
                </tr>
              ))}
              {dados.pleitos.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-3 text-xs text-muted-foreground text-center border border-border">
                  Nenhum pleito registrado.
                </td></tr>
              )}
            </tbody>
          </table>
        </Bloco>

        {/* ── Ciclo da medição ──────────────────────────────────────── */}
        <Bloco
          titulo="Ciclo da medição"
          explicacao="Medido não é recebido. Cada competência percorre enviada → aprovada → faturada → recebida, e é entre um estágio e outro que o dinheiro da empresa fica parado no cliente."
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
              <Numero
                rotulo="A faturar"
                valor={fmtDinheiro(resumo.medicao.aFaturar)}
                detalhe="aprovado e sem nota"
              />
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
                    <input type="month" className={cn(campo, 'text-[11px]')} value={m.mes}
                      onChange={(e) => editarLista<CompetenciaMedicao>('medicoes', dados.medicoes, i, { mes: e.target.value })} />
                  </td>
                  {(['medido', 'enviado', 'aprovado', 'faturado', 'recebido'] as const).map((c) => (
                    <td key={c} className={celula}>
                      <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={m[c] || ''}
                        onChange={(e) => editarLista<CompetenciaMedicao>('medicoes', dados.medicoes, i, { [c]: num(e.target.value) })} />
                    </td>
                  ))}
                  <BotaoRemover onClick={() => gravar({ medicoes: dados.medicoes.filter((_, k) => k !== i) })} />
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
        </Bloco>

        {/* ── Custo incorrido ───────────────────────────────────────── */}
        <Bloco
          titulo="Custo incorrido"
          explicacao="O custo que já saiu do caixa, mês a mês, contra o que estava previsto para o mesmo período. Sem ele a margem projetada é uma estimativa antiga repetida: ela só muda quando alguém reescreve o número."
          aoAdicionar={() => gravar({ custos: [...dados.custos, custoVazio()] })}
          rotuloAdicionar="Adicionar mês"
          indicadores={
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <Numero rotulo="Custo previsto" valor={fmtDinheiro(resumo.custo.previsto)} />
              <Numero rotulo="Custo incorrido" valor={fmtDinheiro(resumo.custo.incorrido)} />
              <Numero
                rotulo="Desvio"
                valor={fmtDinheiro(resumo.custo.desvio)}
                detalhe={resumo.custo.desvio > 0 ? 'gastou mais que o previsto' : 'dentro do previsto'}
                cor={resumo.custo.desvio > 0 ? 'text-destructive' : 'text-success'}
              />
            </div>
          }
        >
          <table className="w-full border-collapse min-w-[32rem]">
            <thead>
              <tr className="bg-table-header text-table-header-foreground">
                <th className={cn(cabecalho, 'w-32')}>Mês</th>
                <th className={cn(cabecalho, 'text-right')}>Previsto</th>
                <th className={cn(cabecalho, 'text-right')}>Incorrido</th>
                <th className={cn(cabecalho, 'text-right w-32')}>Desvio</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {dados.custos.map((c, i) => {
                const desvio = (Number(c.incorrido) || 0) - (Number(c.previsto) || 0);
                return (
                  <tr key={c.id}>
                    <td className={celula}>
                      <input type="month" className={cn(campo, 'text-[11px]')} value={c.mes}
                        onChange={(e) => editarLista<CustoMes>('custos', dados.custos, i, { mes: e.target.value })} />
                    </td>
                    <td className={celula}>
                      <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={c.previsto || ''}
                        onChange={(e) => editarLista<CustoMes>('custos', dados.custos, i, { previsto: num(e.target.value) })} />
                    </td>
                    <td className={celula}>
                      <input inputMode="decimal" className={cn(campo, 'text-right tabular-nums')} value={c.incorrido || ''}
                        onChange={(e) => editarLista<CustoMes>('custos', dados.custos, i, { incorrido: num(e.target.value) })} />
                    </td>
                    {/* Calculado: um campo de desvio digitável só criaria a
                        chance de contradizer as duas colunas ao lado. */}
                    <td className={cn(celula, 'text-right tabular-nums text-xs font-semibold px-2',
                      desvio > 0 ? 'text-destructive' : desvio < 0 ? 'text-success' : 'text-muted-foreground')}>
                      {c.previsto || c.incorrido ? fmtDinheiro(desvio) : '—'}
                    </td>
                    <BotaoRemover onClick={() => gravar({ custos: dados.custos.filter((_, k) => k !== i) })} />
                  </tr>
                );
              })}
              {dados.custos.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-3 text-xs text-muted-foreground text-center border border-border">
                  Nenhum mês lançado. Sem custo incorrido, a margem do bloco 5 do consolidado é o orçamento repetido.
                </td></tr>
              )}
            </tbody>
          </table>
        </Bloco>

        <p className="text-[11px] text-muted-foreground max-w-[80ch]">
          A competência é o mês a que a medição se refere, não o de envio
          {dados.medicoes.length > 0 && (
            <> — a última lançada é <strong>{rotuloDaCompetencia(dados.medicoes[dados.medicoes.length - 1].mes)}</strong></>
          )}. A exposição a multa usa o mesmo IDP que projeta o término no relatório,
          para não haver dois atrasos diferentes na mesma tela.
        </p>
      </div>
    </SecaoRecolhivel>
  );
};

export default DadosContratoInput;
