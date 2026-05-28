import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@budget/components/ui/dialog";
import { Input } from "@budget/components/ui/input";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Search, Database, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";

interface LibraryItem {
  id: string;
  kind: string;
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
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (item: LibraryItem) => void;
}

const PAGE_SIZE = 20;

export default function LibraryPickerDialog({ open, onClose, onSelect }: Props) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("productivity");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const loadItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("technical_library_items")
      .select("id,kind,discipline,group_name,item_type,operation,material,unit,index_label,index_value,source_workbook_name,source_sheet_name,notes", { count: "exact" })
      .eq("kind", kind as any)
      .eq("is_active", true)
      .order("discipline")
      .order("group_name")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(
        `discipline.ilike.%${search}%,group_name.ilike.%${search}%,item_type.ilike.%${search}%,operation.ilike.%${search}%,material.ilike.%${search}%`
      );
    }

    const { data, count } = await query;
    setItems((data as LibraryItem[]) || []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [kind, search, page]);

  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  useEffect(() => { setPage(0); }, [search, kind]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Selecionar da Biblioteca Técnica
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="productivity">Produtividade</SelectItem>
              <SelectItem value="salary">Salários</SelectItem>
              <SelectItem value="material">Materiais</SelectItem>
              <SelectItem value="index">Índices</SelectItem>
              <SelectItem value="equipment">Equipamentos</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por disciplina, grupo, tipo, material..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto border border-border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum registro encontrado</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-medium text-muted-foreground">Disciplina</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Grupo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Material</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Índice</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Un</th>
                  <th className="p-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-primary/5 transition-colors">
                    <td className="p-2 text-foreground">{item.discipline || "—"}</td>
                    <td className="p-2 text-foreground max-w-[120px] truncate">{item.group_name || "—"}</td>
                    <td className="p-2 text-foreground max-w-[140px] truncate">{item.item_type || "—"}</td>
                    <td className="p-2 text-muted-foreground max-w-[100px] truncate">{item.material || "—"}</td>
                    <td className="p-2 text-right font-mono font-medium text-primary">
                      {item.index_value != null ? item.index_value.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">{item.unit || "—"}</td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onSelect(item)}>
                        Usar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">{total} registros</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page + 1}/{Math.max(1, totalPages)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
