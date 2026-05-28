import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "@budget/components/layout/AppLayout";
import { Button } from "@budget/components/ui/button";
import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Input } from "@budget/components/ui/input";
import { Textarea } from "@budget/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Separator } from "@budget/components/ui/separator";
import { ArrowLeft, Save, FileText, Download } from "lucide-react";
import { useProposal, useUpdateProposal, PROPOSAL_STATUSES, getStatusInfo } from "@budget/hooks/useProposals";
import { generateProposalPdf } from "@budget/lib/generateProposalPdf";
import { formatBRL, formatNumber } from "@budget/lib/format";
import { useToast } from "@budget/hooks/use-toast";

const PropostaDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const { data: proposal, isLoading } = useProposal(id);
  const updateProposal = useUpdateProposal();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, any>>({});

  if (isLoading) return <AppLayout><p className="py-12 text-center text-muted-foreground">Carregando...</p></AppLayout>;
  if (!proposal) return <AppLayout><p className="py-12 text-center text-muted-foreground">Proposta não encontrada</p></AppLayout>;

  const val = (field: string) => edits[field] ?? (proposal as any)[field] ?? "";

  const setField = (field: string, value: any) => setEdits((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) return;
    try {
      await updateProposal.mutateAsync({ id: proposal.id, ...edits });
      setEdits({});
      toast({ title: "Proposta atualizada" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const si = getStatusInfo(proposal.status);

  const field = (label: string, name: string, multiline = false) => (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</label>
      {multiline ? (
        <Textarea className="mt-1" value={val(name)} onChange={(e) => setField(name, e.target.value)} rows={3} />
      ) : (
        <Input className="mt-1" value={val(name)} onChange={(e) => setField(name, e.target.value)} />
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/propostas">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {proposal.proposal_number}
              <Badge variant="outline" className="text-[10px]">R{proposal.revision}</Badge>
              <Badge className={`text-[10px] ${si.color}`}>{si.label}</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">{proposal.client} • {proposal.project_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={val("status")} onValueChange={(v) => setField("status", v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPOSAL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => generateProposalPdf(proposal)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Gerar PDF
          </Button>
          <Button size="sm" onClick={handleSave} disabled={Object.keys(edits).length === 0}>
            <Save className="w-3.5 h-3.5 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: commercial fields */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 bg-card border-border space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Dados Comerciais
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {field("Cliente", "client")}
              {field("Objeto", "object")}
              {field("Responsável", "responsible")}
              {field("Localidade", "location")}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Validade (dias)</label>
                <Input type="number" className="mt-1" value={val("validity_days")} onChange={(e) => setField("validity_days", +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Prazo Execução (dias)</label>
                <Input type="number" className="mt-1" value={val("execution_days")} onChange={(e) => setField("execution_days", +e.target.value)} />
              </div>
            </div>
            {field("Escopo Resumido", "scope_summary", true)}
            {field("Premissas", "premises", true)}
            {field("Exclusões", "exclusions", true)}
            {field("Condições de Pagamento", "payment_conditions", true)}
            {field("Observações sobre Impostos", "tax_notes", true)}
            {field("Observações Comerciais", "commercial_notes", true)}
            {field("Observações Internas", "internal_notes", true)}
            {field("Assinatura / Responsável", "signature")}
          </Card>
        </div>

        {/* Right: frozen values */}
        <div className="space-y-4">
          <Card className="p-5 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Valores Congelados</h3>
            <div className="space-y-3">
              {[
                { label: "Preço de Venda", value: formatBRL(Number(proposal.sale_price)), accent: true },
                { label: "Custo Direto", value: formatBRL(Number(proposal.direct_cost)) },
                { label: "BDI / Indiretos", value: formatBRL(Number(proposal.indirect_cost)) },
                { label: "Impostos", value: formatBRL(Number(proposal.taxes)) },
                { label: "Lucro", value: formatBRL(Number(proposal.profit)) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-mono font-medium ${(r as any).accent ? "text-accent" : "text-foreground"}`}>{r.value}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">HH Total</span>
                <span className="font-mono text-foreground">{formatNumber(Number(proposal.total_hh))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pico Efetivo</span>
                <span className="font-mono text-foreground">{proposal.peak_team} pessoas</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Informações</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Gerada em: {new Date(proposal.generated_at).toLocaleString("pt-BR")}</p>
              <p>Projeto: {proposal.project_name}</p>
              <p>Revisão: R{proposal.revision}</p>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default PropostaDetalhe;
