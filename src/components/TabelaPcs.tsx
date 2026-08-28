import { Plus, Trash2 } from 'lucide-react';
import { useProjectStore, type ActionItem, type ActionStatus, type Project } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  acaoVazia, statusEfetivo, CORES_STATUS_PCS, ROTULO_STATUS_PCS, STATUS_ESCOLHIVEIS,
  type StatusPcs,
} from '@/lib/acoesPcs';

/**
 * Plano de ação PCS: problema → causa → solução, com responsável e prazo.
 *
 * É a tabela que fecha a leitura das sete perguntas: os seis blocos anteriores
 * dizem o que aconteceu e onde dói; este é onde a reunião registra o que vai
 * ser feito, por quem e até quando.
 *
 * O status ATRASADO não está no seletor porque não se escolhe: ele sai do
 * prazo contra a data de status. Um atraso que alguém precisa marcar à mão só
 * está certo no dia em que foi marcado.
 */
const TabelaPcs = ({ projeto, dataCorte }: { projeto: Project; dataCorte: string }) => {
  const setActionsDoProjeto = useProjectStore((s) => s.setActionsDoProjeto);
  const { canEdit } = useAuth();

  const acoes = projeto.actions ?? [];
  const gravar = (lista: ActionItem[]) => setActionsDoProjeto(projeto.id, lista);

  const editar = (i: number, campo: keyof ActionItem, valor: string) =>
    gravar(acoes.map((a, k) => (k === i ? { ...a, [campo]: valor } : a)));

  const adicionar = () =>
    gravar([...acoes, acaoVazia(Math.max(0, ...acoes.map((a) => Number(a.id) || 0)) + 1)]);

  const th = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-left whitespace-nowrap';
  const td = 'border border-border/40 px-1 py-1 align-top';
  const campo = 'w-full bg-transparent outline-none text-xs rounded px-1 py-0.5 hover:bg-muted/40 focus:bg-muted/60 focus:ring-1 focus:ring-primary/40';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[52rem]">
          <thead>
            <tr className="bg-table-header text-table-header-foreground">
              <th className={th}>Problema</th>
              <th className={th}>Causa</th>
              <th className={th}>Solução</th>
              <th className={cn(th, 'w-32')}>Responsável</th>
              <th className={cn(th, 'w-32')}>Necessidade</th>
              <th className={cn(th, 'w-36')}>Status</th>
              {canEdit && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {acoes.map((a, i) => {
              const status = statusEfetivo(a, dataCorte);
              return (
                <tr key={a.id ?? i}>
                  {(['problema', 'causa', 'atividade', 'responsavel'] as const).map((c) => (
                    <td key={c} className={td}>
                      {canEdit ? (
                        <textarea
                          rows={1}
                          value={String(a[c] ?? '')}
                          onChange={(e) => editar(i, c, e.target.value)}
                          className={cn(campo, 'resize-y min-h-[1.75rem]')}
                        />
                      ) : (
                        <span className="text-xs block px-1 py-0.5">{String(a[c] ?? '') || '—'}</span>
                      )}
                    </td>
                  ))}

                  {/* A data que gera o atraso — por isso é campo de data, e não
                      texto: comparar string com data não compara nada. */}
                  <td className={td}>
                    {canEdit ? (
                      <input
                        type="date"
                        value={a.prazo ?? ''}
                        onChange={(e) => editar(i, 'prazo', e.target.value)}
                        className={cn(campo, 'text-[11px]')}
                      />
                    ) : (
                      <span className="text-xs block px-1 py-0.5">{a.prazo || '—'}</span>
                    )}
                  </td>

                  <td className={td}>
                    <span className={cn(
                      'block rounded-full border px-2 py-0.5 text-[11px] font-semibold text-center mb-1',
                      CORES_STATUS_PCS[status],
                    )}>
                      {ROTULO_STATUS_PCS[status]}
                    </span>
                    {canEdit && (
                      // O seletor guarda a escolha; o selo acima mostra o que
                      // vale, que pode ser ATRASADO mesmo com "em andamento"
                      // escolhido. Os dois juntos deixam a regra visível.
                      <select
                        value={STATUS_ESCOLHIVEIS.includes(a.status as never) ? a.status : 'NÃO INICIADO'}
                        onChange={(e) => editar(i, 'status', e.target.value as ActionStatus)}
                        className="w-full bg-transparent text-[11px] outline-none rounded px-1 py-0.5 hover:bg-muted/40 focus:bg-muted/60"
                      >
                        {STATUS_ESCOLHIVEIS.map((s) => (
                          <option key={s} value={s}>{ROTULO_STATUS_PCS[s as StatusPcs]}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {canEdit && (
                    <td className={cn(td, 'text-center')}>
                      <button
                        onClick={() => gravar(acoes.filter((_, k) => k !== i))}
                        className="p-1 rounded text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remover ação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {acoes.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 7 : 6}
                  className="px-2 py-3 text-xs text-muted-foreground text-center border border-border/40"
                >
                  Nenhuma ação registrada. O que vai ser feito nesta obra até a próxima reunião?
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <button
          onClick={adicionar}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar ação
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">
        <strong>Atrasado</strong> é automático: prazo anterior à data de status
        {dataCorte && ` (${dataCorte.split('-').reverse().join('/')})`} com a ação ainda aberta.
      </p>
    </div>
  );
};

export default TabelaPcs;
