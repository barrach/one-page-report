import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReportHeader from '@/components/ReportHeader';
import SCurveChart from '@/components/SCurveChart';
import FiveWeekChart from '@/components/FiveWeekChart';
import MonthChart from '@/components/MonthChart';
import ActionsTable from '@/components/ActionsTable';
import RestrictionsChart from '@/components/RestrictionsChart';
import ObservationsSection from '@/components/ObservationsSection';
import HistogramChart from '@/components/HistogramChart';
import ScheduleTable from '@/components/ScheduleTable';
import ProjectSelector from '@/components/ProjectSelector';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import { useProjectStore } from '@/store/projectStore';
import { useThemeStore, initTheme } from '@/hooks/use-theme';
import { FileText, Database, Download, Moon, Sun, Shield, Smartphone, Presentation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

const Index = () => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { projects, selectedProjectId, selectProject } = useProjectStore();
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [isStandalone, setIsStandalone] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  const togglePresentation = () => {
    if (!presentationMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setPresentationMode(!presentationMode);
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setPresentationMode(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    initTheme();
  }, []);

  const toggleExportProject = (id: string) => {
    setSelectedExportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const idsToExport = selectedExportIds.length > 0 ? selectedExportIds : [selectedProjectId];
      const originalId = selectedProjectId;

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 3;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      for (let idx = 0; idx < idsToExport.length; idx++) {
        const projectId = idsToExport[idx];
        selectProject(projectId);
        await new Promise((r) => setTimeout(r, 500));
        if (!reportRef.current) continue;

        const orig = reportRef.current.style.width;
        reportRef.current.style.width = '1400px';

        const canvas = await html2canvas(reportRef.current, {
          scale: 2, useCORS: true, logging: false,
          backgroundColor: '#ffffff', windowWidth: 1500,
          width: reportRef.current.scrollWidth, height: reportRef.current.scrollHeight,
        });

        reportRef.current.style.width = orig;

        const imgData = canvas.toDataURL('image/png');
        const imgAspect = canvas.width / canvas.height;
        const pageAspect = contentWidth / contentHeight;

        let drawWidth: number, drawHeight: number;
        if (imgAspect > pageAspect) { drawWidth = contentWidth; drawHeight = contentWidth / imgAspect; }
        else { drawHeight = contentHeight; drawWidth = contentHeight * imgAspect; }

        if (idx > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin + (contentWidth - drawWidth) / 2, margin, drawWidth, drawHeight);
      }

      selectProject(originalId);
      const projectName = projects.find(p => p.id === originalId)?.name || 'relatorio';
      pdf.save(`${projectName}-relatorio.pdf`);
      setShowExportDialog(false);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const openExportDialog = () => {
    setSelectedExportIds([selectedProjectId]);
    setShowExportDialog(true);
  };

  return (
    <div className={`min-h-screen bg-background ${presentationMode ? 'overflow-auto' : ''}`}>
      {/* Top navigation bar */}
      {!presentationMode && (
        <div className="gradient-primary px-3 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden sticky top-0 z-50 card-shadow-elevated">
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 bg-primary-foreground/60 rounded-full" />
              <h1 className="text-sm font-bold text-primary-foreground tracking-[0.15em] uppercase">MEGASTEAM</h1>
            </div>
            <nav className="flex gap-1">
              <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-foreground/20 text-primary-foreground">
                <FileText className="h-3.5 w-3.5" />
                Relatório
              </Link>
              <Link to="/dados" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors">
                <Database className="h-3.5 w-3.5" />
                Dados
              </Link>
              <Link to="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors">
                <Shield className="h-3.5 w-3.5" />
                Admin
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={togglePresentation}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors"
              title="Modo apresentação"
            >
              <Presentation className="h-3.5 w-3.5" />
            </button>

            {!isStandalone && (
              <button
                onClick={() => navigate('/install')}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors"
                title="Instalar no celular"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="gap-1.5 h-8 text-xs" onClick={openExportDialog}>
                  <Download className="h-3.5 w-3.5" />
                  Exportar PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exportar Relatório em PDF</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mb-3">Selecione os projetos para exportar. Cada projeto será uma página no PDF.</p>
                <div className="space-y-2 mb-4">
                  {projects.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedExportIds.includes(p.id)} onCheckedChange={() => toggleExportProject(p.id)} />
                      <span className="text-sm font-medium">{p.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancelar</Button>
                  <Button onClick={exportPDF} disabled={exporting || selectedExportIds.length === 0} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    {exporting ? 'Exportando...' : `Exportar ${selectedExportIds.length} projeto(s)`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <ProjectSelector showCreate />
          </div>
        </div>
      )}

      {/* Floating exit button in presentation mode */}
      {presentationMode && (
        <button
          onClick={togglePresentation}
          className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/80 text-background text-xs font-semibold hover:bg-foreground transition-colors opacity-0 hover:opacity-100 focus:opacity-100"
          title="Sair do modo apresentação (ESC)"
        >
          <X className="h-3.5 w-3.5" />
          Sair
        </button>
      )}

      <div ref={reportRef} className="p-3 sm:p-5 md:p-6 max-w-[1440px] mx-auto space-y-4">
        <ReportHeader />
        <ExecutiveSummary />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SCurveChart />
          <FiveWeekChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HistogramChart />
          <MonthChart />
        </div>

        <ScheduleTable />
        <ActionsTable />
        <ObservationsSection />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-3 text-xs text-muted-foreground border-t border-border"
        >
          MEGASTEAM · One Page Report · Gerado automaticamente
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
