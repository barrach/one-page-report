import { useEffect, useMemo } from "react";
import {
  Building2,
  Briefcase,
  Calendar as CalendarIcon,
  Database,
  FileSpreadsheet,
  Settings as SettingsIcon,
  ChevronRight,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@budget/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import { Badge } from "@budget/components/ui/badge";
import {
  useFinancialContracts,
  useCompanyEntities,
  COMPANY_ENTITY_LABELS,
  type FinancialContract,
  type CompanyEntity,
} from "@budget/hooks/useFinancialContracts";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import type { SectionScope } from "./workspaceNav";
import { cn } from "@budget/lib/utils";

interface WorkspaceHeaderProps {
  groupLabel: string;
  sectionLabel: string;
  sectionDescription: string;
  /** The section uses competence-month filter (default: true) */
  showMonthFilter?: boolean;
  /** The section is scoped by contract (default: false). When true, view=contract is forced. */
  showContractSelector?: boolean;
  /** Visual scope of the current section (drives the badge color/label) */
  scope?: SectionScope;
}

// Generate last 24 months starting from current month
const buildMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  now.setDate(1);
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = format(d, "yyyy-MM-dd");
    const label = format(d, "MMM/yy", { locale: ptBR });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
};

const SCOPE_META: Record<
  SectionScope,
  { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  company: {
    label: "Empresa",
    cls: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    Icon: Building2,
  },
  contract: {
    label: "Contrato",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    Icon: Briefcase,
  },
  structural: {
    label: "Base Estrutural",
    cls: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    Icon: Database,
  },
  monthly: {
    label: "Entrada Mensal",
    cls: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    Icon: FileSpreadsheet,
  },
  config: {
    label: "Cadastro",
    cls: "bg-slate-500/10 text-slate-700 border-slate-500/20",
    Icon: SettingsIcon,
  },
};

const WorkspaceHeader = ({
  groupLabel,
  sectionLabel,
  sectionDescription,
  showMonthFilter = true,
  showContractSelector = false,
  scope = "company",
}: WorkspaceHeaderProps) => {
  const {
    view,
    setView,
    contractId,
    setContractId,
    companyEntityId,
    setCompanyEntityId,
    competenceMonth,
    setCompetenceMonth,
  } = useFinancialWorkspace();

  // Listas separadas: contratos operacionais e entidades de empresa
  const { data: contracts } = useFinancialContracts({ onlyActive: false });
  const { data: companyEntities } = useCompanyEntities();

  const monthOptions = useMemo(buildMonthOptions, []);

  const groupedContracts = useMemo(() => {
    const map: Record<string, FinancialContract[]> = {};
    (contracts ?? []).forEach((c) => {
      const key = c.dept_group ?? "Outros";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [contracts]);

  const activeContract = useMemo(
    () => (contracts ?? []).find((c) => c.id === contractId) ?? null,
    [contracts, contractId],
  );

  const activeCompany = useMemo<CompanyEntity | null>(
    () => (companyEntities ?? []).find((c) => c.id === companyEntityId) ?? null,
    [companyEntities, companyEntityId],
  );

  // Seções de contrato sempre forçam view=contract; seções de empresa permitem alternar.
  const effectiveView: WorkspaceView = showContractSelector ? "contract" : view;
  const hideScopeControls = scope === "structural" || scope === "config" || scope === "monthly";
  const showContractDropdown = effectiveView === "contract" && !hideScopeControls;
  const showCompanyDropdown =
    !showContractSelector && effectiveView === "company" && !hideScopeControls;

  // Auto-seleciona uma entidade de empresa padrão quando entrar no escopo Empresa
  useEffect(() => {
    if (!showCompanyDropdown) return;
    if (companyEntityId) return;
    const list = companyEntities ?? [];
    if (list.length === 0) return;
    const preferred =
      list.find((c) => c.entity_kind === "consolidado") ??
      list.find((c) => c.entity_kind === "megasteam") ??
      list[0];
    if (preferred) setCompanyEntityId(preferred.id);
  }, [showCompanyDropdown, companyEntityId, companyEntities, setCompanyEntityId]);

  const scopeMeta = SCOPE_META[scope];
  const ScopeIcon = scopeMeta.Icon;

  const competenceLabel = useMemo(() => {
    try {
      const d = new Date(`${competenceMonth}T00:00:00`);
      const label = format(d, "MMM/yy", { locale: ptBR });
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return competenceMonth;
    }
  }, [competenceMonth]);

  const showCompetenceCrumb = (showMonthFilter ?? false) && !hideScopeControls;
  const showContractCrumb = showContractDropdown && activeContract;
  const showCompanyCrumb = showCompanyDropdown && activeCompany;

  return (
    <div className="border-b bg-background shadow-sm">
      <div className="px-4 lg:px-6 py-2 space-y-1.5">
        {/* Breadcrumb — sempre inequívoco: Empresa > Objeto OU Contrato > Código */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap min-w-0"
        >
          <span className="font-medium">Financeiro</span>

          {/* Escopo explícito */}
          {(showCompanyDropdown || showContractDropdown) && (
            <>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="font-semibold text-foreground">
                {showContractDropdown ? "Contrato" : "Empresa"}
              </span>
            </>
          )}

          {/* Objeto dentro do escopo */}
          {showCompanyCrumb && activeCompany && (
            <>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="text-foreground">
                {COMPANY_ENTITY_LABELS[activeCompany.entity_kind]}
              </span>
            </>
          )}
          {showContractCrumb && activeContract && (
            <>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="font-mono text-foreground">{activeContract.dept_code ?? "—"}</span>
              <span className="truncate max-w-[160px] lg:max-w-[220px] text-foreground">
                · {activeContract.project_name}
              </span>
            </>
          )}

          {groupLabel && (
            <>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span>{groupLabel}</span>
            </>
          )}
          {showCompetenceCrumb && (
            <>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="text-foreground">{competenceLabel}</span>
            </>
          )}
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span className="font-semibold text-foreground">{sectionLabel}</span>
          <Badge
            variant="outline"
            className={cn("ml-1 h-5 px-1.5 text-[10px] gap-1 font-medium", scopeMeta.cls)}
          >
            <ScopeIcon className="h-2.5 w-2.5" />
            {scopeMeta.label}
          </Badge>
        </nav>

        {sectionDescription && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">
            {sectionDescription}
          </p>
        )}

        {/* Filter bar — escopo + objeto + competência */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5 min-w-0">
          {/* Camada 1: ESCOPO (Empresa | Contrato) */}
          {!showContractSelector && !hideScopeControls && (
            <Tabs value={view} onValueChange={(v) => setView(v as WorkspaceView)}>
              <TabsList className="h-8 shrink-0">
                <TabsTrigger value="company" className="gap-1.5 text-xs h-6 px-2.5">
                  <Building2 className="h-3 w-3" />
                  Empresa
                </TabsTrigger>
                <TabsTrigger value="contract" className="gap-1.5 text-xs h-6 px-2.5">
                  <Briefcase className="h-3 w-3" />
                  Contrato
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Camada 2a: OBJETO DA EMPRESA (Megasteam / Administrativo / Consolidado) */}
          {showCompanyDropdown && (
            <Select
              value={companyEntityId ?? ""}
              onValueChange={(v) => setCompanyEntityId(v || null)}
            >
              <SelectTrigger className="h-8 min-w-[220px] w-full sm:w-[260px] max-w-full text-xs">
                <Layers className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecione a empresa..." />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase tracking-wider">
                    Entidades de Empresa
                  </SelectLabel>
                  {(companyEntities ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      <span className="font-mono text-muted-foreground mr-2">
                        {c.dept_code ?? "—"}
                      </span>
                      {COMPANY_ENTITY_LABELS[c.entity_kind]}
                    </SelectItem>
                  ))}
                  {(companyEntities ?? []).length === 0 && (
                    <SelectItem value="__none__" disabled className="text-xs">
                      Nenhuma entidade de empresa cadastrada
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Camada 2b: OBJETO DO CONTRATO (lista de DRGs operacionais — sem entidades de empresa) */}
          {showContractDropdown && (
            <Select value={contractId ?? ""} onValueChange={(v) => setContractId(v || null)}>
              <SelectTrigger className="h-8 min-w-[220px] w-full sm:w-[280px] max-w-full text-xs">
                <Briefcase className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecione um contrato..." />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {Object.entries(groupedContracts).map(([group, items]) => (
                  <SelectGroup key={group}>
                    <SelectLabel className="text-[10px] uppercase tracking-wider">
                      {group}
                    </SelectLabel>
                    {items.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <span className="font-mono text-muted-foreground mr-2">
                          {c.dept_code ?? "—"}
                        </span>
                        {c.project_name}
                        {c.client && (
                          <span className="text-muted-foreground"> · {c.client}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Competence month */}
          {showMonthFilter && (
            <Select value={competenceMonth} onValueChange={(v) => setCompetenceMonth(v)}>
              <SelectTrigger className="h-8 w-full sm:w-[150px] sm:ml-auto text-xs shrink-0">
                <CalendarIcon className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceHeader;

// Local re-export to avoid a separate import for the type-narrowed view value
type WorkspaceView = "company" | "contract";
