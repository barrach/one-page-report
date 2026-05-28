import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@budget/components/ui/sheet";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Button } from "@budget/components/ui/button";
import { Textarea } from "@budget/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@budget/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@budget/components/ui/accordion";
import { Card } from "@budget/components/ui/card";
import { Loader2, Save, Settings, Calendar, RefreshCw } from "lucide-react";
import { useToast } from "@budget/hooks/use-toast";
import {
  ProjectParameters,
  buildDefaultParameters,
  calcularEncargosPonderados,
  useProjectParameters,
  useProjectParameterDefaults,
  useSaveProjectParameters,
  useSaveProjectParameterDefaults,
} from "@budget/hooks/useProjectParameters";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
}

const NumField = ({ label, value, onChange, step = 0.01, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}{suffix ? ` (${suffix})` : ""}</Label>
    <Input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="h-9 text-sm"
    />
  </div>
);

const ProjectParametersSheet = ({ open, onOpenChange, projectId }: Props) => {
  const { toast } = useToast();
  const { data: existing, isLoading } = useProjectParameters(projectId);
  const { data: defaults } = useProjectParameterDefaults();
  const saveProject = useSaveProjectParameters(projectId);
  const saveDefaults = useSaveProjectParameterDefaults();

  const [params, setParams] = useState<ProjectParameters>(() => buildDefaultParameters());

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setParams(buildDefaultParameters(existing));
    } else {
      setParams(buildDefaultParameters(defaults || undefined));
    }
  }, [open, existing, defaults]);

  // Auto-recalculate horas/mes
  useEffect(() => {
    const h = +(params.carga_horaria_diaria * params.dias_trabalhados_semana * 4.4).toFixed(2);
    if (h !== params.horas_trabalhadas_mes) {
      setParams((p) => ({ ...p, horas_trabalhadas_mes: h }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.carga_horaria_diaria, params.dias_trabalhados_semana]);

  const encargos = useMemo(
    () => calcularEncargosPonderados(params.contrato_inicio, params.contrato_fim, params.encargos_por_ano),
    [params.contrato_inicio, params.contrato_fim, params.encargos_por_ano]
  );

  const set = <K extends keyof ProjectParameters>(k: K, v: ProjectParameters[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const updateEncargoAno = (ano: string, field: "cprb" | "inss", v: number) => {
    setParams((p) => ({
      ...p,
      encargos_por_ano: {
        ...p.encargos_por_ano,
        [ano]: { ...(p.encargos_por_ano[ano] || { cprb: 0, inss: 0 }), [field]: v },
      },
    }));
  };

  const handleSave = async () => {
    try {
      await saveProject.mutateAsync(params);
      toast({ title: "Parâmetros salvos", description: "Os parâmetros do orçamento foram atualizados." });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveAsDefault = async () => {
    try {
      await saveDefaults.mutateAsync(params);
      toast({ title: "Padrão global atualizado", description: "Novos orçamentos usarão estes valores como ponto de partida." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleResetFromDefaults = () => {
    setParams(buildDefaultParameters(defaults || undefined));
    toast({ title: "Restaurado", description: "Valores padrão globais carregados (não salvos)." });
  };

  const anos = Object.keys(params.encargos_por_ano).sort();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Parâmetros do Projeto
          </SheetTitle>
          <SheetDescription>
            Base de cálculo para todo o orçamento. Os valores são salvos individualmente por orçamento.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="mt-4 space-y-4">
            <Accordion type="multiple" defaultValue={["b1", "b5"]} className="space-y-2">
              {/* BLOCO 1 */}
              <AccordionItem value="b1" className="border rounded-md px-3">
                <AccordionTrigger className="text-sm font-medium">1. Regime de Trabalho</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <NumField label="Carga horária diária" suffix="h" step={0.1} value={params.carga_horaria_diaria} onChange={(v) => set("carga_horaria_diaria", v)} />
                    <NumField label="Dias trabalhados/semana" value={params.dias_trabalhados_semana} onChange={(v) => set("dias_trabalhados_semana", v)} />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Horas/mês (auto)</Label>
                      <Input value={params.horas_trabalhadas_mes} disabled className="h-9 text-sm bg-muted" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo de período</Label>
                      <Select value={params.tipo_periodo} onValueChange={(v) => set("tipo_periodo", v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meses">Meses</SelectItem>
                          <SelectItem value="quinzenas">Quinzenas</SelectItem>
                          <SelectItem value="semanas">Semanas</SelectItem>
                          <SelectItem value="dias">Dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <NumField label="HE Seg-Sex" suffix="%" value={params.he_seg_sex_pct} onChange={(v) => set("he_seg_sex_pct", v)} />
                    <NumField label="HE Sábado" suffix="%" value={params.he_sabado_pct} onChange={(v) => set("he_sabado_pct", v)} />
                    <NumField label="HE Domingo" suffix="%" value={params.he_domingo_pct} onChange={(v) => set("he_domingo_pct", v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* BLOCO 2 */}
              <AccordionItem value="b2" className="border rounded-md px-3">
                <AccordionTrigger className="text-sm font-medium">2. CCT e Adicionais</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Sindicato / CCT</Label>
                      <Input value={params.sindicato_cct ?? ""} onChange={(e) => set("sindicato_cct", e.target.value)} className="h-9 text-sm" />
                    </div>
                    <NumField label="Salário mínimo regional" suffix="R$" step={1} value={params.salario_minimo_regional} onChange={(v) => set("salario_minimo_regional", v)} />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data do dissídio</Label>
                      <Input type="date" value={params.data_dissidio ?? ""} onChange={(e) => set("data_dissidio", e.target.value || null)} className="h-9 text-sm" />
                    </div>
                    <NumField label="Reajuste previsto" suffix="%" value={params.reajuste_previsto_pct} onChange={(v) => set("reajuste_previsto_pct", v)} />
                    <NumField label="Insalubridade" suffix="% s/ s.m." value={params.insalubridade_pct} onChange={(v) => set("insalubridade_pct", v)} />
                    <NumField label="Periculosidade" suffix="% s/ base" value={params.periculosidade_pct} onChange={(v) => set("periculosidade_pct", v)} />
                    <NumField label="Adicional noturno" suffix="%" value={params.adicional_noturno_pct} onChange={(v) => set("adicional_noturno_pct", v)} />
                    <NumField label="PLR" suffix="salários/ano" step={0.1} value={params.plr_salarios_ano} onChange={(v) => set("plr_salarios_ano", v)} />
                    <NumField label="Cesta básica" suffix="R$/mês" step={1} value={params.cesta_basica_mensal} onChange={(v) => set("cesta_basica_mensal", v)} />
                    <NumField label="Prêmio assiduidade" suffix="R$/mês" step={1} value={params.premio_assiduidade_mensal} onChange={(v) => set("premio_assiduidade_mensal", v)} />
                    <NumField label="Convênio médico" suffix="R$/mês" step={1} value={params.convenio_medico_mensal} onChange={(v) => set("convenio_medico_mensal", v)} />
                    <NumField label="Folga de campo" suffix="R$/dia" step={1} value={params.folga_campo_diaria} onChange={(v) => set("folga_campo_diaria", v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* BLOCO 3 */}
              <AccordionItem value="b3" className="border rounded-md px-3">
                <AccordionTrigger className="text-sm font-medium">3. Alimentação</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <NumField label="Café da manhã" suffix="R$/un" value={params.cafe_manha_unit} onChange={(v) => set("cafe_manha_unit", v)} />
                    <NumField label="Almoço" suffix="R$/un" value={params.almoco_unit} onChange={(v) => set("almoco_unit", v)} />
                    <NumField label="Jantar" suffix="R$/un" value={params.jantar_unit} onChange={(v) => set("jantar_unit", v)} />
                    <NumField label="Lanche" suffix="R$/un" value={params.lanche_unit} onChange={(v) => set("lanche_unit", v)} />
                    <NumField label="Profissionais locais" suffix="%" value={params.pct_profissionais_locais} onChange={(v) => set("pct_profissionais_locais", v)} />
                    <NumField label="Profissionais transferidos" suffix="%" value={params.pct_profissionais_transferidos} onChange={(v) => set("pct_profissionais_transferidos", v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* BLOCO 4 */}
              <AccordionItem value="b4" className="border rounded-md px-3">
                <AccordionTrigger className="text-sm font-medium">4. Consumíveis de Solda</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <NumField label="CO₂" suffix="R$/m³" value={params.preco_co2_m3} onChange={(v) => set("preco_co2_m3", v)} />
                    <NumField label="Argônio" suffix="R$/m³" value={params.preco_argonio_m3} onChange={(v) => set("preco_argonio_m3", v)} />
                    <NumField label="Oxigênio" suffix="R$/m³" value={params.preco_oxigenio_m3} onChange={(v) => set("preco_oxigenio_m3", v)} />
                    <NumField label="Acetileno" suffix="R$/kg" value={params.preco_acetileno_kg} onChange={(v) => set("preco_acetileno_kg", v)} />
                    <NumField label="Eletrodo Aço Inox" suffix="R$/kg" value={params.preco_eletrodo_inox_kg} onChange={(v) => set("preco_eletrodo_inox_kg", v)} />
                    <NumField label="Eletrodo Aço Carbono" suffix="R$/kg" value={params.preco_eletrodo_carbono_kg} onChange={(v) => set("preco_eletrodo_carbono_kg", v)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* BLOCO 5 */}
              <AccordionItem value="b5" className="border rounded-md px-3">
                <AccordionTrigger className="text-sm font-medium">5. Encargos Fiscais (desoneração ponderada)</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Início do contrato</Label>
                      <Input type="date" value={params.contrato_inicio ?? ""} onChange={(e) => set("contrato_inicio", e.target.value || null)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Fim do contrato</Label>
                      <Input type="date" value={params.contrato_fim ?? ""} onChange={(e) => set("contrato_fim", e.target.value || null)} className="h-9 text-sm" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-foreground mb-2">Alíquotas por ano</p>
                    <div className="space-y-2">
                      {anos.map((ano) => (
                        <div key={ano} className="grid grid-cols-3 gap-3 items-end">
                          <div>
                            <Label className="text-xs text-muted-foreground">Ano</Label>
                            <Input value={ano} disabled className="h-8 text-sm bg-muted" />
                          </div>
                          <NumField label="CPRB" suffix="%" value={params.encargos_por_ano[ano].cprb} onChange={(v) => updateEncargoAno(ano, "cprb", v)} />
                          <NumField label="INSS patronal" suffix="%" value={params.encargos_por_ano[ano].inss} onChange={(v) => updateEncargoAno(ano, "inss", v)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {encargos ? (
                    <Card className="mt-4 p-3 bg-primary/5 border-primary/20">
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">CPRB médio:</span>{" "}
                        <span className="font-mono text-primary">{encargos.cprbMedio.toFixed(2)}%</span>
                        <span className="mx-2 text-muted-foreground">|</span>
                        <span className="font-semibold">INSS médio:</span>{" "}
                        <span className="font-mono text-primary">{encargos.inssMedio.toFixed(2)}%</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Ponderado por {encargos.totalMeses} meses de contrato
                        {" — "}
                        {encargos.detalhamento.map((d) => `${d.ano}: ${d.meses}m`).join(" · ")}
                      </p>
                    </Card>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-3 italic">
                      Informe início e fim do contrato para calcular encargos médios.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Notas */}
              <AccordionItem value="notas" className="border rounded-md px-3">
                <AccordionTrigger className="text-sm font-medium">Observações</AccordionTrigger>
                <AccordionContent>
                  <Textarea
                    value={params.notes ?? ""}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Anotações sobre os parâmetros deste orçamento..."
                    className="text-sm"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        <SheetFooter className="mt-6 flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={handleResetFromDefaults} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Restaurar padrões globais
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveAsDefault} disabled={saveDefaults.isPending} className="gap-1.5">
            {saveDefaults.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar como padrão global
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveProject.isPending} className="gap-1.5">
            {saveProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar parâmetros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ProjectParametersSheet;
