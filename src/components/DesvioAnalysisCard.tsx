import { useState, useEffect, useMemo } from 'react';
import { useCurrentProject, useProjectStore, type DesvioAnalise, type DesvioCausaRaiz, type DesvioImpactoPrazo } from '@/store/projectStore';
import { computeDesvio } from '@/lib/desvioUtils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

const CAUSA_OPTIONS: DesvioCausaRaiz[] = ['Mão de Obra', 'Material', 'Equipamento', 'Clima', 'Escopo', 'Projeto', 'Outro'];

const EMPTY: DesvioAnalise = {
  tipo: '', causaRaiz: '', descricao: '', impactoPrazo: '',
  acaoCorretiva: '', prazoResposta: '', responsavel: '',
};

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;

// Cresce o textarea conforme o conteúdo
const autoResize = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// dd/MM/yyyy às HH:mm
const fmtSavedAt = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const DesvioAnalysisCard = () => {
  const { sCurveData, info, desvioAnalise } = useCurrentProject();
  const setDesvioAnalise = useProjectStore(s => s.setDesvioAnalise);

  const { desvio } = useMemo(() => computeDesvio(sCurveData, info), [sCurveData, info]);
  const isAtraso = desvio < -0.05;
  const isAdiantado = desvio > 0.05;
  const tipo: DesvioAnalise['tipo'] = isAtraso ? 'atraso' : isAdiantado ? 'adiantamento' : '';

  // Estado local do formulário — carrega do store, reseta se o sinal mudou
  const [form, setForm] = useState<DesvioAnalise>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Já foi preenchido/salvo para este tipo de desvio?
  const isFilled = !!desvioAnalise && desvioAnalise.tipo === tipo
    && (!!desvioAnalise.causaRaiz || !!desvioAnalise.acaoCorretiva || !!desvioAnalise.descricao);

  useEffect(() => {
    if (desvioAnalise && desvioAnalise.tipo === tipo && tipo !== '') {
      setForm(desvioAnalise);
    } else {
      setForm({ ...EMPTY, tipo });
    }
    setExpanded(false); // recolhido por padrão ao abrir / trocar sinal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desvioAnalise, tipo]);

  if (tipo === '') return null; // desvio = 0 → não exibe

  const update = <K extends keyof DesvioAnalise>(key: K, value: DesvioAnalise[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    const savedAt = new Date().toISOString();
    const next = { ...form, tipo, savedAt };
    setDesvioAnalise(next);
    setForm(next);
    setSaved(true);
    setExpanded(false); // recolher automaticamente após salvar
    setTimeout(() => setSaved(false), 2000);
  };

  // Cores e textos dinâmicos
  const accent = isAtraso
    ? { ring: 'border-destructive/40', headBg: 'bg-destructive/10', text: 'text-destructive', icon: AlertTriangle,
        title: 'Atraso — Plano de Recuperação', emoji: '⚠️', desvioLabel: 'abaixo do previsto' }
    : { ring: 'border-success/40', headBg: 'bg-success/10', text: 'text-success', icon: CheckCircle2,
        title: 'Adiantamento — Justificativa', emoji: '✅', desvioLabel: 'acima do previsto' };
  const AccentIcon = accent.icon;

  const descPlaceholder = isAtraso ? 'Descreva a causa do atraso...' : 'Descreva o motivo do adiantamento...';
  const acaoPlaceholder = isAtraso ? 'Descreva as ações de recuperação...' : 'Descreva como o adiantamento será mantido...';
  const acaoLabel = isAtraso ? 'Ação Corretiva' : 'Justificativa';

  // ── ADIANTAMENTO: textarea auto-expansível; linha única quando curto,
  //    empilha quando o texto fica longo (>= 80 chars) ────────────────────────
  if (isAdiantado) {
    const isLong = form.acaoCorretiva.length >= 80;

    const justTextarea = (
      <textarea
        ref={(el) => { if (el) autoResize(el); }}
        maxLength={300}
        value={form.acaoCorretiva}
        onChange={(e) => { update('acaoCorretiva', e.target.value); autoResize(e.target); }}
        placeholder="Descreva o motivo do adiantamento..."
        rows={1}
        className="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{ resize: 'none', overflow: 'hidden', minHeight: '36px' }}
      />
    );
    const saveBtn = (
      <div className="flex items-center gap-2 shrink-0">
        {saved && (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" /> Salva
          </span>
        )}
        <Button onClick={handleSave} size="sm" variant="outline" className="gap-1.5">
          <Check className="h-4 w-4" /> Salvar
        </Button>
      </div>
    );
    const header = (
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <AccentIcon className={`h-4 w-4 ${accent.text}`} />
          <span className={`text-xs sm:text-sm font-bold ${accent.text} whitespace-nowrap`}>
            {accent.emoji} Adiantamento {fmtPct(desvio)}
          </span>
        </div>
        {isLong && (
          <span className={`text-xs font-medium ${accent.text} opacity-80 whitespace-nowrap`}>
            {fmtPct(desvio)} {accent.desvioLabel}
          </span>
        )}
      </div>
    );

    return (
      <div>
        <div className={`bg-card rounded-lg border ${accent.ring}`} style={{ height: 'auto' }}>
          {isLong ? (
            // Empilhado
            <div className="flex flex-col gap-2 px-3 sm:px-4 py-3">
              {header}
              {justTextarea}
              <div className="flex justify-end">{saveBtn}</div>
            </div>
          ) : (
            // Linha única (empilha só no mobile)
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
              <div className="flex items-center gap-1.5 shrink-0 sm:pt-1.5">
                <AccentIcon className={`h-4 w-4 ${accent.text}`} />
                <span className={`text-xs sm:text-sm font-bold ${accent.text} whitespace-nowrap`}>
                  {accent.emoji} Adiantamento {fmtPct(desvio)}
                </span>
              </div>
              {justTextarea}
              <div className="sm:pt-0.5">{saveBtn}</div>
            </div>
          )}
        </div>
        {form.savedAt && (
          <p className="text-[11px] text-muted-foreground mt-1 px-1">Salvo em {fmtSavedAt(form.savedAt)}</p>
        )}
      </div>
    );
  }

  // ── ATRASO: card completo colapsável ───────────────────────────────────────
  return (
    <div>
    <div className={`bg-card rounded-xl border ${accent.ring} card-shadow overflow-hidden`}>
      {/* Header — clicável para alternar */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 sm:px-6 py-3 ${accent.headBg} text-left`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <AccentIcon className={`h-5 w-5 ${accent.text} shrink-0`} />
          <h3 className={`text-sm sm:text-base font-bold ${accent.text}`}>
            {accent.emoji} {accent.title}
          </h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Desvio: com label quando vazio, só % quando preenchido+recolhido */}
          <span className={`text-sm sm:text-base font-bold ${accent.text} whitespace-nowrap`}>
            {fmtPct(desvio)}
            {!(isFilled && !expanded) && (
              <span className="font-medium opacity-80 text-xs sm:text-sm"> {accent.desvioLabel}</span>
            )}
          </span>
          {/* Resumo quando preenchido + recolhido */}
          {isFilled && !expanded && (
            <>
              {form.causaRaiz && (
                <span className="text-xs font-medium text-foreground bg-background/60 rounded px-2 py-0.5 whitespace-nowrap">
                  Causa: {form.causaRaiz}
                </span>
              )}
              {form.responsavel && (
                <span className="text-xs font-medium text-foreground bg-background/60 rounded px-2 py-0.5 whitespace-nowrap">
                  Resp.: {form.responsavel}
                </span>
              )}
            </>
          )}
          {/* Toggle */}
          <span className={`flex items-center gap-1 text-xs font-semibold ${accent.text} whitespace-nowrap`}>
            {expanded ? <><ChevronUp className="h-4 w-4" /> Recolher</>
              : isFilled ? <><ChevronDown className="h-4 w-4" /> Expandir</>
              : <><ChevronDown className="h-4 w-4" /> Preencher</>}
          </span>
        </div>
      </button>

      {/* Body — animação de expand/collapse */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
      <div className="p-4 sm:p-6 space-y-4">
        {/* 1. Causa Raiz */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Causa Raiz <span className="text-destructive">*</span>
          </Label>
          <Select value={form.causaRaiz || undefined} onValueChange={(v) => update('causaRaiz', v as DesvioCausaRaiz)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione a causa raiz..." />
            </SelectTrigger>
            <SelectContent>
              {CAUSA_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Descrição */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">Descrição</Label>
          <Textarea
            rows={3} maxLength={500} value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            placeholder={descPlaceholder} className="text-sm resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{form.descricao.length}/500</p>
        </div>

        {/* 3. Impacto no Prazo — só atraso */}
        {isAtraso && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Impacto no Prazo</Label>
            <RadioGroup
              value={form.impactoPrazo || undefined}
              onValueChange={(v) => update('impactoPrazo', v as DesvioImpactoPrazo)}
              className="space-y-1.5"
            >
              {[
                { v: 'sem_impacto', l: 'Sem impacto no prazo final' },
                { v: 'risco', l: 'Risco de atraso — monitorando' },
                { v: 'confirmado', l: 'Atraso confirmado no término' },
              ].map(opt => (
                <div key={opt.v} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.v} id={`imp-${opt.v}`} />
                  <Label htmlFor={`imp-${opt.v}`} className="text-sm font-normal cursor-pointer">{opt.l}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* 4. Ação Corretiva / Justificativa */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">{acaoLabel}</Label>
          <Textarea
            rows={3} maxLength={500} value={form.acaoCorretiva}
            onChange={(e) => update('acaoCorretiva', e.target.value)}
            placeholder={acaoPlaceholder} className="text-sm resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{form.acaoCorretiva.length}/500</p>
        </div>

        {/* 5. Linha inferior: Prazo + Responsável */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Prazo de Resposta</Label>
            <Input type="date" value={form.prazoResposta}
              onChange={(e) => update('prazoResposta', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Responsável</Label>
            <Input type="text" value={form.responsavel}
              onChange={(e) => update('responsavel', e.target.value)}
              placeholder="Nome do responsável" className="h-9 text-sm" />
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-success">
              <Check className="h-4 w-4" /> Análise salva
            </span>
          )}
          <Button onClick={handleSave} size="sm" className="gap-1.5">
            <Check className="h-4 w-4" /> Salvar Análise
          </Button>
        </div>
      </div>
        </div>
      </div>
    </div>
      {form.savedAt && (
        <p className="text-[11px] text-muted-foreground mt-1 px-1">Salvo em {fmtSavedAt(form.savedAt)}</p>
      )}
    </div>
  );
};

export default DesvioAnalysisCard;
