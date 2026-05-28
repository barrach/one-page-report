import { useState } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { FileText, Search, Eye } from "lucide-react";
import { useProposals, PROPOSAL_STATUSES, getStatusInfo } from "@budget/hooks/useProposals";
import { formatBRL, formatNumber } from "@budget/lib/format";
import { Link } from "react-router-dom";

const Propostas = () => {
  const { data: proposals = [], isLoading } = useProposals();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = proposals.filter((p) => {
    const matchSearch =
      !search ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.proposal_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.location || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Propostas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Documentos comerciais gerados a partir dos orçamentos</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, orçamento, proposta..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {PROPOSAL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma proposta encontrada</h3>
          <p className="text-sm text-muted-foreground">
            Propostas são geradas a partir da aba "Preço Final" de um orçamento.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const si = getStatusInfo(p.status);
            return (
              <Card key={p.id} className="p-3 sm:p-4 bg-card border-border hover:border-primary/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground text-sm">{p.proposal_number}</span>
                      <Badge variant="outline" className="text-[10px]">R{p.revision}</Badge>
                      <Badge className={`text-[10px] ${si.color}`}>{si.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{p.client}</span>
                      {p.project_name && <span className="hidden sm:inline">Orçamento: {p.project_name}</span>}
                      {p.location && <span>{p.location}</span>}
                      <span>{new Date(p.generated_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-accent">{formatBRL(Number(p.sale_price))}</p>
                      <p className="text-[10px] text-muted-foreground">{formatNumber(Number(p.total_hh))} HH</p>
                    </div>
                    <Link to={`/proposta/${p.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Propostas;
