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
import { Check, AlertTriangle, CheckCircle2 } from 'lucide-react';

const CAUSA_OPTIONS: DesvioCausaRaiz[] = ['Mão de Obra', 'Material', 'Equipamento', 'Clima', 'Escopo', 'Projeto', 'Outro'];

const EMPTY: DesvioAnalise = {
  tipo: '', causaRaiz: '', descricao: '', impactoPrazo: '',
  acaoCorretiva: '', prazoResposta: '', responsavel: '',
};

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;

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

  useEffect(() => {
    if (desvioAnalise && desvioAnalise.tipo === tipo && tipo !== '') {
      setForm(desvioAnalise);
    } else {
      setForm({ ...EMPTY, tipo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desvioAnalise, tipo]);

  if (tipo === '') return null; // desvio = 0 → não exibe

  const update = <K extends keyof DesvioAnalise>(key: K, value: DesvioAnalise[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setDesvioAnalise({ ...form, tipo });
    setSaved(true);
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

  return (
    <div className={`bg-card rounded-xl border ${accent.ring} card-shadow overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-3 ${accent.headBg}`}>
        <div className="flex items-center gap-2">
          <AccentIcon className={`h-5 w-5 ${accent.text}`} />
          <h3 className={`text-sm sm:text-base font-bold ${accent.text}`}>
            {accent.emoji} {accent.title}
          </h3>
        </div>
        <div className={`text-sm sm:text-base font-bold ${accent.text} whitespace-nowrap`}>
          {fmtPct(desvio)} <span className="font-medium opacity-80 text-xs sm:text-sm">{accent.desvioLabel}</span>
        </div>
      </div>

      {/* Body */}
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
  );
};

export default DesvioAnalysisCard;
