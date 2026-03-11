import { useMemo } from 'react';
import { ScheduleRow } from '@/store/projectStore';
import { motion } from 'framer-motion';

interface GanttChartProps {
  data: ScheduleRow[];
  statusDate?: string;
}

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // Try various formats
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const formatShortDate = (d: Date) => {
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${day}/${months[d.getMonth()]}`;
};

const GanttChart = ({ data, statusDate }: GanttChartProps) => {
  const { minDate, maxDate, rows, monthMarkers } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    const validRows = data.filter(r => r.tarefa).map(row => {
      const start = parseDate(row.inicio);
      const end = parseDate(row.termino);
      const baseStart = parseDate(row.inicioBase);
      const baseEnd = parseDate(row.terminoBase);

      const allDates = [start, end, baseStart, baseEnd].filter(Boolean) as Date[];
      allDates.forEach(d => {
        if (d.getTime() < min) min = d.getTime();
        if (d.getTime() > max) max = d.getTime();
      });

      return { ...row, start, end, baseStart, baseEnd };
    });

    // Add padding
    const range = max - min || 1;
    const padding = range * 0.05;
    const finalMin = min - padding;
    const finalMax = max + padding;

    // Generate month markers
    const markers: { label: string; pos: number }[] = [];
    if (isFinite(finalMin) && isFinite(finalMax)) {
      const startMonth = new Date(finalMin);
      startMonth.setDate(1);
      const endDate = new Date(finalMax);
      const current = new Date(startMonth);
      while (current <= endDate) {
        const pos = (current.getTime() - finalMin) / (finalMax - finalMin);
        if (pos >= 0 && pos <= 1) {
          const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          markers.push({ label: `${months[current.getMonth()]}/${current.getFullYear().toString().slice(2)}`, pos });
        }
        current.setMonth(current.getMonth() + 1);
      }
    }

    return { minDate: finalMin, maxDate: finalMax, rows: validRows, monthMarkers: markers };
  }, [data]);

  const totalRange = maxDate - minDate || 1;

  const getPos = (d: Date | null) => {
    if (!d || !isFinite(minDate)) return 0;
    return ((d.getTime() - minDate) / totalRange) * 100;
  };

  const getWidth = (start: Date | null, end: Date | null) => {
    if (!start || !end) return 0;
    return Math.max(((end.getTime() - start.getTime()) / totalRange) * 100, 0.5);
  };

  // Status date line
  const statusDateParsed = statusDate ? parseDate(statusDate) : null;
  const statusPos = statusDateParsed ? getPos(statusDateParsed) : null;

  if (rows.length === 0 || !isFinite(minDate)) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-4 mb-3">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Gráfico de Gantt</h4>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm bg-primary" /> Planejado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm bg-success" /> Progresso
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded-sm border border-muted-foreground/40 bg-muted/50" /> Linha de base
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm bg-destructive" /> Caminho Crítico
          </span>
        </div>
      </div>

      {/* Timeline header */}
      <div className="relative h-5 border-b border-border mb-0.5">
        {monthMarkers.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 h-full flex items-end"
            style={{ left: `${m.pos * 100}%` }}
          >
            <div className="h-full w-px bg-border" />
            <span className="text-[8px] text-muted-foreground ml-1 whitespace-nowrap pb-0.5">{m.label}</span>
          </div>
        ))}
        {statusPos != null && statusPos >= 0 && statusPos <= 100 && (
          <div
            className="absolute top-0 h-full w-px bg-warning z-10"
            style={{ left: `${statusPos}%` }}
          >
            <span className="absolute -top-0.5 -translate-x-1/2 text-[7px] text-warning font-bold">▼</span>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-0">
        {rows.map((row, i) => {
          const isHeader = row.tarefa === row.tarefa.toUpperCase() && row.tarefa.length > 3;
          const isCritical = !!row.criticalPath;
          const barColor = isCritical ? 'bg-destructive' : 'bg-primary';
          const progressColor = isCritical ? 'bg-destructive/70' : 'bg-success';

          const startPos = getPos(row.start);
          const barWidth = getWidth(row.start, row.end);
          const baseStartPos = getPos(row.baseStart);
          const baseWidth = getWidth(row.baseStart, row.baseEnd);
          const progressWidth = barWidth * (row.trabalhoConcluido / 100);

          return (
            <div
              key={i}
              className={`relative flex items-center gap-2 ${
                isHeader ? 'bg-muted/40' : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
              } ${row.highlight ? 'bg-warning/10' : ''}`}
              style={{ height: '22px' }}
            >
              {/* Task name */}
              <div
                className={`shrink-0 truncate text-[9px] px-1.5 ${
                  isHeader ? 'font-bold' : ''
                } ${row.bold ? 'font-bold' : ''} ${
                  isCritical ? 'text-destructive font-semibold' : 'text-foreground'
                }`}
                style={{ width: '180px' }}
                title={row.tarefa}
              >
                {row.tarefa}
              </div>

              {/* Gantt area */}
              <div className="relative flex-1 h-full">
                {/* Grid lines */}
                {monthMarkers.map((m, j) => (
                  <div
                    key={j}
                    className="absolute top-0 h-full w-px bg-border/40"
                    style={{ left: `${m.pos * 100}%` }}
                  />
                ))}

                {/* Status date line */}
                {statusPos != null && statusPos >= 0 && statusPos <= 100 && (
                  <div
                    className="absolute top-0 h-full w-px bg-warning/50 z-10"
                    style={{ left: `${statusPos}%` }}
                  />
                )}

                {/* Baseline bar */}
                {baseWidth > 0 && (
                  <div
                    className="absolute top-[14px] h-[4px] bg-muted-foreground/20 rounded-sm border border-muted-foreground/30"
                    style={{ left: `${baseStartPos}%`, width: `${baseWidth}%` }}
                  />
                )}

                {/* Main bar */}
                {barWidth > 0 && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.4 }}
                    className={`absolute top-[4px] h-[10px] ${barColor} rounded-sm opacity-80`}
                    style={{
                      left: `${startPos}%`,
                      width: `${barWidth}%`,
                      transformOrigin: 'left',
                    }}
                  >
                    {/* Progress fill */}
                    {row.trabalhoConcluido > 0 && (
                      <div
                        className={`h-full ${progressColor} rounded-sm`}
                        style={{ width: `${Math.min(row.trabalhoConcluido, 100)}%` }}
                      />
                    )}
                  </motion.div>
                )}

                {/* Milestone (no duration) */}
                {row.start && (!row.end || barWidth < 0.3) && (
                  <div
                    className={`absolute top-[5px] w-2 h-2 rotate-45 ${isCritical ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ left: `${startPos}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttChart;
