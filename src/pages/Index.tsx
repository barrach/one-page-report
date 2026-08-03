import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReportHeader from '@/components/ReportHeader';
import ContractThermometer from '@/components/ContractThermometer';
import SCurveChart from '@/components/SCurveChart';
import FiveWeekChart from '@/components/FiveWeekChart';
import MonthChart from '@/components/MonthChart';
import ActionsTable from '@/components/ActionsTable';
import RestrictionsChart from '@/components/RestrictionsChart';
import HistogramChart from '@/components/HistogramChart';
import FinancialCurveChart from '@/components/FinancialCurveChart';
import ScheduleTable from '@/components/ScheduleTable';
import ProjectSelector from '@/components/ProjectSelector';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import AppSidebar from '@/components/AppSidebar';
import logo from '@/assets/megasteam-logo.png.asset.json';
import { useAuth } from '@/hooks/use-auth';
import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { useThemeStore, initTheme } from '@/hooks/use-theme';

import { FileText, Database, Download, Moon, Sun, Shield, Smartphone, Presentation, X, Menu, Tv, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const current = useCurrentProject();
  const isAdmin = useAuth((s) => s.isAdmin);


  const hasRows = (arr: any[] | undefined, keys: string[]) =>
    Array.isArray(arr) && arr.some((r) => r && keys.some((k) => {
      const v = (r as any)[k];
      return v !== undefined && v !== null && v !== '' && v !== 0;
    }));

  const showSCurve = hasRows(current?.sCurveData, ['date']);
  const showHistogram = hasRows(current?.histogramData, ['date', 'semana']);
  const showFinancial = Array.isArray(current?.curvaSFinanceira) && current.curvaSFinanceira.length > 0;
  const showFiveWeek = hasRows(current?.weeklyData, ['date']);
  const showMonth = hasRows(current?.monthData, ['week', 'date']);
  const showSchedule = hasRows(current?.scheduleData, ['tarefa', 'id']);
  const showExecutive = showSCurve || showHistogram || showFinancial || showFiveWeek || showMonth || showSchedule;

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
    <div className="min-h-screen bg-background flex">
      {!presentationMode && <AppSidebar />}
      <div className={`flex-1 min-w-0 ${presentationMode ? 'overflow-auto' : ''}`}>
      {/* Action toolbar */}
      {!presentationMode && (
        <div className="px-3 sm:px-5 md:px-6 pt-3 sm:pt-5 max-w-[1440px] mx-auto w-full print:hidden">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/60 backdrop-blur px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <img src={logo.url} alt="MEGASTEAM" className="h-5 w-auto object-contain sm:hidden" />
              <span className="hidden sm:block text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
                Relatório
              </span>
              <ProjectSelector />
            </div>

            <div className="flex items-center gap-1.5">
              <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={openExportDialog}>
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Exportar</span>
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Mais opções"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={togglePresentation}>
                    <Presentation className="h-4 w-4 mr-2" /> Modo apresentação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/tv')}>
                    <Tv className="h-4 w-4 mr-2" /> Modo TV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  {!isStandalone && (
                    <DropdownMenuItem onClick={() => navigate('/install')}>
                      <Smartphone className="h-4 w-4 mr-2" /> Instalar no celular
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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

      <div ref={reportRef} className="px-3 sm:px-5 md:px-6 py-3 sm:py-5 md:py-6 max-w-[1440px] mx-auto space-y-4 pb-20 sm:pb-6">
        <ReportHeader />
        <ContractThermometer />
        {showExecutive && <ExecutiveSummary />}


        {showSCurve && <SCurveChart />}
        {showHistogram && <HistogramChart />}
        {showFinancial && <FinancialCurveChart />}

        {(showFiveWeek || showMonth) && (
          <div className={`grid grid-cols-1 ${showFiveWeek && showMonth ? 'lg:grid-cols-2' : ''} gap-4`}>
            {showFiveWeek && <FiveWeekChart />}
            {showMonth && <MonthChart />}
          </div>
        )}

        {showSchedule && <ScheduleTable />}
        <ActionsTable />
        <RestrictionsChart />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-3 text-xs text-muted-foreground border-t border-border"
        >
          MEGASTEAM · One Page Report · Gerado automaticamente
        </motion.div>
      </div>

      {/* Mobile bottom nav */}
      {!presentationMode && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-card border-t border-border flex justify-around items-stretch h-14 print:hidden">
          <Link to="/" className="flex flex-col items-center justify-center flex-1 gap-0.5 text-primary">
            <FileText className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Relatório</span>
          </Link>
          <Link to="/dados" className="flex flex-col items-center justify-center flex-1 gap-0.5 text-muted-foreground">
            <Database className="h-5 w-5" />
            <span className="text-[10px] font-medium">Dados</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex flex-col items-center justify-center flex-1 gap-0.5 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <span className="text-[10px] font-medium">Admin</span>
            </Link>
          )}
        </nav>
      )}
      </div>
    </div>
  );

};

export default Index;
