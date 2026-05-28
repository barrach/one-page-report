import {
  LayoutDashboard,
  ClipboardList,
  Activity,
  Users,
  Calendar,
  Package,
  PieChart,
  BarChart3,
  Grid3x3,
  Building2,
  Settings,
  FileSpreadsheet,
  Database,
  Layers,
  Compass,
  ClipboardEdit,
} from "lucide-react";

export type SectionKey =
  // Como Usar (fluxo guiado)
  | "como-usar"
  // Visão Geral
  | "dashboard"
  | "resumo"
  | "consolidacao"
  // Entrada Mensal (apenas a planilha mensal real)
  | "real"
  // Medição Mensal — receita real do contrato
  | "medicao"
  // Bases Estruturais (sobem 1x ou raramente, populam o banco)
  | "drg-import"
  | "resumo-import"
  | "template-budget"
  // Por Contrato — hub único com tabs internas (Baseline, Produção, Pessoal, etc)
  | "contract-hub"
  // Consolidação multi-contrato
  | "drg-todos"
  // Cadastros
  | "cost-centers"
  | "regras";

export type SectionScope = "company" | "contract" | "structural" | "monthly" | "config";

export interface NavItem {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /** Whether the section uses the competence-month filter */
  usesMonthFilter?: boolean;
  /** Whether this section requires a contract to be selected */
  requiresContract?: boolean;
  /** Visual scope for the breadcrumb / banner */
  scope: SectionScope;
  /** Only visible to admin users */
  adminOnly?: boolean;
  /** Hide from the sidebar nav (still routable / used as a header) */
  hiddenInNav?: boolean;
}

export interface NavGroup {
  label: string;
  /** Optional short hint shown under the group label */
  hint?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Início",
    hint: "Comece por aqui",
    items: [
      {
        key: "como-usar",
        label: "Como Usar",
        icon: Compass,
        description:
          "Fluxo guiado de 7 passos para operar a Controladoria: configurar contratos, importar bases, subir o mês e revisar resumos.",
        scope: "company",
      },
    ],
  },
  {
    label: "Visão Geral",
    hint: "Empresa consolidada",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Indicadores executivos consolidados de todos os contratos",
        usesMonthFilter: true,
        scope: "company",
      },
      {
        key: "resumo",
        label: "Resumo Executivo",
        icon: ClipboardList,
        description: "Quadro DRG previsto x realizado consolidado da empresa",
        usesMonthFilter: true,
        scope: "company",
      },
      {
        key: "consolidacao",
        label: "Consolidação",
        icon: Grid3x3,
        description: "Comparativo lado a lado de todos os contratos ativos",
        usesMonthFilter: true,
        scope: "company",
      },
    ],
  },
  {
    label: "Entrada Mensal",
    hint: "Sobe todo mês — alimenta o realizado",
    items: [
      {
        key: "real",
        label: "Custos Mensais",
        icon: Calendar,
        description:
          "ÚNICA planilha que entra todo mês. O sistema lê 'Descrição do C. de Custos' e distribui cada despesa ao contrato correto. Lançamentos podem ser editados manualmente após a importação.",
        usesMonthFilter: false,
        scope: "monthly",
      },
      {
        key: "medicao",
        label: "Medição Mensal",
        icon: ClipboardEdit,
        description:
          "O gestor lança a receita real medida no mês para cada contrato (valor único + observação). O sistema compara com o baseline e os custos realizados, mostrando margem real x prevista.",
        usesMonthFilter: true,
        requiresContract: true,
        scope: "contract",
      },
    ],
  },
  {
    label: "Bases Estruturais",
    hint: "Sobe 1x ou raramente — popula o banco",
    items: [
      {
        key: "drg-import",
        label: "DRG Workbook (Megasteam)",
        icon: Database,
        description:
          "Base operacional mensal (Resultado Megasteam · Competência). Alimenta internamente Produção, Pessoal, Imobilizado, DRG analítico e DRG · Todos C.C. Importe quando receber um novo workbook DRG.",
        scope: "structural",
        hiddenInNav: true,
      },
      {
        key: "resumo-import",
        label: "Resumo do Resultado",
        icon: FileSpreadsheet,
        description:
          "Visão derivada gerada pelo sistema (Previsto x Realizado por contrato). Reservado para administradores que precisem reimportar a planilha como fallback — o caminho normal é gerar pelo Resumo Executivo.",
        scope: "structural",
        adminOnly: true,
        hiddenInNav: true,
      },
      {
        key: "template-budget",
        label: "Template UNIPAR",
        icon: Layers,
        description:
          "Estrutura padrão UNIPAR replicável a todos os contratos (Budget, DRG, Resumo). Modelo de orçamento consolidado — não é importação mensal.",
        scope: "structural",
        hiddenInNav: true,
      },
    ],
  },
  {
    label: "Por Contrato",
    hint: "Hub de controladoria de um único contrato",
    items: [
      {
        key: "contract-hub",
        label: "Área do Contrato",
        icon: ClipboardList,
        description:
          "Índice de todos os contratos em cards. Clique em um card para abrir o hub completo (Baseline, Produção, Pessoal, Imobilizado, Rateio Admin, DRG Mensal, DRG Analítico e Resumo). Operacionais e entidades de empresa ficam separados.",
        usesMonthFilter: true,
        requiresContract: true,
        scope: "contract",
      },
    ],
  },
  {
    label: "Comparativos",
    hint: "Multi-contrato lado a lado",
    items: [
      {
        key: "drg-todos",
        label: "DRG · Todos C.C",
        icon: Grid3x3,
        description:
          "Matriz técnica DRG por centro de custo. Alimentada automaticamente por toda importação mensal ou DRG. Acessível via link direto — fora da navegação principal para não poluir.",
        usesMonthFilter: true,
        scope: "company",
        hiddenInNav: true,
      },
    ],
  },
  {
    label: "Cadastros",
    hint: "Configuração e regras do sistema",
    items: [
      {
        key: "cost-centers",
        label: "Centros de Custo",
        icon: Building2,
        description: "Cadastro e configuração de centros de custo",
        scope: "config",
        adminOnly: true,
      },
      {
        key: "regras",
        label: "Regras",
        icon: Settings,
        description: "Regras de categorização e parâmetros do sistema",
        scope: "config",
        adminOnly: true,
      },
    ],
  },
];

export const ALL_SECTIONS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const getSectionMeta = (key: SectionKey): NavItem | undefined => {
  return ALL_SECTIONS.find((s) => s.key === key);
};

export const getGroupLabel = (key: SectionKey): string => {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.key === key))?.label ?? "";
};

export const SCOPE_LABELS: Record<SectionScope, string> = {
  company: "Empresa",
  contract: "Por Contrato",
  structural: "Base Estrutural",
  monthly: "Entrada Mensal",
  config: "Cadastro",
};
