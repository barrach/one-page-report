import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Switch } from "@budget/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Badge } from "@budget/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import {
  useFinancialCategories, useCreateCategory, useDeleteCategory,
  useCategoryRules, useCreateRule, useDeleteRule,
  useSeedFinancialDefaults,
} from "@budget/hooks/useFinancial";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Skeleton } from "@budget/components/ui/skeleton";

const DRG_GROUP_ORDER = [
  "(+) Receita Bruta de Vendas",
  "(+) Receitas Financeiras",
  "(+) Outras Receitas",
  "(-) Impostos",
  "(-) Despesas com Pessoal",
  "(-) Custo dos Serviços Prestados",
  "(-) Outros Custos",
  "(-) Despesas Administrativas",
  "(-) Despesas Financeiras",
  "(-) Ativos",
];

const FinanceiroRegras = () => {
  const { data: categories, isLoading: lc } = useFinancialCategories();
  const { data: rules, isLoading: lr } = useCategoryRules();
  const createCat = useCreateCategory();
  const deleteCat = useDeleteCategory();
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();
  const seedDefaults = useSeedFinancialDefaults();

  const [newCat, setNewCat] = useState({ code: "", name: "", kind: "cost", cost_class: "DIRETO", is_excluded_default: false });
  const [newRule, setNewRule] = useState({ rule_type: "managerial_code", match_value: "", category_id: "", mark_as_excluded: false, priority: 100 });

  type Category = NonNullable<typeof categories>[number];

  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>();
    (categories ?? []).forEach((c) => {
      const key = (c as Category & { drg_group?: string | null }).drg_group ?? "Sem grupo DRG";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    // Sort by predefined DRG order
    const sorted: [string, Category[]][] = [];
    DRG_GROUP_ORDER.forEach((g) => { if (map.has(g)) { sorted.push([g, map.get(g)!]); map.delete(g); } });
    Array.from(map.entries()).forEach((e) => sorted.push(e));
    return sorted;
  }, [categories]);

  const hasMegasteamSeed = (categories?.length ?? 0) > 0 && categories?.some((c) => (c as Category & { drg_group?: string | null }).drg_group);

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Plano de contas Megasteam (DRG)</p>
              <p className="text-xs text-muted-foreground">
                Carrega 65 categorias estruturadas pelo DRG real (Receita → Impostos → Pessoal → Custos → Despesas) com regras automáticas de classificação.
              </p>
            </div>
          </div>
          <Button
            onClick={() => seedDefaults.mutate()}
            disabled={seedDefaults.isPending || hasMegasteamSeed}
            variant={hasMegasteamSeed ? "secondary" : "default"}
          >
            {hasMegasteamSeed ? "Já carregado" : "Carregar plano de contas"}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Plano de Contas (DRG)</TabsTrigger>
          <TabsTrigger value="rules">Regras de Categorização</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova categoria</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-1">
                <Label className="text-xs">Código</Label>
                <Input placeholder="3.50" value={newCat.code} onChange={(e) => setNewCat({ ...newCat, code: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Nome</Label>
                <Input placeholder="Aluguéis e Condomínios" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newCat.kind} onValueChange={(v) => setNewCat({ ...newCat, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="cost">Custo</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="tax">Imposto</SelectItem>
                    <SelectItem value="asset">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Classe</Label>
                <Select value={newCat.cost_class} onValueChange={(v) => setNewCat({ ...newCat, cost_class: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEITA">Receita</SelectItem>
                    <SelectItem value="DIRETO">Direto</SelectItem>
                    <SelectItem value="INDIRETO">Indireto</SelectItem>
                    <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                    <SelectItem value="PESSOAL">Pessoal</SelectItem>
                    <SelectItem value="IMPOSTO">Imposto</SelectItem>
                    <SelectItem value="FINANCEIRA">Financeira</SelectItem>
                    <SelectItem value="IMOBILIZADO">Imobilizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={() => createCat.mutate(newCat, { onSuccess: () => setNewCat({ code: "", name: "", kind: "cost", cost_class: "DIRETO", is_excluded_default: false }) })}
                  disabled={!newCat.code || !newCat.name || createCat.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </div>
              <div className="md:col-span-6 flex items-center gap-2">
                <Switch checked={newCat.is_excluded_default} onCheckedChange={(v) => setNewCat({ ...newCat, is_excluded_default: v })} />
                <Label className="text-xs">Excluir desta análise por padrão (folha, impostos, benefícios, frota...)</Label>
              </div>
            </CardContent>
          </Card>

          {lc ? <Skeleton className="h-32" /> : (!categories || categories.length === 0) ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma categoria. Use o botão "Carregar plano de contas" acima ou crie manualmente.
            </CardContent></Card>
          ) : (
            grouped.map(([group, list]) => (
              <Card key={group}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {group}
                    <Badge variant="outline" className="text-xs">{list.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="w-28">Tipo</TableHead>
                          <TableHead className="w-32">Classe</TableHead>
                          <TableHead className="w-28">Excluída?</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.code}</TableCell>
                            <TableCell className="font-medium text-sm">{c.name}</TableCell>
                            <TableCell className="text-xs uppercase text-muted-foreground">{c.kind}</TableCell>
                            <TableCell className="text-xs uppercase text-muted-foreground">{c.cost_class}</TableCell>
                            <TableCell>{c.is_excluded_default && <Badge variant="secondary" className="text-xs">Excluída</Badge>}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteCat.mutate(c.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova regra</CardTitle>
              <p className="text-xs text-muted-foreground">
                Regras são aplicadas por prioridade (menor = primeiro). Use para mapear códigos gerenciais, fornecedores, CNPJs, ou descrições a categorias.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <div>
                <Label className="text-xs">Tipo de regra</Label>
                <Select value={newRule.rule_type} onValueChange={(v) => setNewRule({ ...newRule, rule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="managerial_code">Código gerencial</SelectItem>
                    <SelectItem value="supplier_keyword">Palavra no fornecedor</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="cost_center">Centro de custo</SelectItem>
                    <SelectItem value="description_keyword">Palavra na descrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Valor (match)</Label>
                <Input placeholder="4319 ou TELEFONICA" value={newRule.match_value} onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Categoria</Label>
                <Select value={newRule.category_id} onValueChange={(v) => setNewRule({ ...newRule, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Input type="number" value={newRule.priority} onChange={(e) => setNewRule({ ...newRule, priority: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-6 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.mark_as_excluded} onCheckedChange={(v) => setNewRule({ ...newRule, mark_as_excluded: v })} />
                  <Label className="text-xs">Marcar lançamentos correspondentes como EXCLUÍDOS da análise</Label>
                </div>
                <Button
                  className="ml-auto"
                  onClick={() => createRule.mutate(
                    { ...newRule, category_id: newRule.category_id || undefined },
                    { onSuccess: () => setNewRule({ rule_type: "managerial_code", match_value: "", category_id: "", mark_as_excluded: false, priority: 100 }) }
                  )}
                  disabled={!newRule.match_value || createRule.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" /> Adicionar regra
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Regras configuradas ({rules?.length ?? 0})</CardTitle></CardHeader>
            <CardContent>
              {lr ? <Skeleton className="h-32" /> : (!rules || rules.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma regra cadastrada.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prio</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Excluir?</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((r) => {
                        const cat = (r as { financial_categories?: { name?: string; code?: string } }).financial_categories;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs font-mono">{r.priority}</TableCell>
                            <TableCell className="text-xs">{r.rule_type}</TableCell>
                            <TableCell className="font-medium">{r.match_value}</TableCell>
                            <TableCell className="text-xs">{cat ? `${cat.code} — ${cat.name}` : "—"}</TableCell>
                            <TableCell>{r.mark_as_excluded && <Badge variant="secondary" className="text-xs">Excluir</Badge>}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate(r.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceiroRegras;
