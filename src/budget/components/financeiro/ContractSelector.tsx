import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Label } from "@budget/components/ui/label";
import { Building2 } from "lucide-react";
import { useFinancialContracts, type FinancialContract } from "@budget/hooks/useFinancialContracts";

interface ContractSelectorProps {
  value: string;
  onChange: (value: string) => void;
  /** Permite criar contrato novo a partir do próprio cadastro da planilha */
  allowCreateNew?: boolean;
  createNewLabel?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Filtra apenas contratos ativos (status != inactive) */
  onlyActive?: boolean;
}

const NEW_VALUE = "__new__";

const ContractSelector = ({
  value,
  onChange,
  allowCreateNew = false,
  createNewLabel = "Criar novo contrato",
  label = "Contrato",
  required = true,
  disabled,
  onlyActive = true,
}: ContractSelectorProps) => {
  const { data: contracts, isLoading } = useFinancialContracts({ onlyActive });

  const grouped = ((contracts ?? []) as FinancialContract[]).reduce<Record<string, FinancialContract[]>>(
    (acc, c) => {
      const group = c.is_cost_center ? c.dept_group ?? "Centros de custo" : "Orçamentos";
      (acc[group] ||= []).push(c);
      return acc;
    },
    {},
  );

  const isInvalid = required && !value;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
        <Building2 className="w-3.5 h-3.5" />
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger className={isInvalid ? "border-destructive/60" : ""}>
          <SelectValue placeholder={isLoading ? "Carregando contratos..." : "Selecione o contrato"} />
        </SelectTrigger>
        <SelectContent className="max-h-[420px]">
          {allowCreateNew && (
            <SelectGroup>
              <SelectItem value={NEW_VALUE}>{createNewLabel}</SelectItem>
            </SelectGroup>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <SelectGroup key={group}>
              <SelectLabel className="text-[10px] uppercase tracking-wider">{group}</SelectLabel>
              {items.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.dept_code && (
                      <span className="font-mono text-xs text-muted-foreground">{c.dept_code}</span>
                    )}
                    <span>{c.project_name}</span>
                    {c.client && <span className="text-muted-foreground">• {c.client}</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {isInvalid && (
        <p className="text-[11px] text-destructive">
          Selecione um contrato antes de importar a planilha.
        </p>
      )}
    </div>
  );
};

export default ContractSelector;
export { NEW_VALUE as CONTRACT_NEW_VALUE };
