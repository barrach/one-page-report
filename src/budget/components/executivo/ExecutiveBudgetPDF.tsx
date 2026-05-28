import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ExecutiveBudgetSnapshot } from "@budget/lib/executiveBudgetSnapshot";

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number, d = 0) =>
  (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const COLORS = {
  primary: "#3B82F6",
  accent: "#F59E0B",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  bgSoft: "#F8FAFC",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: COLORS.text, fontFamily: "Helvetica" },
  // Capa
  cover: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  coverBrand: { fontSize: 10, color: COLORS.primary, letterSpacing: 2, marginBottom: 24 },
  coverTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  coverNumber: { fontSize: 14, color: COLORS.muted, marginBottom: 40 },
  coverInfo: { width: "70%", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 20 },
  coverRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  coverLabel: { color: COLORS.muted, fontSize: 9 },
  coverValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  // Sections
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8, color: COLORS.primary },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  small: { fontSize: 8, color: COLORS.muted },
  // KPI grid
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 8 },
  kpiCard: {
    width: "33.33%", padding: 4,
  },
  kpiInner: {
    backgroundColor: COLORS.bgSoft, borderRadius: 4, padding: 8,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  kpiLabel: { fontSize: 7, color: COLORS.muted, marginBottom: 2, textTransform: "uppercase" },
  kpiValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  // Table
  table: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4 },
  thead: { flexDirection: "row", backgroundColor: COLORS.bgSoft, paddingVertical: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.border, paddingVertical: 4 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.muted, paddingHorizontal: 4 },
  td: { fontSize: 9, paddingHorizontal: 4 },
  tdRight: { fontSize: 9, paddingHorizontal: 4, textAlign: "right" },
  // Footer
  footer: {
    position: "absolute", bottom: 16, left: 32, right: 32,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 7, color: COLORS.muted, borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 6,
  },
  // Notes
  notes: { fontSize: 9, lineHeight: 1.5, marginTop: 6 },
});

const Footer = ({ docNumber, version }: { docNumber: string; version: number }) => (
  <View style={styles.footer} fixed>
    <Text>{docNumber} · v{version}</Text>
    <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
  </View>
);

interface Props {
  snapshot: ExecutiveBudgetSnapshot;
  documentNumber: string;
  status: string;
  version: number;
  complementaryNotes?: string | null;
}

export const ExecutiveBudgetPDF = ({ snapshot, documentNumber, status, version, complementaryNotes }: Props) => {
  const i = snapshot.indicators;
  const p = snapshot.project;
  return (
    <Document title={`Orçamento Executivo ${documentNumber}`}>
      {/* CAPA */}
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverBrand}>ORCAINDUSTRIAL</Text>
          <Text style={styles.coverTitle}>Orçamento Executivo</Text>
          <Text style={styles.coverNumber}>{documentNumber}</Text>
          <View style={styles.coverInfo}>
            <View style={styles.coverRow}><Text style={styles.coverLabel}>Cliente</Text><Text style={styles.coverValue}>{p.client || "—"}</Text></View>
            <View style={styles.coverRow}><Text style={styles.coverLabel}>Projeto</Text><Text style={styles.coverValue}>{p.name || "—"}</Text></View>
            <View style={styles.coverRow}><Text style={styles.coverLabel}>Local</Text><Text style={styles.coverValue}>{p.location || "—"}</Text></View>
            <View style={styles.coverRow}><Text style={styles.coverLabel}>Data</Text><Text style={styles.coverValue}>{fmtDate(snapshot.generated_at)}</Text></View>
            <View style={styles.coverRow}><Text style={styles.coverLabel}>Versão</Text><Text style={styles.coverValue}>v{version}</Text></View>
            <View style={styles.coverRow}><Text style={styles.coverLabel}>Status</Text><Text style={[styles.coverValue, { color: COLORS.accent }]}>{status}</Text></View>
          </View>
        </View>
        <Footer docNumber={documentNumber} version={version} />
      </Page>

      {/* SEÇÃO 1 — RESUMO EXECUTIVO */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>1. Resumo Executivo</Text>

        <View style={styles.kpiGrid}>
          <Kpi label="Prazo total" value={`${i.durationMonths} meses`} />
          <Kpi label="Pico de efetivo" value={`${i.peakEffective} pessoas`} sub={`MOI ${i.peakMOI} · MOD ${i.peakMOD}`} />
          <Kpi label="HH total" value={fmtNum(i.totalHH)} sub={`MOD ${fmtNum(i.totalHHMOD)} · MOI ${fmtNum(i.totalHHMOI)}`} />
          <Kpi label="Custo direto" value={fmtBRL(i.directCost)} />
          <Kpi label="Preço de venda" value={fmtBRL(i.salePrice)} />
          <Kpi label="Margem bruta" value={fmtPct(i.grossMargin)} />
          <Kpi label="R$/HH total" value={fmtBRL(i.pricePerHH)} />
          <Kpi label="R$/HH produtivo" value={fmtBRL(i.pricePerProductiveHH)} />
          <Kpi label="HH produtivo" value={fmtNum(i.productiveHH)} />
        </View>

        <Text style={styles.h2}>HH por especialidade</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 3 }]}>Especialidade</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>HH</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>%</Text>
          </View>
          {snapshot.hhBySpecialty.map((row, idx) => (
            <View key={idx} style={styles.tr}>
              <Text style={[styles.td, { flex: 3 }]}>{row.specialty}</Text>
              <Text style={[styles.tdRight, { flex: 1 }]}>{fmtNum(row.hh)}</Text>
              <Text style={[styles.tdRight, { flex: 1 }]}>{fmtPct(row.pct)}</Text>
            </View>
          ))}
          {snapshot.hhBySpecialty.length === 0 && (
            <View style={styles.tr}><Text style={[styles.td, styles.small]}>Sem dados de escopo</Text></View>
          )}
        </View>
        <Footer docNumber={documentNumber} version={version} />
      </Page>

      {/* SEÇÃO 2 — CRONOGRAMA / HISTOGRAMA */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>2. Cronograma e Histograma</Text>
        <Text style={styles.small}>Distribuição mensal de HH e curva S de avanço previsto.</Text>

        <View style={[styles.table, { marginTop: 10 }]}>
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 1 }]}>Mês</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>HH previsto</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Curva S (%)</Text>
          </View>
          {snapshot.monthlyHistogram.map((row, idx) => (
            <View key={idx} style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>{row.month}</Text>
              <Text style={[styles.tdRight, { flex: 2 }]}>{fmtNum(row.hh)}</Text>
              <Text style={[styles.tdRight, { flex: 2 }]}>{fmtPct(row.cumulativePct)}</Text>
            </View>
          ))}
        </View>
        <Footer docNumber={documentNumber} version={version} />
      </Page>

      {/* SEÇÃO 3 — EQUIPE */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>3. Estrutura de Equipe</Text>

        <Text style={styles.h2}>Mão de Obra Indireta (MOI)</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 3 }]}>Função</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Qtde</Text>
            <Text style={[styles.th, { flex: 2 }]}>Período</Text>
          </View>
          {snapshot.team.moi.map((r, idx) => (
            <View key={idx} style={styles.tr}>
              <Text style={[styles.td, { flex: 3 }]}>{r.role}</Text>
              <Text style={[styles.tdRight, { flex: 1 }]}>{r.qty}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{r.period}</Text>
            </View>
          ))}
          {snapshot.team.moi.length === 0 && (
            <View style={styles.tr}><Text style={[styles.td, styles.small]}>Sem MOI registrada</Text></View>
          )}
        </View>

        <Text style={styles.h2}>Mão de Obra Direta (MOD)</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 2 }]}>Especialidade</Text>
            <Text style={[styles.th, { flex: 3 }]}>Função</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Qtde</Text>
            <Text style={[styles.th, { flex: 2 }]}>Período</Text>
          </View>
          {snapshot.team.mod.map((r, idx) => (
            <View key={idx} style={styles.tr}>
              <Text style={[styles.td, { flex: 2 }]}>{r.specialty}</Text>
              <Text style={[styles.td, { flex: 3 }]}>{r.role}</Text>
              <Text style={[styles.tdRight, { flex: 1 }]}>{r.qty}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{r.period}</Text>
            </View>
          ))}
          {snapshot.team.mod.length === 0 && (
            <View style={styles.tr}><Text style={[styles.td, styles.small]}>Sem MOD registrada</Text></View>
          )}
        </View>
        <Footer docNumber={documentNumber} version={version} />
      </Page>

      {/* SEÇÃO 4 — CUSTOS */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>4. Estrutura de Custos</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 4 }]}>Categoria</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>R$</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>%</Text>
          </View>
          {snapshot.costs.map((c, idx) => (
            <View key={idx} style={styles.tr}>
              <Text style={[styles.td, { flex: 4 }]}>{c.category}</Text>
              <Text style={[styles.tdRight, { flex: 2 }]}>{fmtBRL(c.value)}</Text>
              <Text style={[styles.tdRight, { flex: 1 }]}>{fmtPct(c.pct)}</Text>
            </View>
          ))}
          <View style={[styles.tr, { backgroundColor: COLORS.bgSoft }]}>
            <Text style={[styles.td, { flex: 4, fontFamily: "Helvetica-Bold" }]}>CUSTO TOTAL DIRETO</Text>
            <Text style={[styles.tdRight, { flex: 2, fontFamily: "Helvetica-Bold" }]}>{fmtBRL(i.directCost)}</Text>
            <Text style={[styles.tdRight, { flex: 1, fontFamily: "Helvetica-Bold" }]}>100%</Text>
          </View>
        </View>
        <Footer docNumber={documentNumber} version={version} />
      </Page>

      {/* SEÇÃO 5 — COMPOSIÇÃO DO PREÇO */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>5. Composição do Preço</Text>
        <View style={styles.table}>
          <PriceRow label="Custo direto serviços" value={snapshot.pricing.serviceCost} />
          <PriceRow label="Custo direto materiais" value={snapshot.pricing.materialCost} />
          <PriceRow label="Contingências" value={snapshot.pricing.contingencyValue} />
          <PriceRow label="BDI Serviços" value={snapshot.pricing.bdiServiceValue} />
          <PriceRow label="BDI Materiais" value={snapshot.pricing.bdiMaterialValue} />
          <PriceRow label="Impostos sobre serviços" value={snapshot.pricing.taxServiceValue} />
          <PriceRow label="Impostos sobre materiais" value={snapshot.pricing.taxMaterialValue} />
          <PriceRow label="PREÇO DE VENDA" value={snapshot.pricing.salePrice} bold highlight />
          <PriceRow label="Receita líquida" value={snapshot.pricing.netRevenue} />
          <PriceRow label="Lucro operacional" value={snapshot.pricing.profitValue} sub={fmtPct(snapshot.pricing.profitPct)} bold />
        </View>
        <Footer docNumber={documentNumber} version={version} />
      </Page>

      {/* SEÇÃO 6 — DADOS COMPLEMENTARES */}
      {complementaryNotes ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>6. Dados Complementares</Text>
          <Text style={styles.notes}>{complementaryNotes}</Text>
          <Footer docNumber={documentNumber} version={version} />
        </Page>
      ) : null}
    </Document>
  );
};

const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <View style={styles.kpiCard}>
    <View style={styles.kpiInner}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? <Text style={[styles.small, { marginTop: 2 }]}>{sub}</Text> : null}
    </View>
  </View>
);

const PriceRow = ({
  label, value, sub, bold, highlight,
}: { label: string; value: number; sub?: string; bold?: boolean; highlight?: boolean }) => (
  <View style={[styles.tr, highlight ? { backgroundColor: COLORS.bgSoft } : null]}>
    <Text style={[styles.td, { flex: 3 }, bold ? { fontFamily: "Helvetica-Bold" } : null]}>{label}</Text>
    <Text style={[styles.tdRight, { flex: 2 }, bold ? { fontFamily: "Helvetica-Bold" } : null]}>{fmtBRL(value)}</Text>
    <Text style={[styles.tdRight, { flex: 1, color: COLORS.muted }]}>{sub || ""}</Text>
  </View>
);
