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
  type ItemEapFinanceira, type LeituraEap, type ColunaEap, type CampoEap,
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

/**
 * Colunas de quando não houve colagem — EAP digitada à mão.
 *
 * Depois de colar, quem manda são as colunas da PLANILHA: cada contrato tem a
 * sua, e uma grade fixa jogava fora exatamente as colunas daquele contrato.
 */
const COLUNAS_PADRAO: ColunaEap[] = [
  { chave: 'p0', titulo: 'EAP', campo: 'codigo' },
  { chave: 'p1', titulo: 'Descrição', campo: 'descricao' },
  { chave: 'p2', titulo: 'Valor do contrato', campo: 'valorContrato' },
  { chave: 'p3', titulo: 'Previsto no mês', campo: 'previstoMes' },
  { chave: 'p4', titulo: 'Realizado no mês', campo: 'realizadoMes' },
  { chave: 'p5', titulo: 'Acumulado', campo: 'acumulado' },
];

/** Campos que somam no rodapé — os outros não são dinheiro. */
const SOMAVEIS: CampoEap[] = ['valorContrato', 'previstoMes', 'realizadoMes', 'acumulado'];

const EapFinanceiraInput = () => {
  const { eapFinanceira, eapColunas } = useCurrentProject();
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

  /**
   * As colunas da planilha colada; sem colagem, as padrão.
   *
   * Mesma regra do card do relatório, de propósito: a tabela de lançamento e o
   * relatório têm que mostrar a MESMA coisa, senão quem confere aqui não
   * reconhece o que sai lá.
   */
  const colunas: ColunaEap[] =
    (eapColunas ?? []).length > 0 && itens.some((it) => it.celulas)
      ? (eapColunas as ColunaEap[])
      : COLUNAS_PADRAO;

  /**
   * Edita uma célula.
   *
   * Grava sempre o TEXTO CRU da coluna — é ele que a tela mostra — e, quando a
   * coluna foi reconhecida como um campo conhecido, grava também o número, que
   * é o que alimenta os totais e o consolidado.
   */
  const editar = (i: number, coluna: ColunaEap, valor: string) => {
    setEap(itens.map((it, k) => {
      if (k !== i) return it;

      const novo: ItemEapFinanceira = {
        ...it,
        celulas: { ...(it.celulas ?? {}), [coluna.chave]: valor },
      };
      if (!coluna.campo) return novo;

      return coluna.campo === 'codigo' || coluna.campo === 'descricao'
        ? { ...novo, [coluna.campo]: valor }
        : { ...novo, [coluna.campo]: lerValor(valor) };
    }), eapColunas);
  };

  /** O que a célula mostra: o texto do Excel; sem ele, o campo reconhecido. */
  const textoDaCelula = (it: ItemEapFinanceira, c: ColunaEap): string => {
    const cru = it.celulas?.[c.chave];
    if (cru != null) return cru;
    if (!c.campo) return '';
    return c.campo === 'codigo' || c.campo === 'descricao'
      ? String(it[c.campo] ?? '')
      : (Number(it[c.campo]) || '').toString();
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
            Copie da planilha de medição <strong>com a linha de títulos</strong>. As colunas entram
            exatamente como estão no Excel, com os títulos do arquivo. As que o app reconhece pelo
            nome (EAP, Descrição, Valor do contrato, Previsto, Realizado, Acumulado) também somam
            nos totais e alimentam o consolidado; as demais entram como texto.
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
              {colunas.map((c) => (
                <th key={c.chave} className={cn('px-2 py-1.5 border border-border whitespace-nowrap',
                  c.campo === 'descricao' ? 'text-left min-w-[220px]' : 'text-center')}>
                  {c.titulo}
                </th>
              ))}
              <th className="px-2 py-1.5 border border-border w-10" />
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i} className={nivelDoCodigo(it.codigo) === 1 ? 'font-semibold bg-muted/30' : undefined}>
                {colunas.map((c) => (
                  <td key={c.chave} className="border border-border px-1 py-1">
                    {/* Toda célula é editável, inclusive as colunas que o
                        reconhecedor não conhece — quem chega nesta aba já é
                        administrador, gestor ou planejador (rota EditorRoute). */}
                    <input
                      type="text"
                      inputMode={c.campo === 'codigo' || c.campo === 'descricao' ? 'text' : 'decimal'}
                      className={cn(
                        'w-full outline-none text-xs rounded px-1 py-0.5 bg-transparent',
                        // A borda ao passar o mouse é o que diz "isto se edita":
                        // célula de tabela sem nenhum sinal parece só leitura.
                        'hover:bg-muted/40 focus:bg-muted/60 focus:ring-1 focus:ring-primary/40',
                        c.campo === 'descricao' ? 'text-left' : 'text-center',
                      )}
                      style={c.campo === 'descricao'
                        ? { paddingLeft: `${Math.min(nivelDoCodigo(it.codigo) - 1, 4) * 12}px` }
                        : undefined}
                      value={textoDaCelula(it, c)}
                      onChange={(e) => editar(i, c, e.target.value)}
                    />
                  </td>
                ))}
                <td className="border border-border px-1 py-1 text-center">
                  <button
                    onClick={() => setEap(itens.filter((_, k) => k !== i), eapColunas)}
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
              {/* O rodapé segue as MESMAS colunas da tabela: com a planilha do
                  contrato na tela, um total em posição fixa cairia embaixo da
                  coluna errada. Só as colunas de dinheiro somam. */}
              <tr className="bg-muted/60 font-semibold">
                {colunas.map((c, k) => (
                  <td key={c.chave} className={cn(
                    'border border-border px-2 py-1.5 tabular-nums',
                    c.campo && SOMAVEIS.includes(c.campo) ? 'text-center' : 'text-left',
                  )}>
                    {k === 0 && !SOMAVEIS.includes(c.campo as CampoEap) ? 'Total (soma das folhas)' : ''}
                    {c.campo && SOMAVEIS.includes(c.campo)
                      ? fmtDinheiro(totais[c.campo as keyof typeof totais] as number)
                      : ''}
                  </td>
                ))}
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
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEap([...itens, { ...LINHA_VAZIA }], eapColunas)}>
          <Plus className="h-3.5 w-3.5" /> Item
        </Button>
      </div>
    </SecaoRecolhivel>
  );
};

export default EapFinanceiraInput;
