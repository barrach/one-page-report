import { useState, useEffect, useCallback } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import CompositionManager from "@budget/components/composicao/CompositionManager";
import { Tabs, TabsList, TabsTrigger } from "@budget/components/ui/tabs";
import { Input } from "@budget/components/ui/input";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@budget/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Search, Gauge, Users, Calculator, Hammer, Truck, Shield, Database, Plus, Pencil, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, Layers } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "@budget/hooks/useAuth";

const ADMIN_EMAIL = "michel.zabalia@megasteam.com.br";

type LibraryKind = "productivity" | "salary" | "charge" | "material" | "index" | "equipment" | "risk" | "other";

interface LibraryItem {
  id: string;
  kind: LibraryKind;
  discipline: string | null;
  group_name: string | null;
  item_type: string | null;
  operation: string | null;
  material: string | null;
  unit: string | null;
  index_label: string | null;
  index_value: number | null;
  source_workbook_name: string | null;
  source_sheet_name: string | null;
  source_label: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const PAGE_SIZE = 50;

const kindTabs: { value: LibraryKind; label: string; icon: React.ElementType }[] = [
  { value: "productivity", label: "Produtividade", icon: Gauge },
  { value: "index", label: "Índices", icon: Database },
  { value: "salary", label: "Salários", icon: Users },
  { value: "material", label: "Materiais", icon: Hammer },
  { value: "other", label: "Composições", icon: Layers },
  { value: "charge", label: "Encargos", icon: Calculator },
  { value: "equipment", label: "Equipamentos", icon: Truck },
  { value: "risk", label: "Riscos", icon: Shield },
];

const Biblioteca = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [activeKind, setActiveKind] = useState<LibraryKind>("productivity");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    discipline: "", group_name: "", item_type: "", operation: "", material: "",
    unit: "", index_label: "", index_value: 0, notes: "",
  });

  const [kindCounts, setKindCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadCounts = async () => {
      const libraryKinds: LibraryKind[] = ["productivity", "salary", "charge", "material", "index", "equipment", "risk"];
      const [libraryResults, compositionsCount] = await Promise.all([
        Promise.all(
          libraryKinds.map(k =>
            supabase
              .from("technical_library_items")
              .select("*", { count: "exact", head: true })
              .eq("kind", k)
              .then(({ count }) => [k, count ?? 0] as const)
          )
        ),
        supabase
          .from("compositions")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .then(({ count }) => count ?? 0),
      ]);
      const counts: Record<string, number> = {};
      for (const [k, c] of libraryResults) counts[k] = c;
      counts["other"] = compositionsCount;
      setKindCounts(counts);
    };
    loadCounts();
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      const [discRes, grpRes, srcRes] = await Promise.all([
        supabase.from("technical_library_items").select("discipline").eq("kind", activeKind).not("discipline", "eq", "").limit(1000),
        supabase.from("technical_library_items").select("group_name").eq("kind", activeKind).not("group_name", "eq", "").limit(1000),
        supabase.from("technical_library_items").select("source_workbook_name").eq("kind", activeKind).not("source_workbook_name", "eq", "").limit(1000),
      ]);

      if (discRes.data) {
        setDisciplines([...new Set(discRes.data.map(d => d.discipline).filter(Boolean) as string[])].sort());
      }
      if (grpRes.data) {
        setGroups([...new Set(grpRes.data.map(d => d.group_name).filter(Boolean) as string[])].sort());
      }
      if (srcRes.data) {
        setSources([...new Set(srcRes.data.map(d => d.source_workbook_name).filter(Boolean) as string[])].sort());
      }
    };
    loadFilters();
    setFilterDiscipline("all");
    setFilterGroup("all");
    setFilterSource("all");
    setPage(0);
  }, [activeKind]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("technical_library_items")
      .select("*", { count: "exact" })
      .eq("kind", activeKind)
      .eq("is_active", true)
      .order("discipline", { ascending: true })
      .order("group_name", { ascending: true })
      .order("item_type", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(
        `discipline.ilike.%${search}%,group_name.ilike.%${search}%,item_type.ilike.%${search}%,operation.ilike.%${search}%,material.ilike.%${search}%,notes.ilike.%${search}%,index_label.ilike.%${search}%,source_sheet_name.ilike.%${search}%`
      );
    }
    if (filterDiscipline !== "all") query = query.eq("discipline", filterDiscipline);
    if (filterGroup !== "all") query = query.eq("group_name", filterGroup);
    if (filterSource !== "all") query = query.eq("source_workbook_name", filterSource);

    const { data, count, error } = await query;
    if (!error && data) {
      setItems(data as LibraryItem[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [activeKind, page, search, filterDiscipline, filterGroup, filterSource]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { setPage(0); }, [search, filterDiscipline, filterGroup, filterSource, activeKind]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const totalRecords = Object.values(kindCounts).reduce((a, b) => a + b, 0);

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const { error } = await supabase
      .from("technical_library_items")
      .update({
        discipline: editItem.discipline,
        group_name: editItem.group_name,
        item_type: editItem.item_type,
        operation: editItem.operation,
        material: editItem.material,
        unit: editItem.unit,
        index_label: editItem.index_label,
        index_value: editItem.index_value,
        notes: editItem.notes,
      })
      .eq("id", editItem.id);
    if (!error) { setEditItem(null); setSelectedItem(null); loadItems(); }
  };

  const handleAdd = async () => {
    const { error } = await supabase
      .from("technical_library_items")
      .insert({
        kind: activeKind,
        ...newItem,
        index_value: newItem.index_value || null,
        raw_data: {},
      });
    if (!error) {
      setAddDialogOpen(false);
      setNewItem({ discipline: "", group_name: "", item_type: "", operation: "", material: "", unit: "", index_label: "", index_value: 0, notes: "" });
      loadItems();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Biblioteca Técnica</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">&nbsp;</p>
        </div>
        {isAdmin && (
          <Button className="gap-2 w-full sm:w-auto" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Novo Item
          </Button>
        )}
      </div>

      <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as LibraryKind)}>
        <TabsList className="bg-muted mb-4 flex-wrap h-auto gap-1 p-1 overflow-x-auto">
          {kindTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 data-[state=active]:bg-card text-[11px] sm:text-sm whitespace-nowrap px-2 sm:px-3">
              <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.slice(0, 4)}</span>
              <Badge variant="secondary" className="ml-0.5 text-[9px] sm:text-xs">{(kindCounts[t.value] || 0).toLocaleString()}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <div>
          {/* Compositions tab - special handling */}
          {activeKind === "other" && (
            <CompositionManager />
          )}

          {activeKind !== "other" && <>
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por disciplina, grupo, tipo, material, aba..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas disciplinas</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fontes</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results table */}
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Disciplina</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Grupo</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Tipo / Descrição</th>
                    {activeKind !== "index" && activeKind !== "material" && (
                      <th className="text-left p-3 font-medium text-muted-foreground">Operação</th>
                    )}
                    {activeKind !== "index" && activeKind !== "productivity" && activeKind !== "equipment" && (
                      <th className="text-left p-3 font-medium text-muted-foreground">
                        {activeKind === "salary" ? "Local" : "Material"}
                      </th>
                    )}
                    <th className="text-right p-3 font-medium text-muted-foreground">Índice / Valor</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground mt-2">Carregando registros...</p>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-muted-foreground">
                        Nenhum registro encontrado para os filtros aplicados
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="p-3 text-foreground">{item.discipline || "—"}</td>
                        <td className="p-3 text-foreground max-w-[140px] truncate">{item.group_name || "—"}</td>
                        <td className="p-3 text-foreground max-w-xs truncate">{item.item_type || "—"}</td>
                        {activeKind !== "index" && activeKind !== "material" && (
                          <td className="p-3">
                            {item.operation ? (
                              <Badge variant="outline" className="text-xs max-w-[120px] truncate">{item.operation}</Badge>
                            ) : "—"}
                          </td>
                        )}
                        {activeKind !== "index" && activeKind !== "productivity" && activeKind !== "equipment" && (
                          <td className="p-3 text-muted-foreground max-w-[100px] truncate">{item.material || "—"}</td>
                        )}
                        <td className="p-3 text-right font-mono font-medium text-foreground">
                          {item.index_value != null ? item.index_value.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{item.unit || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {totalCount.toLocaleString()} registros • Página {page + 1} de {Math.max(1, totalPages)}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
          </>}
        </div>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">Detalhes do Registro</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {[
                  { label: "Categoria", value: kindTabs.find(t => t.value === selectedItem.kind)?.label || selectedItem.kind },
                  { label: "Disciplina", value: selectedItem.discipline },
                  { label: "Grupo", value: selectedItem.group_name },
                  { label: "Tipo / Descrição", value: selectedItem.item_type },
                  { label: "Operação", value: selectedItem.operation },
                  { label: "Material", value: selectedItem.material },
                  { label: "Unidade", value: selectedItem.unit },
                  { label: "Índice / Valor", value: selectedItem.index_value?.toLocaleString("pt-BR", { maximumFractionDigits: 6 }) },
                  { label: "Label do Índice", value: selectedItem.index_label },
                ].map((field) => (
                  <div key={field.label} className="flex justify-between items-start py-1.5 border-b border-border/30">
                    <span className="text-sm text-muted-foreground">{field.label}</span>
                    <span className="text-sm text-foreground font-medium text-right max-w-[60%]">{field.value || "—"}</span>
                  </div>
                ))}

                <Card className="p-4 bg-muted/20 border-border mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Origem do Dado</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Planilha</span>
                      <span className="text-foreground font-medium">{selectedItem.source_workbook_name || "Manual"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aba</span>
                      <span className="text-foreground font-medium">{selectedItem.source_sheet_name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Referência</span>
                      <span className="text-foreground font-medium">{selectedItem.source_label || "—"}</span>
                    </div>
                  </div>
                </Card>

                {selectedItem.notes && (
                  <Card className="p-4 bg-muted/20 border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Observações</h4>
                    <p className="text-sm text-foreground">{selectedItem.notes}</p>
                  </Card>
                )}

                {isAdmin && (
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => { setEditItem({ ...selectedItem }); }}>
                      <Pencil className="w-4 h-4" /> Editar
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Item da Biblioteca</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div><label className="text-xs text-muted-foreground">Disciplina</label>
                <Input value={editItem.discipline || ""} onChange={e => setEditItem({ ...editItem, discipline: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Grupo</label>
                <Input value={editItem.group_name || ""} onChange={e => setEditItem({ ...editItem, group_name: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Tipo / Descrição</label>
                <Input value={editItem.item_type || ""} onChange={e => setEditItem({ ...editItem, item_type: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Operação</label>
                  <Input value={editItem.operation || ""} onChange={e => setEditItem({ ...editItem, operation: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Material</label>
                  <Input value={editItem.material || ""} onChange={e => setEditItem({ ...editItem, material: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground">Unidade</label>
                  <Input value={editItem.unit || ""} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Índice Label</label>
                  <Input value={editItem.index_label || ""} onChange={e => setEditItem({ ...editItem, index_label: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Valor</label>
                  <Input type="number" value={editItem.index_value ?? ""} onChange={e => setEditItem({ ...editItem, index_value: +e.target.value })} /></div>
              </div>
              <div><label className="text-xs text-muted-foreground">Observações</label>
                <Input value={editItem.notes || ""} onChange={e => setEditItem({ ...editItem, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Item — {kindTabs.find(t => t.value === activeKind)?.label}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><label className="text-xs text-muted-foreground">Disciplina</label>
              <Input value={newItem.discipline} onChange={e => setNewItem({ ...newItem, discipline: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Grupo</label>
              <Input value={newItem.group_name} onChange={e => setNewItem({ ...newItem, group_name: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Tipo / Descrição</label>
              <Input value={newItem.item_type} onChange={e => setNewItem({ ...newItem, item_type: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Operação</label>
                <Input value={newItem.operation} onChange={e => setNewItem({ ...newItem, operation: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Material</label>
                <Input value={newItem.material} onChange={e => setNewItem({ ...newItem, material: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs text-muted-foreground">Unidade</label>
                <Input value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Índice Label</label>
                <Input value={newItem.index_label} onChange={e => setNewItem({ ...newItem, index_label: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Valor</label>
                <Input type="number" value={newItem.index_value} onChange={e => setNewItem({ ...newItem, index_value: +e.target.value })} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground">Observações</label>
              <Input value={newItem.notes} onChange={e => setNewItem({ ...newItem, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newItem.item_type && !newItem.discipline}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Biblioteca;
