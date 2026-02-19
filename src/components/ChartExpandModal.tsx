import { X, Maximize2 } from 'lucide-react';
import { useState } from 'react';

interface ChartExpandModalProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  expandedHeight?: string;
}

const ChartExpandModal = ({ title, subtitle, children, expandedHeight = 'h-[70vh]' }: ChartExpandModalProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Ampliar gráfico"
      >
        <Maximize2 size={15} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border">
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chart */}
            <div className={`${expandedHeight} px-6 py-4`}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChartExpandModal;
