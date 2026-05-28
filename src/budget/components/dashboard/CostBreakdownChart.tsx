const segments = [
  { label: "Custos Diretos", pct: 67.4, color: "bg-primary" },
  { label: "Custos Indiretos", pct: 19.9, color: "bg-accent" },
  { label: "Impostos", pct: 12.7, color: "bg-destructive" },
];

const CostBreakdownChart = () => (
  <div className="glass-card p-5 animate-fade-in">
    <h3 className="text-sm font-semibold text-foreground mb-4">Composição do Preço</h3>
    <div className="space-y-3">
      {segments.map((s) => (
        <div key={s.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground font-medium">{s.pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${s.color} transition-all duration-700`}
              style={{ width: `${s.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>

    <div className="mt-5 pt-4 border-t border-border">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Preço de Venda</span>
        <span className="text-xl font-bold text-accent">R$ 17.416.342,71</span>
      </div>
    </div>
  </div>
);

export default CostBreakdownChart;
