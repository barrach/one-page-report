/**
 * PpcSemanalTable — shared component used in both the Dados page and the
 * Programação Semanal report card.
 *
 * Renders a grid that matches the PPC_SEMANAL.xlsx layout:
 *   - Left column: day names (SEGUNDA … SÁBADO) + TOTAL + PPC
 *   - One pair of columns per imported week: PREVISTO | REALIZADO
 *   - Header: week label (+ period when showPeriodo=true)
 *
 * Layout rules:
 *   - 1 week  + showPeriodo: centered, max-w-[600px], table stretches to fill width,
 *                            data cells at 0.9rem
 *   - 1 week  + !showPeriodo: same compact behaviour as multi-week
 *   - 2+ weeks: full-width scroll with right-side shadow indicator
 *
 * Colour rules:
 *   - REALIZADO < PREVISTO  → red   (#fee2e2 / #dc2626)
 *   - REALIZADO >= PREVISTO → green (#dcfce7 / #16a34a)
 *   - PPC row: big bold text + ✓/✗ icon, green ≥ 80% / red < 80%
 */

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProgramacaoSemanal } from "@/lib/parseProgramacaoSemanal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  /** All imported weeks, sorted by semana number (ascending). */
  data: ProgramacaoSemanal[];
  /**
   * When true (Relatório mode) show the period on a second header line and
   * apply report-specific visual tweaks (hover rows, soft shadow, etc.).
   * When false (Dados mode) use the compact style already in DataInput.
   */
  showPeriodo?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIAS = [
  "SEGUNDA",
  "TERÇA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÁBADO",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt0 = (v: number) => (v === 0 ? "0" : String(Math.round(v)));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PpcSemanalTable({ data, showPeriodo = false }: Props) {
  const sorted = [...data].sort((a, b) => a.semana - b.semana);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasRightScroll, setHasRightScroll] = useState(false);

  // Single-week report mode stretches to fill the card (up to 600 px)
  const singleReport = sorted.length === 1 && showPeriodo;

  useEffect(() => {
    if (singleReport) return; // no scroll needed
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasRightScroll(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check);
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, [sorted.length, singleReport]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma semana importada ainda.
      </p>
    );
  }

  // ---------------------------------------------------------------------------
  // Shared cell classes — slightly larger font in single-week report mode
  // ---------------------------------------------------------------------------
  const dataFont = singleReport ? "text-[0.9rem]" : "text-[11px]";

  const thBase = cn(
    "border border-border px-2 py-1.5 text-center font-bold whitespace-nowrap",
    singleReport ? "text-xs" : "text-[11px]",
  );
  const tdBase = cn(
    "border border-border px-2 py-1 text-center whitespace-nowrap",
    dataFont,
    showPeriodo && "transition-colors",
  );
  const tdLabel = cn(
    "sticky left-0 z-10 bg-card border border-border px-3 py-1.5",
    "font-medium text-left whitespace-nowrap text-foreground",
    singleReport ? "text-sm w-[130px] min-w-[130px]" : "text-[11px] w-[110px] min-w-[110px]",
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tableEl = (
    <table
      className={cn(
        "border-collapse",
        singleReport ? "w-full table-fixed" : "text-xs min-w-max",
      )}
      style={showPeriodo ? { boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : undefined}
    >
      <thead>
        {/* ── Row 1: Sem. X · S1 ──────────────────────────────────────── */}
        <tr>
          <th
            className={cn(
              thBase,
              "bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] text-left",
              singleReport ? "w-[130px]" : undefined,
            )}
          >
            Dia
          </th>
          {sorted.map((w) => (
            <th
              key={w.semana}
              colSpan={2}
              className={cn(thBase, "bg-[#1e3a5f] text-white", !singleReport && "min-w-[80px]")}
            >
              <div>Sem. {w.semana} · {w.semanaDoMes ?? ""}</div>
              {showPeriodo && w.periodo && (
                <div className="font-normal mt-0.5 opacity-70" style={{ fontSize: "0.65rem" }}>
                  {w.periodo}
                </div>
              )}
            </th>
          ))}
        </tr>

        {/* ── Row 2: period (Dados mode only, as separate row) ──────── */}
        {!showPeriodo && (
          <tr>
            <th
              className={cn(
                thBase,
                "bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]",
              )}
            />
            {sorted.map((w) => (
              <th
                key={w.semana}
                colSpan={2}
                className={cn(
                  thBase,
                  "bg-[#2563a8] text-white font-normal text-[10px]",
                )}
              >
                {w.periodo}
              </th>
            ))}
          </tr>
        )}

        {/* ── Row 3: PREVISTO | REALIZADO ───────────────────────────── */}
        <tr>
          <th
            className={cn(
              thBase,
              "bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]",
            )}
          />
          {sorted.map((w) => (
            <>
              <th
                key={`${w.semana}-ph`}
                className={cn(thBase, "bg-muted text-muted-foreground font-semibold", !singleReport && "min-w-[80px]")}
              >
                PREVISTO
              </th>
              <th
                key={`${w.semana}-rh`}
                className={cn(thBase, "bg-muted text-muted-foreground font-semibold", !singleReport && "min-w-[80px]")}
              >
                REALIZADO
              </th>
            </>
          ))}
        </tr>
      </thead>

      <tbody>
        {/* ── Daily rows ────────────────────────────────────────────── */}
        {DIAS.map((dia, di) => (
          <tr
            key={dia}
            className={showPeriodo ? "hover:bg-[#f8fafc] dark:hover:bg-muted/30" : undefined}
          >
            <td className={tdLabel}>{dia}</td>
            {sorted.map((w) => {
              const prev = w.ppc.prev[di] ?? 0;
              const real = w.ppc.real[di] ?? 0;
              const isAbove = prev > 0 && real >= prev;
              const isBelow = prev > 0 && real < prev;
              return (
                <>
                  <td
                    key={`${w.semana}-p-${di}`}
                    className={cn(tdBase, "text-foreground")}
                  >
                    {fmt0(prev)}
                  </td>
                  <td
                    key={`${w.semana}-r-${di}`}
                    className={cn(
                      tdBase,
                      isAbove && "bg-[#dcfce7] text-[#16a34a] font-semibold",
                      isBelow && "bg-[#fee2e2] text-[#dc2626] font-semibold",
                    )}
                  >
                    {fmt0(real)}
                  </td>
                </>
              );
            })}
          </tr>
        ))}

        {/* ── TOTAL row ──────────────────────────────────────────────── */}
        <tr
          className={cn(showPeriodo && "hover:bg-[#f8fafc] dark:hover:bg-muted/30")}
          style={showPeriodo ? { borderTop: "2px solid #e2e8f0" } : undefined}
        >
          <td
            className={cn(
              tdLabel,
              "font-bold text-foreground",
              showPeriodo && "bg-[#f8fafc] dark:bg-muted/20",
            )}
          >
            TOTAL
          </td>
          {sorted.map((w) => {
            const tp = w.ppc.totalPrevisto;
            const tr_ = w.ppc.totalRealizado;
            const isAbove = tp > 0 && tr_ >= tp;
            const isBelow = tp > 0 && tr_ < tp;
            return (
              <>
                <td
                  key={`${w.semana}-tp`}
                  className={cn(
                    tdBase,
                    "font-bold text-foreground",
                    showPeriodo && "bg-[#f8fafc] dark:bg-muted/20",
                  )}
                >
                  {fmt0(tp)}
                </td>
                <td
                  key={`${w.semana}-tr`}
                  className={cn(
                    tdBase,
                    "font-bold",
                    showPeriodo && "bg-[#f8fafc] dark:bg-muted/20",
                    isAbove && "text-[#16a34a]",
                    isBelow && "text-[#dc2626]",
                  )}
                >
                  {fmt0(tr_)}
                </td>
              </>
            );
          })}
        </tr>

        {/* ── PPC row ────────────────────────────────────────────────── */}
        <tr>
          <td className={cn(tdLabel, "font-bold")}>PPC</td>
          {sorted.map((w) => {
            const ppc = w.ppc.ppcSemana > 0
              ? w.ppc.ppcSemana
              : Math.round(w.ppc.totalAdherencia * 100);
            const ok = ppc >= 80;
            return (
              <td
                key={`${w.semana}-ppc`}
                colSpan={2}
                className={cn(
                  tdBase,
                  "font-bold",
                  singleReport ? "text-[1.2rem]" : showPeriodo ? "text-[1.05rem]" : "text-sm",
                  ok
                    ? "bg-[#dcfce7] text-[#16a34a]"
                    : "bg-[#fee2e2] text-[#dc2626]",
                )}
              >
                {ok ? "✓" : "✗"} {Math.round(ppc)}%
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );

  // Single-week report mode: centered, max-w, no scroll needed
  if (singleReport) {
    return (
      <div className="w-full max-w-[600px] mx-auto">
        {tableEl}
      </div>
    );
  }

  // Multi-week (or dados mode): horizontal scroll with shadow
  return (
    <div className="relative">
      {hasRightScroll && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-20"
          style={{
            background: "linear-gradient(to right, transparent, rgba(0,0,0,0.06))",
          }}
        />
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {tableEl}
      </div>
    </div>
  );
}
