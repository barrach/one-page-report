// ============================================================
// EditableCell — célula tipo Excel
// ------------------------------------------------------------
//   • Clique (ou duplo-clique / Enter) para editar
//   • Enter ou Tab salva (chama onCommit somente se mudou)
//   • Esc cancela e descarta o rascunho
//   • Aceita formato BR ("1.234,56") ou puro ("1234.56")
//   • Display formatado em BRL; "0" vira traço discreto
//
// Usado nas planilhas:
//   - Budget         (PlannedSpreadsheet)
//   - Budget_Acomp   (ContractBudgetAcomp)
// ============================================================

import { useEffect, useRef, useState } from "react";
import { cn } from "@budget/lib/utils";
import { formatBRL } from "@budget/lib/format";

const parseBR = (raw: string): number => {
  if (!raw) return 0;
  let s = raw.trim().replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    // formato BR: pontos = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

interface EditableCellProps {
  value: number;
  onCommit: (v: number) => void | Promise<void>;
  /** texto atenuado (usado para colunas "Previsto") */
  muted?: boolean;
  /** destaca célula com fundo amarelo (ex.: edição pendente) */
  dirty?: boolean;
  /** desabilita totalmente a edição (somente leitura) */
  disabled?: boolean;
  /** classes extras aplicadas ao botão de display */
  className?: string;
}

export const EditableCell = ({
  value,
  onCommit,
  muted = false,
  dirty = false,
  disabled = false,
  className,
}: EditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const start = () => {
    if (disabled) return;
    setDraft(value === 0 ? "" : String(value).replace(".", ","));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseBR(draft);
    setEditing(false);
    if (parsed !== value) {
      void onCommit(parsed);
    }
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="w-full h-7 px-1 text-right text-[11px] tabular-nums bg-background border border-primary rounded-sm outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      onDoubleClick={start}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          start();
        }
      }}
      disabled={disabled}
      className={cn(
        "w-full h-7 px-1 text-right tabular-nums rounded-sm transition-colors",
        !disabled && "hover:bg-primary/5 hover:ring-1 hover:ring-primary/30 cursor-cell",
        muted ? "text-muted-foreground" : "font-medium",
        dirty && "bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-400/40",
        className,
      )}
      title={disabled ? undefined : "Clique para editar (Enter salva, Esc cancela)"}
    >
      {value === 0 ? (
        <span className="text-muted-foreground/40">—</span>
      ) : (
        formatBRL(value)
      )}
    </button>
  );
};

export default EditableCell;
