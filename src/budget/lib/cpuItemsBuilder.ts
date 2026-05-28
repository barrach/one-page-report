// Constrói a lista padrão de itens da CPU a partir do escopo + custos
// Suporta hierarquia (numero "1.1.1") e linhas-grupo (is_group).

export interface CpuItemDraft {
  id: string;
  numero: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  classe: "service" | "material" | "mob";
  origem?: string;
  is_group?: boolean;          // linha de agrupamento (sem qtde/valor)
  parent_id?: string | null;   // referência local p/ hierarquia
}

interface BuildInput {
  scopeComponents: any[];
  costSummaries: { stage: any; total: number }[];
  serviceCost: number;
  materialCost: number;
  durationMonths: number;
}

export function buildDefaultCpuItems({
  scopeComponents,
  costSummaries,
  serviceCost,
  materialCost,
  durationMonths,
}: BuildInput): CpuItemDraft[] {
  const items: CpuItemDraft[] = [];

  const mobStage = costSummaries.find((s) => s.stage.stage_code === "mobilizacao");
  const canteiroStage = costSummaries.find((s) => s.stage.stage_code === "canteiro");
  const mobTotal = mobStage?.total || 0;
  if (mobTotal > 0) {
    items.push({
      id: "mob-1", numero: "1.1", descricao: "Mobilização",
      quantidade: 1, unidade: "VB", custo_unitario: mobTotal / 2,
      classe: "mob", origem: "Custos → Mobilização",
    });
    items.push({
      id: "mob-2", numero: "1.2", descricao: "Desmobilização",
      quantidade: 1, unidade: "VB", custo_unitario: mobTotal / 2,
      classe: "mob", origem: "Custos → Mobilização",
    });
  }
  if (canteiroStage && canteiroStage.total > 0) {
    items.push({
      id: "mob-3", numero: "1.3", descricao: "Canteiro de Obras",
      quantidade: durationMonths, unidade: "Mês",
      custo_unitario: canteiroStage.total / Math.max(1, durationMonths),
      classe: "mob", origem: "Custos → Canteiro",
    });
  }

  const totalHH = scopeComponents.reduce(
    (s, c) =>
      s +
      (Number(c.hh_total_produtivo) ||
        Number(c.adjusted_hh) ||
        Number(c.calculated_hh) ||
        0),
    0,
  );

  const mobAndCanteiro = (mobStage?.total || 0) + (canteiroStage?.total || 0);
  const servicosRestantes = Math.max(0, serviceCost - mobAndCanteiro);

  scopeComponents.forEach((comp, idx) => {
    const hh =
      Number(comp.hh_total_produtivo) ||
      Number(comp.adjusted_hh) ||
      Number(comp.calculated_hh) ||
      0;
    const qtd = Number(comp.quantity) || 1;
    if (hh <= 0 && qtd <= 0) return;
    const share = totalHH > 0 ? hh / totalHH : 1 / scopeComponents.length;
    const custoLinha = servicosRestantes * share;
    items.push({
      id: `serv-${comp.id}`, numero: `2.${idx + 1}`,
      descricao: String(comp.description || `Serviço ${idx + 1}`),
      quantidade: qtd, unidade: String(comp.unit || "SV"),
      custo_unitario: qtd > 0 ? custoLinha / qtd : custoLinha,
      classe: "service", origem: "Escopo (decomposição técnica)",
    });
  });

  if (materialCost > 0) {
    items.push({
      id: "mat-1", numero: "3.1", descricao: "Material de Consumo e Aplicação",
      quantidade: 1, unidade: "VB", custo_unitario: materialCost,
      classe: "material", origem: "Custos → Materiais",
    });
  }

  return items;
}

// Renumera respeitando hierarquia e classe.
// Itens sem parent_id ficam no nível raiz; com parent_id herdam o número do pai.
export function renumberItems(items: CpuItemDraft[]): CpuItemDraft[] {
  const sectionOf = (c: CpuItemDraft["classe"]) =>
    c === "mob" ? "1" : c === "service" ? "2" : "3";

  // Mantém a ordem atual mas reordena: dentro de uma classe, filhos vão logo após o pai
  const byClass: Record<string, CpuItemDraft[]> = { mob: [], service: [], material: [] };
  items.forEach((it) => byClass[it.classe].push(it));

  const out: CpuItemDraft[] = [];

  (["mob", "service", "material"] as const).forEach((classe) => {
    const list = byClass[classe];
    const roots = list.filter((it) => !it.parent_id);
    const childrenOf = (pid: string) => list.filter((it) => it.parent_id === pid);

    let rootCounter = 0;
    const walk = (item: CpuItemDraft, prefix: string, counter: number) => {
      const n = `${prefix}.${counter}`;
      out.push({ ...item, numero: n });
      const kids = childrenOf(item.id);
      kids.forEach((kid, i) => walk(kid, n, i + 1));
    };
    roots.forEach((root) => {
      rootCounter += 1;
      walk(root, sectionOf(classe), rootCounter);
    });

    // Itens com parent_id inexistente caem como raiz
    const orphans = list.filter(
      (it) => it.parent_id && !list.some((p) => p.id === it.parent_id),
    );
    orphans.forEach((o) => {
      rootCounter += 1;
      walk({ ...o, parent_id: null }, sectionOf(classe), rootCounter);
    });
  });

  return out;
}
