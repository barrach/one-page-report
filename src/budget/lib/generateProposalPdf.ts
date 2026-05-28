import jsPDF from "jspdf";
import type { Proposal } from "@budget/hooks/useProposals";

const MARGIN_LEFT = 25;
const MARGIN_RIGHT = 25;
const MARGIN_TOP = 30;
const MARGIN_BOTTOM = 30;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COLORS = {
  primary: [15, 23, 41] as [number, number, number],       // #0F1729
  accent: [59, 130, 246] as [number, number, number],      // #3B82F6
  orange: [245, 158, 11] as [number, number, number],      // #F59E0B
  text: [30, 30, 30] as [number, number, number],
  muted: [100, 100, 110] as [number, number, number],
  light: [230, 232, 236] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [248, 249, 251] as [number, number, number],
};

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

class PdfBuilder {
  private doc: jsPDF;
  private y = MARGIN_TOP;
  private pageNum = 0;

  constructor() {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.pageNum = 1;
  }

  private ensureSpace(needed: number) {
    if (this.y + needed > 297 - MARGIN_BOTTOM) {
      this.newPage();
    }
  }

  private newPage() {
    this.doc.addPage();
    this.pageNum++;
    this.y = MARGIN_TOP;
  }

  private addFooter() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.muted);
      this.doc.text(`Página ${i} de ${total}`, PAGE_WIDTH / 2, 290, { align: "center" });
      // thin line
      this.doc.setDrawColor(...COLORS.light);
      this.doc.setLineWidth(0.3);
      this.doc.line(MARGIN_LEFT, 285, PAGE_WIDTH - MARGIN_RIGHT, 285);
    }
  }

  // ── COVER ──────────────────────────────────────────────
  private renderCover(p: Proposal) {
    const doc = this.doc;

    // Background header block
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, PAGE_WIDTH, 120, "F");

    // Accent bar
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 120, PAGE_WIDTH, 4, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...COLORS.white);
    doc.text("PROPOSTA COMERCIAL", PAGE_WIDTH / 2, 55, { align: "center" });

    // Proposal number
    doc.setFontSize(14);
    doc.setTextColor(180, 200, 255);
    doc.text(p.proposal_number || "---", PAGE_WIDTH / 2, 70, { align: "center" });

    // Revision badge
    doc.setFontSize(10);
    doc.text(`Revisão ${p.revision}`, PAGE_WIDTH / 2, 80, { align: "center" });

    // Client block
    let cy = 145;
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("CLIENTE", MARGIN_LEFT, cy);
    cy += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.text);
    doc.text(p.client || "---", MARGIN_LEFT, cy);

    cy += 14;
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("ORÇAMENTO", MARGIN_LEFT, cy);
    cy += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.text);
    doc.text(p.project_name || "---", MARGIN_LEFT, cy);

    // Right column info
    const rx = PAGE_WIDTH - MARGIN_RIGHT;
    cy = 145;
    const infoItems = [
      ["Data", formatDate(p.generated_at)],
      ["Localidade", p.location || "---"],
      ["Validade", p.validity_days ? `${p.validity_days} dias` : "30 dias"],
    ];
    for (const [label, value] of infoItems) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      doc.text(label.toUpperCase(), rx, cy, { align: "right" });
      cy += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.text);
      doc.text(value, rx, cy, { align: "right" });
      cy += 10;
    }

    // Bottom accent line
    doc.setFillColor(...COLORS.accent);
    doc.rect(MARGIN_LEFT, 260, CONTENT_WIDTH, 0.5, "F");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("Documento gerado pelo MegaBudget", PAGE_WIDTH / 2, 270, { align: "center" });
  }

  // ── SECTION HELPERS ────────────────────────────────────
  private sectionTitle(num: string, title: string) {
    this.ensureSpace(20);
    const doc = this.doc;

    // Accent bar
    doc.setFillColor(...COLORS.accent);
    doc.rect(MARGIN_LEFT, this.y - 1, 3, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.primary);
    doc.text(`${num}. ${title.toUpperCase()}`, MARGIN_LEFT + 7, this.y + 5);
    this.y += 14;

    // Separator line
    doc.setDrawColor(...COLORS.light);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, this.y - 3, PAGE_WIDTH - MARGIN_RIGHT, this.y - 3);
  }

  private paragraph(text: string) {
    if (!text) return;
    const doc = this.doc;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 7);
    for (const line of lines) {
      this.ensureSpace(6);
      doc.text(line, MARGIN_LEFT + 7, this.y);
      this.y += 5;
    }
    this.y += 3;
  }

  private bulletList(items: string[]) {
    const doc = this.doc;
    for (const item of items) {
      if (!item.trim()) continue;
      this.ensureSpace(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.accent);
      doc.text("●", MARGIN_LEFT + 7, this.y);
      doc.setTextColor(...COLORS.text);
      const lines = doc.splitTextToSize(item.trim(), CONTENT_WIDTH - 18);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) this.ensureSpace(5);
        doc.text(lines[i], MARGIN_LEFT + 14, this.y);
        this.y += 5;
      }
    }
    this.y += 3;
  }

  // ── FINANCIAL TABLE ────────────────────────────────────
  private renderFinancialTable(p: Proposal) {
    const doc = this.doc;
    this.ensureSpace(90);

    const rows = [
      { label: "Custo Direto", value: formatBRL(Number(p.direct_cost)), highlight: false },
      { label: "Custos Indiretos (BDI)", value: formatBRL(Number(p.indirect_cost)), highlight: false },
      { label: "Impostos", value: formatBRL(Number(p.taxes)), highlight: false },
      { label: "Lucro", value: formatBRL(Number(p.profit)), highlight: false },
    ];

    const tableX = MARGIN_LEFT + 10;
    const tableW = CONTENT_WIDTH - 20;
    const rowH = 10;

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(tableX, this.y, tableW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.white);
    doc.text("COMPONENTE", tableX + 5, this.y + 7);
    doc.text("VALOR (R$)", tableX + tableW - 5, this.y + 7, { align: "right" });
    this.y += rowH;

    // Rows
    for (let i = 0; i < rows.length; i++) {
      const bg = i % 2 === 0 ? COLORS.bg : COLORS.white;
      doc.setFillColor(...bg);
      doc.rect(tableX, this.y, tableW, rowH, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.text);
      doc.text(rows[i].label, tableX + 5, this.y + 7);
      doc.setFont("helvetica", "bold");
      doc.text(rows[i].value, tableX + tableW - 5, this.y + 7, { align: "right" });
      this.y += rowH;
    }

    // Total row
    doc.setFillColor(...COLORS.accent);
    doc.rect(tableX, this.y, tableW, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.text("PREÇO DE VENDA", tableX + 5, this.y + 8);
    doc.text(formatBRL(Number(p.sale_price)), tableX + tableW - 5, this.y + 8, { align: "right" });
    this.y += 18;

    // HH info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    const hh = Number(p.total_hh);
    const pricehh = hh > 0 ? formatBRL(Number(p.sale_price) / hh) : "---";
    doc.text(`HH Total: ${hh.toLocaleString("pt-BR")}   |   Pico: ${p.peak_team} pessoas   |   R$/HH: ${pricehh}`, MARGIN_LEFT + 10, this.y);
    this.y += 10;
  }

  // ── TOTAL HIGHLIGHT ────────────────────────────────────
  private renderTotalHighlight(p: Proposal) {
    this.ensureSpace(40);
    const doc = this.doc;
    const boxX = MARGIN_LEFT + 5;
    const boxW = CONTENT_WIDTH - 10;

    // Box with border
    doc.setFillColor(240, 247, 255);
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(0.8);
    doc.roundedRect(boxX, this.y, boxW, 30, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.text("VALOR TOTAL DA PROPOSTA", boxX + boxW / 2, this.y + 10, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.accent);
    doc.text(formatBRL(Number(p.sale_price)), boxX + boxW / 2, this.y + 23, { align: "center" });
    this.y += 38;
  }

  // ── SIGNATURE ──────────────────────────────────────────
  private renderSignature(p: Proposal) {
    this.ensureSpace(50);
    const doc = this.doc;
    const cx = PAGE_WIDTH / 2;

    this.y += 20;
    doc.setDrawColor(...COLORS.text);
    doc.setLineWidth(0.3);
    doc.line(cx - 40, this.y, cx + 40, this.y);
    this.y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.text(p.responsible || p.signature || "Responsável Técnico", cx, this.y, { align: "center" });
    this.y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(p.location ? `${p.location}, ${formatDate(p.generated_at)}` : formatDate(p.generated_at), cx, this.y, { align: "center" });
  }

  // ── MAIN BUILD ─────────────────────────────────────────
  build(p: Proposal): jsPDF {
    // Page 1: Cover
    this.renderCover(p);

    // Page 2: Apresentação
    this.newPage();
    this.sectionTitle("1", "Apresentação");
    this.paragraph(
      p.commercial_notes ||
        "Apresentamos a seguir nossa proposta comercial para os serviços descritos, " +
          "com base nas melhores práticas de engenharia industrial e nos dados técnicos do orçamento."
    );

    // 2. Objeto
    this.sectionTitle("2", "Objeto da Proposta");
    this.paragraph(p.object || "Prestação de serviços de engenharia e montagem industrial conforme escopo detalhado a seguir.");

    // 3. Escopo
    this.sectionTitle("3", "Escopo dos Serviços");
    if (p.scope_summary) {
      const items = p.scope_summary.split("\n").filter(Boolean);
      if (items.length > 1) {
        this.bulletList(items);
      } else {
        this.paragraph(p.scope_summary);
      }
    } else {
      this.paragraph("Conforme especificações técnicas do orçamento.");
    }

    // 4. Premissas
    this.sectionTitle("4", "Premissas");
    if (p.premises) {
      const items = p.premises.split("\n").filter(Boolean);
      this.bulletList(items);
    } else {
      this.paragraph("Premissas padrão conforme contrato.");
    }

    // 5. Exclusões — nova página
    this.newPage();
    this.sectionTitle("5", "Exclusões");
    if (p.exclusions) {
      const items = p.exclusions.split("\n").filter(Boolean);
      this.bulletList(items);
    } else {
      this.paragraph("Itens não contemplados nesta proposta devem ser acordados separadamente.");
    }

    // 6. Prazo
    this.sectionTitle("6", "Prazo de Execução");
    this.paragraph(
      p.execution_days
        ? `O prazo estimado para execução dos serviços é de ${p.execution_days} dias corridos, a partir da emissão da ordem de serviço.`
        : "Prazo a ser definido conforme cronograma do orçamento."
    );

    // 7. Condições Comerciais
    this.sectionTitle("7", "Condições Comerciais");
    this.paragraph(p.payment_conditions || "Condições de pagamento conforme contrato.");
    if (p.tax_notes) {
      this.y += 2;
      this.paragraph(`Observações fiscais: ${p.tax_notes}`);
    }

    // 8. Resumo Financeiro — nova página
    this.newPage();
    this.sectionTitle("8", "Resumo Financeiro");
    this.renderFinancialTable(p);

    // 9. Valor Total
    this.sectionTitle("9", "Valor Total da Proposta");
    this.renderTotalHighlight(p);

    // 10. Validade
    this.sectionTitle("10", "Validade da Proposta");
    this.paragraph(
      `Esta proposta tem validade de ${p.validity_days || 30} dias a partir da data de emissão.`
    );

    // 11. Observações Finais
    if (p.internal_notes) {
      this.sectionTitle("11", "Observações Finais");
      this.paragraph(p.internal_notes);
    }

    // 12. Assinatura
    this.sectionTitle("12", "Assinatura");
    this.renderSignature(p);

    // Footer on all pages
    this.addFooter();

    return this.doc;
  }
}

export function generateProposalPdf(proposal: Proposal): void {
  const builder = new PdfBuilder();
  const doc = builder.build(proposal);
  doc.save(`${proposal.proposal_number || "proposta"}_R${proposal.revision}.pdf`);
}
