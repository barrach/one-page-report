import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Separator } from "@budget/components/ui/separator";
import { Sliders } from "lucide-react";
import { useFinancialGlobalSettings, FINANCIAL_DEFAULTS } from "@budget/hooks/useContractResults";

const num = (v: string, fb = 0) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fb;
};

const GlobalFinancialSettings = () => {
  const { settings, save, isLoading } = useFinancialGlobalSettings();
  const [form, setForm] = useState({
    iss_pct: "", pis_pct: "", cofins_pct: "", csll_pct: "", inss_fat_pct: "", icms_pct: "",
    taxa_adm_pct: "", pet_pct: "",
  });

  useEffect(() => {
    setForm({
      iss_pct: String(settings?.iss_pct ?? FINANCIAL_DEFAULTS.iss_pct),
      pis_pct: String(settings?.pis_pct ?? FINANCIAL_DEFAULTS.pis_pct),
      cofins_pct: String(settings?.cofins_pct ?? FINANCIAL_DEFAULTS.cofins_pct),
      csll_pct: String(settings?.csll_pct ?? FINANCIAL_DEFAULTS.csll_pct),
      inss_fat_pct: String(settings?.inss_fat_pct ?? FINANCIAL_DEFAULTS.inss_fat_pct),
      icms_pct: String(settings?.icms_pct ?? FINANCIAL_DEFAULTS.icms_pct),
      taxa_adm_pct: String(settings?.taxa_adm_pct ?? FINANCIAL_DEFAULTS.taxa_adm_pct),
      pet_pct: String(settings?.pet_pct ?? FINANCIAL_DEFAULTS.pet_pct),
    });
  }, [settings]);

  const total = useMemo(() =>
    num(form.iss_pct) + num(form.pis_pct) + num(form.cofins_pct) +
    num(form.csll_pct) + num(form.inss_fat_pct) + num(form.icms_pct), [form]);

  const handleSave = () => save.mutate({
    iss_pct: num(form.iss_pct, FINANCIAL_DEFAULTS.iss_pct),
    pis_pct: num(form.pis_pct, FINANCIAL_DEFAULTS.pis_pct),
    cofins_pct: num(form.cofins_pct, FINANCIAL_DEFAULTS.cofins_pct),
    csll_pct: num(form.csll_pct, 0),
    inss_fat_pct: num(form.inss_fat_pct, 0),
    icms_pct: num(form.icms_pct, 0),
    taxa_adm_pct: num(form.taxa_adm_pct, FINANCIAL_DEFAULTS.taxa_adm_pct),
    pet_pct: num(form.pet_pct, FINANCIAL_DEFAULTS.pet_pct),
  });

  const PctInput = ({ id, label, value, onChange, hint }: {
    id: string; label: string; value: string; onChange: (v: string) => void; hint?: string;
  }) => (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="relative">
        <Input id={id} type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className="pr-8 h-9" />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Parâmetros Globais de Controladoria
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Valores padrão aplicados quando o contrato não tem configuração própria.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold mb-2">Impostos sobre receita</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <PctInput id="g-iss" label="ISS" value={form.iss_pct} onChange={(v) => setForm((f) => ({ ...f, iss_pct: v }))} />
            <PctInput id="g-pis" label="PIS" value={form.pis_pct} onChange={(v) => setForm((f) => ({ ...f, pis_pct: v }))} />
            <PctInput id="g-cofins" label="COFINS" value={form.cofins_pct} onChange={(v) => setForm((f) => ({ ...f, cofins_pct: v }))} />
            <PctInput id="g-csll" label="CSLL s/ faturamento" value={form.csll_pct} onChange={(v) => setForm((f) => ({ ...f, csll_pct: v }))} />
            <PctInput id="g-inssfat" label="INSS s/ faturamento" value={form.inss_fat_pct} onChange={(v) => setForm((f) => ({ ...f, inss_fat_pct: v }))} />
            <PctInput id="g-icms" label="ICMS" value={form.icms_pct} onChange={(v) => setForm((f) => ({ ...f, icms_pct: v }))} />
          </div>
          <div className="mt-3 flex items-center justify-between p-2.5 rounded-md bg-muted/50 border">
            <span className="text-xs text-muted-foreground">Total padrão de impostos</span>
            <span className="text-sm font-bold tabular-nums">{total.toFixed(2)}%</span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <PctInput id="g-taxa" label="Taxa ADM da sede" value={form.taxa_adm_pct} onChange={(v) => setForm((f) => ({ ...f, taxa_adm_pct: v }))} />
          <PctInput id="g-pet" label="PET sobre salários brutos" value={form.pet_pct} onChange={(v) => setForm((f) => ({ ...f, pet_pct: v }))} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={save.isPending || isLoading}>
            {save.isPending ? "Salvando..." : "Salvar parâmetros globais"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GlobalFinancialSettings;
