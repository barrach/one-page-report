import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, TrendingDown, TrendingUp, Minus, ArrowRight } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { useProjectStore } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/dateUtils';
import { fmtDinheiro } from '@/lib/eapFinanceira';
import { consolidarObras, ROTULO_STATUS, type StatusObra } from '@/lib/consolidado';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * One Page Report consolidado do cliente.
 *
 * Responde uma pergunta diferente da do relatório de obra: não é "como está o
 * FRIGO", é "como está a UNIPAR" — quantas obras, quanto contratado, quais
 * estão em risco e para onde a equipe vai na semana.
 *
 * Por isso é uma aba própria e não um modo do relatório: a página de obra tem
 * layout arrastável, export em A4 e cards que só fazem sentido com uma obra por
 * vez. Misturar os dois deixaria as duas piores.
 */

const SEM_CLIENTE = 'Sem cliente';

const CORES_STATUS: Record<StatusObra, string> = {
  ok: 'text-success border-success/40 bg-success/10',
  risco: 'text-amber-600 dark:text-amber-500 border-amber-500/40 bg-amber-500/10',
  atrasada: 'text-destructive border-destructive/40 bg-destructive/10',
  sem_dado: 'text-muted-foreground border-border bg-muted/30',
};

const Kpi = ({ rotulo, valor, detalhe, cor }: {
  rotulo: string; valor: string; detalhe?: string; cor?: string;
}) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3 card-shadow min-w-0">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{rotulo}</div>
    <div className={cn('text-xl font-bold tabular-nums truncate', cor ?? 'text-foreground')}>{valor}</div>
    {detalhe && <div className="text-[11px] text-muted-foreground truncate">{detalhe}</div>}
  </div>
);

const pct = (n: number) => `${n.toFixed(2).replace('.', ',')}%`;

const Consolidado = () => {
  const { projects, selectProject } = useProjectStore();
  const { canEdit } = useAuth();

  const clientes = useMemo(() => {
    const nomes = new Set(projects.map((p) => p.info?.cliente?.trim() || SEM_CLIENTE));
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [projects]);

  const [cliente, setCliente] = useState<string>(() => clientes[0] ?? SEM_CLIENTE);
  const clienteAtivo = clientes.includes(cliente) ? cliente : (clientes[0] ?? SEM_CLIENTE);

  const doCliente = useMemo(
    () => projects.filter((p) => (p.info?.cliente?.trim() || SEM_CLIENTE) === clienteAtivo),
    [projects, clienteAtivo],
  );

  const dados = useMemo(() => consolidarObras(doCliente), [doCliente]);

  const DesvioIcon = dados.desvio < 0 ? TrendingDown : dados.desvio > 0 ? TrendingUp : Minus;
  const corDesvio = dados.desvio < 0 ? 'text-destructive' : dados.desvio > 0 ? 'text-success' : 'text-foreground';

  const th = 'px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap';
  const td = 'px-3 py-2 text-sm border-t border-border';

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />

      <div className="flex-1 min-w-0 p-3 sm:p-5 space-y-5">

        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground uppercase tracking-widest">
              One Page Consolidado
            </h1>
            <p className="text-xs text-muted-foreground">
              Todas as obras de um cliente numa leitura só
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={clienteAtivo} onValueChange={setCliente}>
              <SelectTrigger className="h-9 min-w-[180px] max-w-[280px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* KPIs do cliente */}
        <div className={cn('grid gap-3 grid-cols-2', canEdit ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
          <Kpi rotulo="Obras" valor={String(dados.obras.length)} detalhe={clienteAtivo} />
          <Kpi rotulo="Avanço previsto" valor={pct(dados.avancoPrev)} />
          <Kpi
            rotulo="Avanço real"
            valor={pct(dados.avancoReal)}
            detalhe={dados.ponderacao === 'contrato'
              ? 'ponderado pelo valor de contrato'
              : 'média simples entre as obras'}
          />
          <Kpi rotulo="Desvio" valor={pct(dados.desvio)} cor={corDesvio} />
          {/* Valor de contrato é do mesmo trio que vê o card Financeiro. */}
          {canEdit && (
            <Kpi
              rotulo="Contratado"
              valor={fmtDinheiro(dados.valorContrato)}
              detalhe={`${fmtDinheiro(dados.realizadoMes)} medidos no mês`}
            />
          )}
        </div>

        {/* Aviso de ponderação: a diferença entre os dois métodos muda o número,
            e quem lê precisa saber qual está vendo. */}
        {dados.ponderacao === 'media' && dados.obras.length > 1 && (
          <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
            O avanço consolidado está em <strong>média simples</strong> porque nem toda obra
            deste cliente tem valor de contrato lançado. Média simples dá o mesmo peso a uma
            obra de R$ 5 milhões e a uma de R$ 50 mil — preencha a EAP financeira das obras
            para o consolidado passar a ponderar pelo contrato.
          </p>
        )}

        {/* Alerta de risco */}
        {(dados.atrasadas > 0 || dados.emRisco > 0) && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            <strong className="text-foreground">
              {dados.atrasadas > 0 && `${dados.atrasadas} obra${dados.atrasadas > 1 ? 's' : ''} atrasada${dados.atrasadas > 1 ? 's' : ''}`}
              {dados.atrasadas > 0 && dados.emRisco > 0 && ' e '}
              {dados.emRisco > 0 && `${dados.emRisco} em risco`}
            </strong>
            <span className="text-muted-foreground"> — as primeiras da lista abaixo.</span>
          </div>
        )}

        {/* Uma linha por obra, da pior para a melhor */}
        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[52rem]">
              <thead>
                <tr className="bg-table-header text-table-header-foreground">
                  <th className={cn(th, 'text-left')}>Obra</th>
                  <th className={th}>Status</th>
                  <th className={cn(th, 'text-right')}>Prev.</th>
                  <th className={cn(th, 'text-right')}>Real</th>
                  <th className={cn(th, 'text-right')}>Desvio</th>
                  <th className={cn(th, 'text-right')}>IDP</th>
                  <th className={th}>Término LB</th>
                  <th className={th}>Projetado</th>
                  {canEdit && <th className={cn(th, 'text-right')}>Contrato</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {dados.obras.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                    <td className={cn(td, 'font-medium text-foreground')}>{o.nome}</td>
                    <td className={cn(td, 'text-center')}>
                      <span className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
                        CORES_STATUS[o.status],
                      )}>
                        {ROTULO_STATUS[o.status]}
                      </span>
                    </td>
                    <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoPrev)}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{pct(o.avancoReal)}</td>
                    <td className={cn(
                      td, 'text-right tabular-nums font-semibold',
                      o.desvio < 0 ? 'text-destructive' : o.desvio > 0 ? 'text-success' : '',
                    )}>
                      {pct(o.desvio)}
                    </td>
                    <td className={cn(td, 'text-right tabular-nums')}>{o.idp.toFixed(0)}%</td>
                    <td className={cn(td, 'text-center whitespace-nowrap')}>
                      {formatDateBR(o.terminoBase) || '—'}
                    </td>
                    <td className={cn(td, 'text-center whitespace-nowrap')}>
                      {o.terminoProjetado ? (
                        <span className={cn((o.desvioDias ?? 0) > 0 && 'text-destructive font-semibold')}>
                          {formatDateBR(o.terminoProjetado)}
                          {o.desvioDias != null && o.desvioDias !== 0 && (
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              {o.desvioDias > 0 ? `+${o.desvioDias}` : o.desvioDias} dias
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    {canEdit && (
                      <td className={cn(td, 'text-right tabular-nums whitespace-nowrap')}>
                        {o.valorContrato > 0 ? fmtDinheiro(o.valorContrato) : '—'}
                      </td>
                    )}
                    <td className={cn(td, 'text-right')}>
                      {/* Do consolidado para a obra: é o caminho natural depois de
                          ver quem está pior. */}
                      <Link
                        to="/"
                        onClick={() => selectProject(o.id)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        Abrir <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {dados.obras.length === 0 && (
                  <tr>
                    <td className={cn(td, 'text-center text-muted-foreground')} colSpan={canEdit ? 10 : 9}>
                      Nenhuma obra para este cliente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground max-w-[80ch] flex items-start gap-1.5">
          <DesvioIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', corDesvio)} />
          <span>
            O IDP é o avanço real dividido pelo previsto. O término projetado estica a
            duração da linha de base nesse mesmo ritmo — é a data que o desempenho aponta,
            não a que foi digitada na obra.
          </span>
        </p>

      </div>
    </div>
  );
};

export default Consolidado;
