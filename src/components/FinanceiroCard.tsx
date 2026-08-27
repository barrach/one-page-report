import { useMemo } from 'react';
import { useCurrentProject } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { useTvMode } from '@/hooks/use-tv-mode';
import { cn } from '@/lib/utils';
import ObservacoesDoCard from '@/components/ObservacoesDoCard';
import {
  ehFolha, fmtDinheiro, fmtPercentual, nivelDoCodigo, totaisDaEap,
  type CampoEap, type ColunaEap, type ItemEapFinanceira, type TotaisEap,
} from '@/lib/eapFinanceira';

/**
 * Financeiro — a EAP do contrato com valor, previsto, realizado e acumulado.
 *
 * Só administrador, gestor e planejador enxergam: valor de contrato não é
 * informação que se mostra ao cliente da obra, e o relatório é o mesmo
 * documento para os dois lados.
 *
 * ATENÇÃO: isto esconde o card da TELA. O projeto inteiro viaja num único JSON
 * para o navegador, então quem abrir o DevTools ainda alcança os valores.
 * Proteger de verdade exige RLS no banco — hoje desligado.
 */

const KpiFinanceiro = ({
  rotulo, valor, detalhe, cor,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
}) => (
  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</div>
    <div className={cn('text-base font-bold tabular-nums truncate', cor ?? 'text-foreground')}>{valor}</div>
    {detalhe && <div className="text-[10px] text-muted-foreground truncate">{detalhe}</div>}
  </div>
);

/** Valor já formatado de um campo conhecido — usado quando não há colagem. */
const valorDoCampo = (it: ItemEapFinanceira, campo?: CampoEap): string => {
  switch (campo) {
    case 'codigo': return it.codigo;
    case 'descricao': return it.descricao;
    case 'valorContrato': return fmtDinheiro(it.valorContrato);
    case 'previstoMes': return fmtDinheiro(it.previstoMes);
    case 'realizadoMes': return fmtDinheiro(it.realizadoMes);
    case 'acumulado': return fmtDinheiro(it.acumulado);
    default: return '';
  }
};

/** Total da coluna — só as que somam dinheiro. */
const totalDaColuna = (campo: CampoEap | undefined, t: TotaisEap): string => {
  switch (campo) {
    case 'valorContrato': return fmtDinheiro(t.valorContrato);
    case 'previstoMes': return fmtDinheiro(t.previstoMes);
    case 'realizadoMes': return fmtDinheiro(t.realizadoMes);
    case 'acumulado': return fmtDinheiro(t.acumulado);
    default: return '';
  }
};

/**
 * Colunas quando a EAP foi digitada à mão, sem colagem: o mesmo conjunto de
 * antes, para a tabela não ficar vazia.
 */
const COLUNAS_PADRAO: ColunaEap[] = [
  { chave: 'p0', titulo: 'EAP', campo: 'codigo' },
  { chave: 'p1', titulo: 'Descrição', campo: 'descricao' },
  { chave: 'p2', titulo: 'Valor do contrato', campo: 'valorContrato' },
  { chave: 'p3', titulo: 'Previsto no mês', campo: 'previstoMes' },
  { chave: 'p4', titulo: 'Realizado no mês', campo: 'realizadoMes' },
];

const FinanceiroCard = () => {
  const { eapFinanceira, eapColunas } = useCurrentProject();
  const { canEdit } = useAuth();
  const { tvMode } = useTvMode();

  const itens = eapFinanceira ?? [];
  const totais = useMemo(() => totaisDaEap(itens), [itens]);
  // Só valem as colunas que os itens realmente trazem: EAP antiga, sem
  // `celulas`, continua na tabela padrão em vez de virar uma grade de traços.
  const colunas = (eapColunas ?? []).length > 0 && itens.some((it) => it.celulas)
    ? (eapColunas as ColunaEap[])
    : COLUNAS_PADRAO;

  // Mesmo trio que edita: administrador, gestor e planejador.
  if (!canEdit) return null;
  if (tvMode) return null;
  if (itens.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Financeiro</h3>
          <p className="text-xs text-muted-foreground">
            EAP do contrato · visível apenas para administrador, gestor e planejador
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <KpiFinanceiro rotulo="Valor do contrato" valor={fmtDinheiro(totais.valorContrato)} />
        <KpiFinanceiro
          rotulo="Acumulado"
          valor={fmtDinheiro(totais.acumulado)}
          detalhe={`${fmtPercentual(totais.percentualAcumulado)} do contrato`}
        />
        <KpiFinanceiro rotulo="Previsto no mês" valor={fmtDinheiro(totais.previstoMes)} />
        <KpiFinanceiro
          rotulo="Realizado no mês"
          valor={fmtDinheiro(totais.realizadoMes)}
          detalhe={totais.previstoMes > 0
            ? `${fmtPercentual((totais.realizadoMes / totais.previstoMes) * 100)} do previsto`
            : undefined}
          // Medir abaixo do previsto é o que dói: fica em vermelho.
          cor={totais.desvioMes < 0 ? 'text-destructive' : 'text-success'}
        />
        <KpiFinanceiro rotulo="Saldo a medir" valor={fmtDinheiro(totais.saldo)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs border-collapse">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              {colunas.map((c, k) => (
                <th
                  key={c.chave}
                  className={cn(
                    'px-2 py-2 border border-border/30',
                    c.campo === 'descricao' ? 'text-left min-w-[220px]' : 'text-right whitespace-nowrap',
                    k === 0 && 'rounded-tl-lg',
                  )}
                >
                  {c.titulo}
                </th>
              ))}
              {/* Calculada, não colada: fecha a tabela do lado direito. */}
              <th className="px-2 py-2 text-right border border-border/30 w-20 rounded-tr-lg">% no mês</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => {
              const nivel = nivelDoCodigo(it.codigo);
              const folha = ehFolha(itens, i);
              const pctMes = it.valorContrato > 0 ? (it.realizadoMes / it.valorContrato) * 100 : 0;
              const abaixo = it.realizadoMes < it.previstoMes;

              return (
                <tr
                  key={`${it.codigo}-${i}`}
                  className={cn(
                    'border-b border-border',
                    // Linha-mãe é totalizadora: destaque para separar do item medido.
                    !folha && 'bg-muted/40 font-semibold',
                  )}
                >
                  {colunas.map((c) => {
                    // O texto cru da planilha quando existir; senão, o campo já
                    // formatado — cobre a EAP digitada à mão, sem colagem.
                    const cru = it.celulas?.[c.chave];
                    const valor = cru ?? valorDoCampo(it, c.campo);
                    return (
                      <td
                        key={c.chave}
                        className={cn(
                          'px-2 py-1 border border-border/30 tabular-nums',
                          c.campo === 'descricao' ? 'text-left' : 'text-right',
                          // Medir abaixo do previsto é o que dói: fica em vermelho.
                          c.campo === 'realizadoMes' && it.previstoMes > 0 &&
                            (abaixo ? 'text-destructive' : 'text-success'),
                        )}
                      >
                        {c.campo === 'descricao' ? (
                          <span style={{ paddingLeft: `${Math.min(nivel - 1, 4) * 14}px` }} className="block">
                            {valor || '—'}
                          </span>
                        ) : (valor || '—')}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right border border-border/30 tabular-nums">{fmtPercentual(pctMes)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-primary/10 font-bold">
              {colunas.map((c, k) => (
                <td
                  key={c.chave}
                  className={cn(
                    'px-2 py-2 border border-border/30 tabular-nums',
                    c.campo === 'descricao' ? 'text-left' : 'text-right',
                    c.campo === 'realizadoMes' && (totais.desvioMes < 0 ? 'text-destructive' : 'text-success'),
                  )}
                >
                  {/* Só as colunas de dinheiro totalizam; código e descrição
                      carregam o rótulo, e o resto fica em branco em vez de
                      inventar um total para uma coluna que não soma. */}
                  {k === 0 ? 'Total do contrato' : totalDaColuna(c.campo, totais)}
                </td>
              ))}
              <td className="px-2 py-2 text-right border border-border/30 tabular-nums">{fmtPercentual(totais.percentualMes)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2">
        O total soma só as folhas da EAP — numa estrutura em níveis o pai é o total dos filhos, e
        somar tudo contaria o mesmo dinheiro duas vezes.
      </p>

      <ObservacoesDoCard card="financeiro" />
    </div>
  );
};

export default FinanceiroCard;
