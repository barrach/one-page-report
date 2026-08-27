import { useMemo, useState } from 'react';
import { Plus, Trash2, Wand2, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { PASSO_DIAS, parseISOLocal, somarDias, type Periodicidade } from '@/lib/dateUtils';
import {
  converterParaPercentual,
  descreverPeriodicidade,
  gerarDatas,
  lerColagem,
  lerNumero,
  ROTULO_BASE,
  totalReferencia,
  type BaseCurva,
  type PontoAcumulado,
} from '@/lib/msProjectCurve';

/**
 * Curva S a partir do MS Project, em HH ou em Custo.
 *
 * O Project entrega valores absolutos acumulados; aqui a pessoa lança (ou cola)
 * as três séries, escolhe onde a obra começou e de quanto em quanto tempo a
 * curva anda, e o painel devolve o percentual pronto para o relatório. A
 * conversão em si mora em `lib/msProjectCurve.ts`, que é testável sem tela.
 */

/** Valores como foram digitados — converter só na hora de calcular evita que o
 *  campo "brigue" com quem está no meio de digitar "1.2" ou "1,". */
interface LinhaBruta { lb: string; real: string; acum: string; }

const LINHA_VAZIA: LinhaBruta = { lb: '', real: '', acum: '' };
const PERIODOS_INICIAIS = 8;

/** Date → yyyy-mm-dd pelos getters locais; `toISOString` jogaria o dia para trás. */
const paraISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtValor = (n: number, base: BaseCurva): string => {
  if (!isFinite(n) || n <= 0) return '—';
  if (base === 'custo') {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  }
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
};

const MsProjectCurveInput = () => {
  const { info } = useCurrentProject();
  const { setSCurveData, setStatusDateIndex, setInfo, setLastImport } = useProjectStore();

  const [base, setBase] = useState<BaseCurva>(info.curvaBase ?? 'trabalho');
  const [inicio, setInicio] = useState<string>(info.curvaInicio ?? info.inicio ?? '');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(info.curvaPeriodicidade ?? 'semanal');
  const [linhas, setLinhas] = useState<LinhaBruta[]>(
    () => Array.from({ length: PERIODOS_INICIAIS }, () => ({ ...LINHA_VAZIA })),
  );
  const [mostrarColagem, setMostrarColagem] = useState(false);
  const [colagem, setColagem] = useState('');

  const datas = useMemo(
    () => gerarDatas(inicio, periodicidade, linhas.length),
    [inicio, periodicidade, linhas.length],
  );

  const pontos = useMemo<PontoAcumulado[]>(
    () => linhas.map((l) => ({
      linhaBase: lerNumero(l.lb),
      real: lerNumero(l.real),
      acumulado: lerNumero(l.acum),
    })),
    [linhas],
  );

  const total = useMemo(() => totalReferencia(pontos), [pontos]);
  const previa = useMemo(() => converterParaPercentual(pontos, datas), [pontos, datas]);
  const temDado = pontos.some((p) => (p.linhaBase ?? 0) > 0 || (p.acumulado ?? 0) > 0 || (p.real ?? 0) > 0);

  const editar = (i: number, campo: keyof LinhaBruta, valor: string) => {
    setLinhas((prev) => prev.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));
  };

  const aplicarColagem = () => {
    const lidos = lerColagem(colagem);
    if (lidos.length === 0) {
      toast.error('Não consegui ler nenhum número na colagem.');
      return;
    }
    setLinhas(lidos.map((p) => ({
      lb: p.linhaBase == null ? '' : String(p.linhaBase),
      real: p.real == null ? '' : String(p.real),
      acum: p.acumulado == null ? '' : String(p.acumulado),
    })));
    setColagem('');
    setMostrarColagem(false);
    toast.success(`✓ ${lidos.length} períodos lidos da colagem`);
  };

  const gerar = () => {
    if (!inicio) { toast.error('Informe a data de início da obra.'); return; }
    if (total <= 0) { toast.error('Sem total de linha de base: preencha ao menos a série de Linha de Base Acumulada.'); return; }

    const { curva, statusIndex } = previa;
    const validos = curva.filter((p) => p.date);
    if (validos.length === 0) { toast.error('Nenhum período com data válida.'); return; }

    setSCurveData(validos);

    const patch: Parameters<typeof setInfo>[0] = {
      curvaBase: base,
      curvaInicio: inicio,
      curvaPeriodicidade: periodicidade,
    };
    if (statusIndex >= 0 && statusIndex < validos.length) {
      setStatusDateIndex(statusIndex);
      // "Atualizado em" é o que centraliza a Visão de 5 Semanas. Sem acertar
      // aqui, a curva vinha do Project com uma data de status e o gráfico
      // continuava centrado na data antiga.
      const inicioDate = parseISOLocal(inicio);
      if (inicioDate) {
        patch.atualizadoEm = paraISO(somarDias(inicioDate, statusIndex * PASSO_DIAS[periodicidade]));
      }
    }
    setInfo(patch);
    setLastImport('sCurve', new Date().toISOString());
    toast.success(`✓ Curva S gerada — ${validos.length} períodos, 100% = ${fmtValor(total, base)}`);
  };

  const opcao = (ativo: boolean) =>
    cn(
      'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
      ativo
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-primary/40',
    );

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">Curva S pelo MS Project</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Lance os acumulados como o Project exporta — em horas (Trabalho) ou em dinheiro (Custo).
          O percentual sai daqui: cada série é dividida pelo total da linha de base.
        </p>
      </div>

      {/* ── Como a curva é montada ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Base</label>
          <div className="flex gap-1.5">
            {(['trabalho', 'custo'] as BaseCurva[]).map((b) => (
              <button key={b} type="button" onClick={() => setBase(b)} className={opcao(base === b)}>
                {ROTULO_BASE[b].titulo}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Início da obra</label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Avanço</label>
          <div className="flex gap-1.5">
            {([['semanal', 'Semanal'], ['diaria', 'Diário']] as [Periodicidade, string][]).map(([p, rotulo]) => (
              <button key={p} type="button" onClick={() => setPeriodicidade(p)} className={opcao(periodicidade === p)}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conferência em palavras — evita descobrir o engano só depois do gráfico pronto. */}
      <p className="text-xs text-foreground/80 bg-card border border-border rounded-md px-3 py-2">
        {descreverPeriodicidade(inicio, periodicidade)}
      </p>

      {/* ── Colagem direta do Excel / Project ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setMostrarColagem((v) => !v)}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          {mostrarColagem ? 'Fechar colagem' : 'Colar do Excel'}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setLinhas((p) => [...p, { ...LINHA_VAZIA }])}>
          <Plus className="h-3.5 w-3.5" /> Período
        </Button>
        <span className="text-[11px] text-muted-foreground ml-auto">
          100% = <strong className="text-foreground">{fmtValor(total, base)}</strong> (total da linha de base)
        </span>
      </div>

      {mostrarColagem && (
        <div className="space-y-2 p-3 rounded-md bg-card border">
          <p className="text-xs text-muted-foreground">
            Cole do Excel com uma <strong>linha por série</strong> (o rótulo na primeira célula:
            “Linha de Base Acumulado”, “Real Acumulado”, “Acumulado”) ou três colunas na ordem
            <strong> Linha de Base | Real | Acumulado</strong>.
          </p>
          <Textarea
            rows={4}
            value={colagem}
            onChange={(e) => setColagem(e.target.value)}
            placeholder="Cole aqui os acumulados copiados do MS Project ou do Excel..."
            className="font-mono text-xs"
          />
          <Button size="sm" onClick={aplicarColagem}>Ler colagem</Button>
        </div>
      )}

      {/* ── Planilha de lançamento ─────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-3 py-2 text-left font-semibold border border-border min-w-[170px]">
                Métrica
              </th>
              {linhas.map((_, i) => (
                <th key={i} className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] px-2 py-1 text-center font-semibold border border-border min-w-[92px]">
                  <div className="text-xs font-semibold">{datas[i] || '—'}</div>
                  <button
                    onClick={() => setLinhas((p) => p.filter((_, k) => k !== i))}
                    className="text-destructive/70 hover:text-destructive mt-0.5"
                    title="Remover período"
                  >
                    <Trash2 className="h-3 w-3 mx-auto" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ['lb', `${base === 'custo' ? 'Custo' : 'Trabalho'} LB Acum.`],
              ['real', `${base === 'custo' ? 'Custo' : 'Trabalho'} Real Acum.`],
              ['acum', `${base === 'custo' ? 'Custo' : 'Trabalho'} Acum. (plano)`],
            ] as [keyof LinhaBruta, string][]).map(([campo, rotulo]) => (
              <tr key={campo}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold border border-border text-foreground">
                  {rotulo}
                </td>
                {linhas.map((l, i) => (
                  <td key={i} className="border border-border px-1 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full text-center bg-transparent outline-none text-xs focus:bg-muted/50 rounded px-1 py-0.5"
                      value={l[campo]}
                      onChange={(e) => editar(i, campo, e.target.value)}
                      placeholder="—"
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Prévia — o que vai para o relatório se apertar Gerar. */}
            {([
              ['previsto', 'Previsto %', 'text-[hsl(var(--chart-previsto))]'],
              ['real', 'Real %', 'text-[hsl(var(--chart-real))]'],
              ['tendencia', 'Tendência %', 'text-orange-500'],
            ] as ['previsto' | 'real' | 'tendencia', string, string][]).map(([campo, rotulo, cor], idx) => (
              <tr key={campo} className={idx === 0 ? 'border-t-2 border-t-primary/40' : undefined}>
                <td className={cn('sticky left-0 z-10 bg-muted/40 px-3 py-2 font-semibold border border-border', cor)}>
                  {rotulo}
                </td>
                {previa.curva.map((p, i) => (
                  <td key={i} className={cn('border border-border px-1 py-1 text-center bg-muted/20 tabular-nums', cor)}>
                    {p[campo] > 0 ? `${p[campo]}%` : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          O Real Acumulado do Project repete o último valor nos períodos futuros — a prévia corta a
          série na data de status para o gráfico não mostrar avanço que não houve.
        </p>
        <Button onClick={gerar} disabled={!temDado || !inicio} className="gap-1.5 shrink-0">
          <Wand2 className="h-4 w-4" /> Gerar Curva S
        </Button>
      </div>
    </div>
  );
};

export default MsProjectCurveInput;
