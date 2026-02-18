import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { Trash2, Plus } from 'lucide-react';

const ObservationsSection = () => {
  const { observations } = useCurrentProject();
  const { setObservations, addObservation, removeObservation } = useProjectStore();

  const updateObs = (index: number, value: string) => {
    const updated = observations.map((o, i) => i === index ? { ...o, text: value } : o);
    setObservations(updated);
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Observações</h3>
          <p className="text-xs text-muted-foreground">Notas e pontos de atenção</p>
        </div>
        <button
          onClick={addObservation}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3 w-3" />
          Obs
        </button>
      </div>
      <ol className="space-y-2 flex-1">
        {observations.map((o, i) => (
          <li key={i} className={`flex gap-2 items-start group rounded-lg px-3 py-2 transition-colors ${o.text ? 'bg-secondary/50' : 'hover:bg-muted/30'}`}>
            <span className="font-bold text-primary text-sm mt-0.5 min-w-[20px]">{o.id}.</span>
            <input
              className="flex-1 bg-transparent border-none outline-none text-sm focus:ring-0"
              value={o.text}
              onChange={(e) => updateObs(i, e.target.value)}
              placeholder="Adicione uma observação..."
            />
            <button
              onClick={() => removeObservation(i)}
              className="text-destructive/30 hover:text-destructive transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default ObservationsSection;
