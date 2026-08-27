import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';
import ClearDataButton from '@/components/ClearDataButton';
import {
  fmtDinheiro, lerEapColada, lerValor, nivelDoCodigo, totaisDaEap,
  type ItemEapFinanceira, type LeituraEap,
} from '@/lib/eapFinanceira';

/**
 * Lançamento da EAP financeira.
 *
 * Colar da planilha de medição é o caminho normal — ninguém digita cinquenta
 * itens de contrato à mão toda semana. A tabela abaixo existe para o ajuste
 * fino de uma linha ou outra depois de colar.
 */

const LINHA_VAZIA: ItemEapFinanceira = {
  codigo: '', descricao: '', valorContrato: 0, previstoMes: 0, realizadoMes: 0, acumulado: 0,
};

const COLUNAS: { campo: keyof ItemEapFinanceira; titulo: string; largura: string }[] = [
  { campo: 'codigo', titulo: 'EAP', largura: 'w-24' },
  { campo: 'descricao', titulo: 'Descrição', largura: 'min-w-[220px]' },
  { campo: 'valorContrato', titulo: 'Valor do contrato', largura: 'w-36' },
  { campo: 'previstoMes', titulo: 'Previsto no mês', largura: 'w-32' },
  { campo: 'realizadoMes', titulo: 'Realizado no mês', largura: 'w-32' },
  { campo: 'acumulado', titulo: 'Acumulado', largura: 'w-36' },
];

const EapFinanceiraInput = () => {
  const { eapFinanceira } = useCurrentProject();
  const setEap = useProjectStore((s) => s.setEapFinanceira);

  const itens = eapFinanceira ?? [];
  const totais = useMemo(() => totaisDaEap(itens), [itens]);

  const [mostrarColagem, setMostrarColagem] = useState(false);
  const [colagem, setColagem] = useState('');
  const [leitura, setLeitura] = useState<LeituraEap | null>(null);

  const ler = () => {
    const lida = lerEapColada(colagem);
    if (lida.itens.length === 0) {
      toast.error('Não achei o cabeçalho da planilha. Copie incluindo a linha de títulos das colunas.');
      return;
    }
    setLeitura(lida);
  };

  const aplicar = () => {
    if (!leitura) return;
    // Itens e colunas vão juntos: é o par que faz o relatório mostrar as
    // colunas da planilha, com os títulos dela.
    setEap(leitura.itens, leitura.colunas);
    toast.success(`✓ EAP aplicada — ${leitura.itens.length} itens, ${leitura.colunas.length} colunas`);
    setLeitura(null);
    setColagem('');
    setMostrarColagem(false);
  };

  const editar = (i: number, campo: keyof ItemEapFinanceira, valor: string) => {
    setEap(itens.map((it, k) => {
      if (k !== i) return it;
      if (campo === 'codigo' || campo === 'descricao') return { ...it, [campo]: valor };
      return { ...it, [campo]: lerValor(valor) };
    }));
  };

  return (
    <SecaoRecolhivel
      id="eap-financeira"
      titulo="EAP Financeira"
      descricao="Itens do contrato com valor, previsto e realizado no mês e acumulado. Alimenta o card Financeiro do relatório, que só administrador, gestor e planejador enxergam."
      padrao={false}
      resumo={
        itens.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {itens.length} itens · {fmtDinheiro(totais.valorContrato)}
          </span>
        ) : undefined
      }
      acoes={
        <>
          <button
            onClick={() => setMostrarColagem((v) => !v)}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors',
              mostrarColagem
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {mostrarColagem ? '▾ Fechar colagem' : '▸ Colar da planilha'}
          </button>
          {itens.length > 0 && (
            <ClearDataButton sectionName="EAP Financeira" onConfirm={() => setEap([])} />
          )}
        </>
      }
    >
      {mostrarColagem && (
        <div className="mb-4 space-y-2 p-3 rounded-md bg-card border">
          <p className="text-xs text-muted-foreground">
            Copie da planilha de medição <strong>com a linha de títulos</strong>. A ordem das colunas
            não importa — elas são reconhecidas pelo nome (EAP, Descrição, Valor do contrato,
            Previsto, Realizado, Acumulado).
          </p>
          <Textarea
            rows={5}
            value={colagem}
            onChange={(e) => setColagem(e.target.value)}
            placeholder="Cole aqui as linhas copiadas do Excel..."
            className="font-mono text-xs"
          />
          <Button size="sm" onClick={ler}>Ler colagem</Button>
        </div>
      )}

      {leitura && (
        <div className="mb-4 space-y-3 p-3 rounded-md bg-card border border-primary/40">
          <p className="text-xs text-foreground/80">
            Reconheci <strong>{leitura.itens.length} itens</strong>, somando{' '}
            <strong>{fmtDinheiro(totaisDaEap(leitura.itens).valorContrato)}</strong> de contrato.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leitura.reconhecidas.map((r) => (
              <span key={r.campo} className="text-[11px] rounded border border-border bg-muted/40 px-1.5 py-0.5">
                <strong>{r.campo}</strong> ← {r.cabecalho}
              </span>
            ))}
          </div>
          {leitura.faltando.length > 0 && (
            <p className="text-[11px] text-destructive">
              Sem coluna para: {leitura.faltando.join(', ')}. Esses campos entram zerados.
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={aplicar}>Aplicar</Button>
            <Button size="sm" variant="outline" onClick={() => setLeitura(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
              {COLUNAS.map((c) => (
                <th key={c.campo} className={cn('px-2 py-1.5 border border-border', c.largura,
                  c.campo === 'descricao' ? 'text-left' : 'text-center')}>
                  {c.titulo}
                </th>
              ))}
              <th className="px-2 py-1.5 border border-border w-10" />
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i} className={nivelDoCodigo(it.codigo) === 1 ? 'font-semibold bg-muted/30' : undefined}>
                {COLUNAS.map((c) => (
                  <td key={c.campo} className="border border-border px-1 py-1">
                    <input
                      type="text"
                      inputMode={c.campo === 'codigo' || c.campo === 'descricao' ? 'text' : 'decimal'}
                      className={cn(
                        'w-full bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5',
                        c.campo === 'descricao' ? 'text-left' : 'text-center',
                      )}
                      style={c.campo === 'descricao'
                        ? { paddingLeft: `${Math.min(nivelDoCodigo(it.codigo) - 1, 4) * 12}px` }
                        : undefined}
                      value={
                        c.campo === 'codigo' || c.campo === 'descricao'
                          ? (it[c.campo] as string)
                          : (it[c.campo] as number) || ''
                      }
                      onChange={(e) => editar(i, c.campo, e.target.value)}
                    />
                  </td>
                ))}
                <td className="border border-border px-1 py-1 text-center">
                  <button
                    onClick={() => setEap(itens.filter((_, k) => k !== i))}
                    className="text-destructive/70 hover:text-destructive"
                    title="Remover item"
                  >
                    <Trash2 className="h-3 w-3 mx-auto" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {itens.length > 0 && (
            <tfoot>
              <tr className="bg-muted/60 font-semibold">
                <td className="border border-border px-2 py-1.5" colSpan={2}>
                  Total (soma das folhas)
                </td>
                <td className="border border-border px-2 py-1.5 text-center tabular-nums">{fmtDinheiro(totais.valorContrato)}</td>
                <td className="border border-border px-2 py-1.5 text-center tabular-nums">{fmtDinheiro(totais.previstoMes)}</td>
                <td className="border border-border px-2 py-1.5 text-center tabular-nums">{fmtDinheiro(totais.realizadoMes)}</td>
                <td className="border border-border px-2 py-1.5 text-center tabular-nums">{fmtDinheiro(totais.acumulado)}</td>
                <td className="border border-border" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <p className="text-[11px] text-muted-foreground max-w-[70ch]">
          O total soma só as folhas da EAP. Numa estrutura em níveis o pai é o total dos filhos, e
          somar tudo contaria o mesmo dinheiro duas vezes.
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEap([...itens, { ...LINHA_VAZIA }])}>
          <Plus className="h-3.5 w-3.5" /> Item
        </Button>
      </div>
    </SecaoRecolhivel>
  );
};

export default EapFinanceiraInput;
