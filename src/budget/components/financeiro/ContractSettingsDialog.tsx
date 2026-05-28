import { useEffect, useMemo, useState } from "react";
import { Settings2, AlertTriangle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@budget/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@budget/components/ui/alert-dialog";
import { Separator } from "@budget/components/ui/separator";
import {
  useContractSettings,
  useFinancialGlobalSettings,
  FINANCIAL_DEFAULTS,
} from "@budget/hooks/useContractResults";

interface Props {
  contractId: string;
  trigger?: React.ReactNode;
}

type FormState = {
  iss_pct: string; pis_pct: string; cofins_pct: string;
  csll_pct: string; inss_fat_pct: string; icms_pct: string;
  taxa_adm_pct: string; pet_pct: string;
  notes: string;
};

type ContractMetaForm = {
  contract_total_value: string;
  contract_start_date: string;
  contract_end_date: string;
};

const num = (v: string, fallback = 0) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

// ---- Hook local: metadados do contrato (valor total + datas) ----
const useContractMetadata = (contractId: string) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["contract-metadata", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_contract_metadata")
        .select("id, contract_total_value, contract_start_date, contract_end_date")
        .eq("project_id", contractId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (input: {
      contract_total_value: number;
      contract_start_date: string | null;
      contract_end_date: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("financial_contract_metadata")
        .upsert(
          {
            user_id: uid,
            project_id: contractId,
            contract_total_value: input.contract_total_value,
            contract_start_date: input.contract_start_date,
            contract_end_date: input.contract_end_date,
          },
          { onConflict: "project_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-metadata", contractId] });
    },
  });

  return { metadata: query.data, save };
};

const ContractSettingsDialog = ({ contractId, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { settings, save } = useContractSettings(contractId);
  const { settings: global } = useFinancialGlobalSettings();
  const { metadata, save: saveMeta } = useContractMetadata(contractId);

  const fallback = useMemo(() => ({
    iss_pct: global?.iss_pct ?? FINANCIAL_DEFAULTS.iss_pct,
    pis_pct: global?.pis_pct ?? FINANCIAL_DEFAULTS.pis_pct,
    cofins_pct: global?.cofins_pct ?? FINANCIAL_DEFAULTS.cofins_pct,
    csll_pct: global?.csll_pct ?? FINANCIAL_DEFAULTS.csll_pct,
    inss_fat_pct: global?.inss_fat_pct ?? FINANCIAL_DEFAULTS.inss_fat_pct,
    icms_pct: global?.icms_pct ?? FINANCIAL_DEFAULTS.icms_pct,
    taxa_adm_pct: global?.taxa_adm_pct ?? FINANCIAL_DEFAULTS.taxa_adm_pct,
    pet_pct: global?.pet_pct ?? FINANCIAL_DEFAULTS.pet_pct,
  }), [global]);

  const [form, setForm] = useState<FormState>({
    iss_pct: "", pis_pct: "", cofins_pct: "", csll_pct: "", inss_fat_pct: "", icms_pct: "",
    taxa_adm_pct: "", pet_pct: "", notes: "",
  });

  const [meta, setMeta] = useState<ContractMetaForm>({
    contract_total_value: "",
    contract_start_date: "",
    contract_end_date: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      iss_pct: String(settings?.iss_pct ?? fallback.iss_pct),
      pis_pct: String(settings?.pis_pct ?? fallback.pis_pct),
      cofins_pct: String(settings?.cofins_pct ?? fallback.cofins_pct),
      csll_pct: String(settings?.csll_pct ?? fallback.csll_pct),
      inss_fat_pct: String(settings?.inss_fat_pct ?? fallback.inss_fat_pct),
      icms_pct: String(settings?.icms_pct ?? fallback.icms_pct),
      taxa_adm_pct: String(settings?.taxa_adm_pct ?? fallback.taxa_adm_pct),
      pet_pct: String(settings?.pet_pct ?? fallback.pet_pct),
      notes: settings?.notes ?? "",
    });
    setMeta({
      contract_total_value: String(metadata?.contract_total_value ?? ""),
      contract_start_date: metadata?.contract_start_date ?? "",
      contract_end_date: metadata?.contract_end_date ?? "",
    });
  }, [open, settings, fallback, metadata]);

  const totalImpostos = useMemo(() =>
    num(form.iss_pct) + num(form.pis_pct) + num(form.cofins_pct) +
    num(form.csll_pct) + num(form.inss_fat_pct) + num(form.icms_pct), [form]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        iss_pct: num(form.iss_pct, FINANCIAL_DEFAULTS.iss_pct),
        pis_pct: num(form.pis_pct, FINANCIAL_DEFAULTS.pis_pct),
        cofins_pct: num(form.cofins_pct, FINANCIAL_DEFAULTS.cofins_pct),
        csll_pct: num(form.csll_pct, 0),
        inss_fat_pct: num(form.inss_fat_pct, 0),
        icms_pct: num(form.icms_pct, 0),
        taxa_adm_pct: num(form.taxa_adm_pct, FINANCIAL_DEFAULTS.taxa_adm_pct),
        pet_pct: num(form.pet_pct, FINANCIAL_DEFAULTS.pet_pct),
        notes: form.notes || null,
      });
      // Salva metadata em paralelo (silencioso — não bloqueia recálculo)
      const totalValue = num(meta.contract_total_value, 0);
      await saveMeta.mutateAsync({
        contract_total_value: totalValue,
        contract_start_date: meta.contract_start_date || null,
        contract_end_date: meta.contract_end_date || null,
      });
      setConfirmOpen(false);
      setOpen(false);
    } catch (err) {
      toast.error("Erro ao salvar", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const PctInput = ({ id, label, value, hint, onChange }: {
    id: string; label: string; value: string; hint?: string; onChange: (v: string) => void;
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="w-4 h-4" />
              Configurações do contrato
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Configurações financeiras do contrato
            </DialogTitle>
            <DialogDescription>
              Esses parâmetros controlam os cálculos automáticos do Acompanhamento Executivo.
              Quando vazios, o sistema usa os parâmetros globais da sua conta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <h4 className="text-sm font-semibold mb-2">Impostos sobre receita</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <PctInput id="iss" label="ISS" value={form.iss_pct} onChange={(v) => setForm((f) => ({ ...f, iss_pct: v }))} />
                <PctInput id="pis" label="PIS" value={form.pis_pct} onChange={(v) => setForm((f) => ({ ...f, pis_pct: v }))} />
                <PctInput id="cofins" label="COFINS" value={form.cofins_pct} onChange={(v) => setForm((f) => ({ ...f, cofins_pct: v }))} />
                <PctInput id="csll" label="CSLL s/ faturamento" value={form.csll_pct} onChange={(v) => setForm((f) => ({ ...f, csll_pct: v }))} />
                <PctInput id="inssfat" label="INSS s/ faturamento" value={form.inss_fat_pct} onChange={(v) => setForm((f) => ({ ...f, inss_fat_pct: v }))} />
                <PctInput id="icms" label="ICMS" value={form.icms_pct} onChange={(v) => setForm((f) => ({ ...f, icms_pct: v }))} />
              </div>
              <div className="mt-3 flex items-center justify-between p-2.5 rounded-md bg-muted/50 border">
                <span className="text-xs text-muted-foreground">Total de impostos</span>
                <span className="text-sm font-bold tabular-nums">{totalImpostos.toFixed(2)}%</span>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Taxa Administrativa da sede</h4>
              <div className="grid grid-cols-2 gap-3">
                <PctInput id="taxa" label="Taxa ADM sobre Receita Líquida"
                  value={form.taxa_adm_pct}
                  onChange={(v) => setForm((f) => ({ ...f, taxa_adm_pct: v }))}
                  hint="Linha TA = VL × taxa_adm_pct" />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Encargos trabalhistas (PET)</h4>
              <div className="grid grid-cols-2 gap-3">
                <PctInput id="pet" label="PET sobre salários brutos"
                  value={form.pet_pct}
                  onChange={(v) => setForm((f) => ({ ...f, pet_pct: v }))}
                  hint="Aplicado sobre o valor de 3.01 (Salários) realizado do mês" />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-2">Dados do contrato</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ctrTotal" className="text-xs">Valor total do contrato (R$)</Label>
                  <Input
                    id="ctrTotal"
                    type="number"
                    step="0.01"
                    value={meta.contract_total_value}
                    onChange={(e) => setMeta((m) => ({ ...m, contract_total_value: e.target.value }))}
                    className="h-9"
                    placeholder="0,00"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Informativo — não entra em cálculos.</p>
                </div>
                <div>
                  <Label htmlFor="ctrStart" className="text-xs">Data início</Label>
                  <Input
                    id="ctrStart"
                    type="date"
                    value={meta.contract_start_date}
                    onChange={(e) => setMeta((m) => ({ ...m, contract_start_date: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="ctrEnd" className="text-xs">Data fim</Label>
                  <Input
                    id="ctrEnd"
                    type="date"
                    value={meta.contract_end_date}
                    onChange={(e) => setMeta((m) => ({ ...m, contract_end_date: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label htmlFor="notes" className="text-xs">Observações</Label>
              <Input id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar e recalcular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Recalcular todos os resultados?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Alterar esses parâmetros vai recalcular todos os resultados deste contrato
              (todos os meses com dados). Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={save.isPending}>
              Confirmar e recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ContractSettingsDialog;
