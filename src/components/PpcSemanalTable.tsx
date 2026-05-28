/**
 * PpcSemanalTable — shared component used in both the Dados page and the
 * Programação Semanal report card.
 *
 * Renders a grid that matches the PPC_SEMANAL.xlsx layout:
 *   - Left column: day names (SEGUNDA … SÁBADO) + TOTAL + PPC
 *   - One pair of columns per imported week: PREVISTO | REALIZADO
 *   - Header: week label (+ period when showPeriodo=true)
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasRightScroll(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check);
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, [sorted.length]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma semana importada ainda.
      </p>
    );
  }

  // Shared cell classes
  const thBase = cn(
    "border border-border px-2 py-1.5 text-center font-bold text-[11px] whitespace-nowrap",
  );
  const tdBase = cn(
    "border border-border px-2 py-1 text-center text-[11px] whitespace-nowrap",
    showPeriodo && "transition-colors",
  );
  const tdLabel = cn(
    "sticky left-0 z-10 bg-card border border-border px-3 py-1.5",
    "font-medium text-[11px] text-left whitespace-nowrap text-foreground w-[110px] min-w-[110px]",
  );

  return (
    <div className="relative">
      {/* Scroll shadow — visible only when content overflows to the right */}
      {hasRightScroll && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-20"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(0,0,0,0.06))",
          }}
        />
      )}

      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <table
          className="border-collapse text-xs min-w-max"
          style={showPeriodo ? { boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : undefined}
        >
          <thead>
            {/* ── Row 1: Sem. X · S1 ────────────────────────────────── */}
            <tr>
              <th
                className={cn(
                  thBase,
                  "bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))] text-left",
                )}
              >
                Dia
              </th>
              {sorted.map((w) => (
                <th
                  key={w.semana}
                  colSpan={2}
                  className={cn(thBase, "bg-[#1e3a5f] text-white min-w-[80px]")}
                >
                  <div>Sem. {w.semana} · {w.semanaDoMes ?? ""}</div>
                  {showPeriodo && w.periodo && (
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">
                      {w.periodo}
                    </div>
                  )}
                </th>
              ))}
            </tr>

            {/* ── Row 2: period (Dados mode only, as separate row) ───── */}
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

            {/* ── Row 3: PREVISTO | REALIZADO ───────────────────────── */}
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
                    className={cn(thBase, "bg-muted text-muted-foreground font-semibold min-w-[80px]")}
                  >
                    PREVISTO
                  </th>
                  <th
                    key={`${w.semana}-rh`}
                    className={cn(thBase, "bg-muted text-muted-foreground font-semibold min-w-[80px]")}
                  >
                    REALIZADO
                  </th>
                </>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── Daily rows ──────────────────────────────────────────── */}
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
                          isAbove &&
                            "bg-[#dcfce7] text-[#16a34a] font-semibold",
                          isBelow &&
                            "bg-[#fee2e2] text-[#dc2626] font-semibold",
                        )}
                      >
                        {fmt0(real)}
                      </td>
                    </>
                  );
                })}
              </tr>
            ))}

            {/* ── TOTAL row ───────────────────────────────────────────── */}
            <tr
              className={cn(
                showPeriodo && "hover:bg-[#f8fafc] dark:hover:bg-muted/30",
              )}
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

            {/* ── PPC row ─────────────────────────────────────────────── */}
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
                      showPeriodo ? "text-[1.05rem]" : "text-sm",
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
      </div>
    </div>
  );
}
