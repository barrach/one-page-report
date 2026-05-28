import { useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import {
  FileText, AlertTriangle, HelpCircle, Lightbulb, Shield, Users,
  Package, Truck, Wrench, CheckCircle, Clock, ChevronDown, ChevronRight,
  BookOpen, Target, MessageSquare, Zap, Calculator
} from "lucide-react";

interface AnalysisData {
  resumo?: {
    objeto?: string;
    tipoServico?: string;
    contexto?: string;
    complexidade?: string;
    disciplinaPredominante?: string;
    observacoes?: string;
  };
  decomposicao?: {
    atividadesPrincipais?: { titulo: string; descricao: string; disciplina?: string; prioridade?: string }[];
    atividadesAuxiliares?: { titulo: string; descricao: string }[];
    preRequisitos?: { titulo: string; descricao: string }[];
    materiaisNecessarios?: { titulo: string; unidade?: string; observacao?: string }[];
    recursosHumanos?: { funcao: string; quantidade_estimada?: string; observacao?: string }[];
    equipamentos?: { titulo: string; tipo?: string; observacao?: string }[];
    servicosTerceirizados?: { titulo: string; justificativa?: string }[];
    riscosContingencias?: { titulo: string; impacto?: string; mitigacao?: string }[];
  };
  lacunas?: { item: string; tipo?: string; impacto?: string }[];
  premissasSugeridas?: { premissa: string; justificativa?: string }[];
  exclusoesRecomendadas?: { exclusao: string; motivo?: string }[];
  perguntasCliente?: { pergunta: string; motivo?: string; prioridade?: string }[];
  alertas?: { tipo?: string; descricao: string; severidade?: string }[];
  sugestoesBiblioteca?: { item: string; disciplina?: string; tipo?: string; confianca?: string }[];
  estimativaGeral?: { prazoEstimado?: string; equipeEstimada?: string; complexidadeGeral?: string };
  classificacaoDisciplinas?: { disciplina: string; escopoInterpretado?: string; impactoOrcamento?: string; confianca?: string }[];
  itensOrcados?: { disciplina?: string; item: string; quantidadeSugerida?: string; unidade?: string; baseEstimativa?: string; bibliotecaReferencia?: string; confianca?: string }[];
  maoDeObraSugerida?: { disciplina?: string; funcao: string; hhEstimado?: string; baseProdutividade?: string; justificativa?: string; confianca?: string }[];
  materiaisSugeridos?: { disciplina?: string; material: string; quantidade?: string; baseReferencia?: string; observacao?: string }[];
  equipamentosSugeridos?: { equipamento: string; usoPrevisto?: string; periodoEstimado?: string; justificativa?: string }[];
  comparativoPropostaHumana?: { tipo?: string; item: string; leituraIA?: string; baseComparacao?: string; acaoSugerida?: string; severidade?: string }[];
  confiancaAnalise?: { nivel?: string; justificativa?: string };
  pontosRevisaoManual?: { ponto: string; motivo?: string; prioridade?: string }[];
}

interface Props {
  analysis: AnalysisData;
  createdAt?: string;
  onClose?: () => void;
}

function SectionHeader({ icon: Icon, title, count, defaultOpen = false, children }: {
  icon: any; title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px]">{count}</Badge>
        )}
      </button>
      {open && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

const severityColor = (s?: string) => {
  if (s === "alta" || s === "alto") return "text-red-400 bg-red-500/10 border-red-500/20";
  if (s === "média" || s === "médio") return "text-accent bg-accent/10 border-accent/20";
  return "text-green-400 bg-green-500/10 border-green-500/20";
};

const complexityLabel = (c?: string) => {
  const map: Record<string, string> = { baixa: "Baixa", média: "Média", alta: "Alta", muito_alta: "Muito Alta" };
  return map[c || ""] || c || "N/A";
};

export default function ScopeAnalysisPanel({ analysis, createdAt, onClose }: Props) {
  const r = analysis.resumo;
  const d = analysis.decomposicao;

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Análise Técnica do Escopo</h3>
            <Badge variant="outline" className="text-[10px]">IA</Badge>
          </div>
          {createdAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(createdAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {r && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card/50 rounded-md p-3 border border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Objeto</p>
              <p className="text-xs text-foreground">{r.objeto || "N/A"}</p>
            </div>
            <div className="bg-card/50 rounded-md p-3 border border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tipo de Serviço</p>
              <p className="text-xs text-foreground">{r.tipoServico || "N/A"}</p>
            </div>
            <div className="bg-card/50 rounded-md p-3 border border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Complexidade</p>
              <Badge className={`text-[10px] ${severityColor(r.complexidade)}`}>{complexityLabel(r.complexidade)}</Badge>
            </div>
            {r.disciplinaPredominante && (
              <div className="bg-card/50 rounded-md p-3 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Disciplina</p>
                <p className="text-xs text-foreground">{r.disciplinaPredominante}</p>
              </div>
            )}
            {r.contexto && (
              <div className="bg-card/50 rounded-md p-3 border border-border md:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Contexto</p>
                <p className="text-xs text-foreground">{r.contexto}</p>
              </div>
            )}
          </div>
        )}

        {analysis.estimativaGeral && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-border">
            {analysis.estimativaGeral.prazoEstimado && (
              <div className="text-xs"><span className="text-muted-foreground">Prazo: </span><span className="text-foreground font-medium">{analysis.estimativaGeral.prazoEstimado}</span></div>
            )}
            {analysis.estimativaGeral.equipeEstimada && (
              <div className="text-xs"><span className="text-muted-foreground">Equipe: </span><span className="text-foreground font-medium">{analysis.estimativaGeral.equipeEstimada}</span></div>
            )}
          </div>
        )}

        {analysis.confiancaAnalise && (
          <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-xs">
            <Target className="w-3.5 h-3.5 text-primary mt-0.5" />
            <div>
              <span className="text-muted-foreground">Confiança da análise: </span>
              <Badge className={`text-[10px] ${severityColor(analysis.confiancaAnalise.nivel === "alta" ? "baixa" : analysis.confiancaAnalise.nivel === "baixa" ? "alta" : "média")}`}>{analysis.confiancaAnalise.nivel || "N/A"}</Badge>
              {analysis.confiancaAnalise.justificativa && <p className="text-muted-foreground mt-1">{analysis.confiancaAnalise.justificativa}</p>}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-2">
          {analysis.classificacaoDisciplinas && analysis.classificacaoDisciplinas.length > 0 && (
            <SectionHeader icon={FileText} title="Classificação por Disciplina" count={analysis.classificacaoDisciplinas.length} defaultOpen>
              {analysis.classificacaoDisciplinas.map((d, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{d.disciplina}</p>
                    {d.impactoOrcamento && <Badge className={`text-[9px] ${severityColor(d.impactoOrcamento)}`}>{d.impactoOrcamento}</Badge>}
                    {d.confianca && <Badge variant="outline" className="text-[9px]">conf. {d.confianca}</Badge>}
                  </div>
                  {d.escopoInterpretado && <p className="text-[11px] text-muted-foreground mt-0.5">{d.escopoInterpretado}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {analysis.itensOrcados && analysis.itensOrcados.length > 0 && (
            <SectionHeader icon={Calculator} title="Base Orçamentária Sugerida" count={analysis.itensOrcados.length} defaultOpen>
              {analysis.itensOrcados.map((item, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium text-foreground">{item.item}</p>
                    {item.disciplina && <Badge variant="outline" className="text-[9px]">{item.disciplina}</Badge>}
                    {item.quantidadeSugerida && <Badge variant="secondary" className="text-[9px]">{item.quantidadeSugerida} {item.unidade || ""}</Badge>}
                    {item.confianca && <Badge variant="outline" className="text-[9px]">conf. {item.confianca}</Badge>}
                  </div>
                  {item.baseEstimativa && <p className="text-[11px] text-muted-foreground mt-0.5">Base: {item.baseEstimativa}</p>}
                  {item.bibliotecaReferencia && <p className="text-[11px] text-primary mt-0.5">Biblioteca: {item.bibliotecaReferencia}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Decomposição */}
          {d?.atividadesPrincipais && d.atividadesPrincipais.length > 0 && (
            <SectionHeader icon={Wrench} title="Atividades Principais" count={d.atividadesPrincipais.length} defaultOpen>
              {d.atividadesPrincipais.map((a, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-muted/10 rounded-md border border-border">
                  <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground">{a.titulo}</p>
                      {a.prioridade && <Badge className={`text-[9px] ${severityColor(a.prioridade)}`}>{a.prioridade}</Badge>}
                      {a.disciplina && <Badge variant="outline" className="text-[9px]">{a.disciplina}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.descricao}</p>
                  </div>
                </div>
              ))}
            </SectionHeader>
          )}

          {d?.atividadesAuxiliares && d.atividadesAuxiliares.length > 0 && (
            <SectionHeader icon={CheckCircle} title="Atividades Auxiliares" count={d.atividadesAuxiliares.length}>
              {d.atividadesAuxiliares.map((a, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border">
                  <p className="text-xs font-medium text-foreground">{a.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">{a.descricao}</p>
                </div>
              ))}
            </SectionHeader>
          )}

          {d?.materiaisNecessarios && d.materiaisNecessarios.length > 0 && (
            <SectionHeader icon={Package} title="Materiais Necessários" count={d.materiaisNecessarios.length}>
              {d.materiaisNecessarios.map((m, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <span className="text-foreground font-medium">{m.titulo}</span>
                  {m.unidade && <Badge variant="outline" className="text-[9px]">{m.unidade}</Badge>}
                  {m.observacao && <span className="text-muted-foreground">— {m.observacao}</span>}
                </div>
              ))}
            </SectionHeader>
          )}

          {analysis.materiaisSugeridos && analysis.materiaisSugeridos.length > 0 && (
            <SectionHeader icon={Package} title="Materiais Sugeridos" count={analysis.materiaisSugeridos.length}>
              {analysis.materiaisSugeridos.map((m, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-medium">{m.material}</span>
                    {m.disciplina && <Badge variant="outline" className="text-[9px]">{m.disciplina}</Badge>}
                    {m.quantidade && <Badge variant="secondary" className="text-[9px]">{m.quantidade}</Badge>}
                  </div>
                  {m.baseReferencia && <p className="text-[11px] text-primary mt-0.5">Base: {m.baseReferencia}</p>}
                  {m.observacao && <p className="text-[11px] text-muted-foreground mt-0.5">{m.observacao}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {d?.recursosHumanos && d.recursosHumanos.length > 0 && (
            <SectionHeader icon={Users} title="Recursos Humanos" count={d.recursosHumanos.length}>
              {d.recursosHumanos.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <span className="text-foreground font-medium">{r.funcao}</span>
                  {r.quantidade_estimada && <Badge variant="secondary" className="text-[9px]">~{r.quantidade_estimada}</Badge>}
                  {r.observacao && <span className="text-muted-foreground">— {r.observacao}</span>}
                </div>
              ))}
            </SectionHeader>
          )}

          {analysis.maoDeObraSugerida && analysis.maoDeObraSugerida.length > 0 && (
            <SectionHeader icon={Users} title="Mão de Obra Sugerida" count={analysis.maoDeObraSugerida.length}>
              {analysis.maoDeObraSugerida.map((m, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-medium">{m.funcao}</span>
                    {m.disciplina && <Badge variant="outline" className="text-[9px]">{m.disciplina}</Badge>}
                    {m.hhEstimado && <Badge variant="secondary" className="text-[9px]">{m.hhEstimado} HH</Badge>}
                    {m.confianca && <Badge variant="outline" className="text-[9px]">conf. {m.confianca}</Badge>}
                  </div>
                  {m.baseProdutividade && <p className="text-[11px] text-primary mt-0.5">Produtividade: {m.baseProdutividade}</p>}
                  {m.justificativa && <p className="text-[11px] text-muted-foreground mt-0.5">{m.justificativa}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {d?.equipamentos && d.equipamentos.length > 0 && (
            <SectionHeader icon={Truck} title="Equipamentos" count={d.equipamentos.length}>
              {d.equipamentos.map((e, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <span className="text-foreground font-medium">{e.titulo}</span>
                  {e.tipo && <span className="text-muted-foreground ml-2">({e.tipo})</span>}
                  {e.observacao && <p className="text-muted-foreground text-[11px] mt-0.5">{e.observacao}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {analysis.equipamentosSugeridos && analysis.equipamentosSugeridos.length > 0 && (
            <SectionHeader icon={Truck} title="Equipamentos Sugeridos" count={analysis.equipamentosSugeridos.length}>
              {analysis.equipamentosSugeridos.map((e, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-medium">{e.equipamento}</span>
                    {e.periodoEstimado && <Badge variant="secondary" className="text-[9px]">{e.periodoEstimado}</Badge>}
                  </div>
                  {e.usoPrevisto && <p className="text-[11px] text-muted-foreground mt-0.5">Uso: {e.usoPrevisto}</p>}
                  {e.justificativa && <p className="text-[11px] text-muted-foreground mt-0.5">{e.justificativa}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {d?.riscosContingencias && d.riscosContingencias.length > 0 && (
            <SectionHeader icon={Shield} title="Riscos e Contingências" count={d.riscosContingencias.length}>
              {d.riscosContingencias.map((r, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{r.titulo}</p>
                    {r.impacto && <Badge className={`text-[9px] ${severityColor(r.impacto)}`}>{r.impacto}</Badge>}
                  </div>
                  {r.mitigacao && <p className="text-[11px] text-muted-foreground mt-0.5">Mitigação: {r.mitigacao}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Lacunas */}
          {analysis.lacunas && analysis.lacunas.length > 0 && (
            <SectionHeader icon={AlertTriangle} title="Lacunas Identificadas" count={analysis.lacunas.length}>
              {analysis.lacunas.map((l, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-accent/5 rounded-md border border-accent/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-foreground">{l.item}</p>
                      {l.tipo && <Badge variant="outline" className="text-[9px]">{l.tipo}</Badge>}
                    </div>
                    {l.impacto && <p className="text-[11px] text-muted-foreground mt-0.5">{l.impacto}</p>}
                  </div>
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Premissas */}
          {analysis.premissasSugeridas && analysis.premissasSugeridas.length > 0 && (
            <SectionHeader icon={Lightbulb} title="Premissas Sugeridas" count={analysis.premissasSugeridas.length}>
              {analysis.premissasSugeridas.map((p, i) => (
                <div key={i} className="p-2 bg-muted/10 rounded-md border border-border">
                  <p className="text-xs text-foreground">{p.premissa}</p>
                  {p.justificativa && <p className="text-[11px] text-muted-foreground mt-0.5">{p.justificativa}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Exclusões */}
          {analysis.exclusoesRecomendadas && analysis.exclusoesRecomendadas.length > 0 && (
            <SectionHeader icon={AlertTriangle} title="Exclusões Recomendadas" count={analysis.exclusoesRecomendadas.length}>
              {analysis.exclusoesRecomendadas.map((e, i) => (
                <div key={i} className="p-2 bg-accent/5 rounded-md border border-accent/20">
                  <p className="text-xs text-foreground">{e.exclusao}</p>
                  {e.motivo && <p className="text-[11px] text-muted-foreground mt-0.5">{e.motivo}</p>}
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Perguntas */}
          {analysis.perguntasCliente && analysis.perguntasCliente.length > 0 && (
            <SectionHeader icon={MessageSquare} title="Perguntas ao Cliente" count={analysis.perguntasCliente.length}>
              {analysis.perguntasCliente.map((p, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                  <HelpCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-foreground">{p.pergunta}</p>
                      {p.prioridade && <Badge className={`text-[9px] ${severityColor(p.prioridade)}`}>{p.prioridade}</Badge>}
                    </div>
                    {p.motivo && <p className="text-[11px] text-muted-foreground mt-0.5">{p.motivo}</p>}
                  </div>
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Alertas */}
          {analysis.alertas && analysis.alertas.length > 0 && (
            <SectionHeader icon={Shield} title="Alertas Técnicos" count={analysis.alertas.length}>
              {analysis.alertas.map((a, i) => (
                <div key={i} className={`p-2 rounded-md border ${severityColor(a.severidade)}`}>
                  <div className="flex items-center gap-2">
                    {a.tipo && <Badge variant="outline" className="text-[9px]">{a.tipo}</Badge>}
                    {a.severidade && <Badge className={`text-[9px] ${severityColor(a.severidade)}`}>{a.severidade}</Badge>}
                  </div>
                  <p className="text-xs text-foreground mt-1">{a.descricao}</p>
                </div>
              ))}
            </SectionHeader>
          )}

          {/* Sugestões de biblioteca */}
          {analysis.sugestoesBiblioteca && analysis.sugestoesBiblioteca.length > 0 && (
            <SectionHeader icon={BookOpen} title="Sugestões da Biblioteca Técnica" count={analysis.sugestoesBiblioteca.length}>
              {analysis.sugestoesBiblioteca.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/10 rounded-md border border-border text-xs">
                  <Target className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-foreground font-medium">{s.item}</span>
                  {s.disciplina && <Badge variant="outline" className="text-[9px]">{s.disciplina}</Badge>}
                  {s.tipo && <Badge variant="secondary" className="text-[9px]">{s.tipo}</Badge>}
                  {s.confianca && <Badge className={`text-[9px] ${severityColor(s.confianca === "alta" ? "baixa" : s.confianca === "baixa" ? "alta" : "média")}`}>{s.confianca}</Badge>}
                </div>
              ))}
            </SectionHeader>
          )}

          {analysis.pontosRevisaoManual && analysis.pontosRevisaoManual.length > 0 && (
            <SectionHeader icon={HelpCircle} title="Pontos para Revisão Manual" count={analysis.pontosRevisaoManual.length} defaultOpen>
              {analysis.pontosRevisaoManual.map((p, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-accent/5 rounded-md border border-accent/20">
                  <HelpCircle className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-foreground">{p.ponto}</p>
                      {p.prioridade && <Badge className={`text-[9px] ${severityColor(p.prioridade)}`}>{p.prioridade}</Badge>}
                    </div>
                    {p.motivo && <p className="text-[11px] text-muted-foreground mt-0.5">{p.motivo}</p>}
                  </div>
                </div>
              ))}
            </SectionHeader>
          )}
      </div>
    </div>
  );
}
