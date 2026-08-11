import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReportHeader from '@/components/ReportHeader';
import SCurveChart from '@/components/SCurveChart';
import FiveWeekChart from '@/components/FiveWeekChart';
import HistogramChart from '@/components/HistogramChart';
import MonthChart from '@/components/MonthChart';
import ProgramacaoSemanalCard from '@/components/ProgramacaoSemanalCard';
import ProjectSelector from '@/components/ProjectSelector';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import ActionsTable from '@/components/ActionsTable';
import ScheduleTable from '@/components/ScheduleTable';
import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { useThemeStore, initTheme } from '@/hooks/use-theme';
import AppSidebar from '@/components/AppSidebar';
import { FileText, Database, Download, Moon, Sun, Shield, Smartphone, Presentation, Tv, Play, Pause, ChevronLeft, ChevronRight, Maximize, X, Menu, MoreVertical } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const TV_INTERVALS = [10, 20, 30, 60] as const;

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
  const [tvMode, setTvMode] = useState(false);
  const [tvPlaying, setTvPlaying] = useState(true);
  const [tvInterval, setTvInterval] = useState<number>(20);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const current = useCurrentProject();
  const { isAdmin } = useAuth();

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

  // ── MODO TV ────────────────────────────────────────────────────────────
  const tvIndex = projects.findIndex((p) => p.id === selectedProjectId);

  const goToProject = (dir: 1 | -1) => {
    if (projects.length === 0) return;
    const idx = tvIndex === -1 ? 0 : tvIndex;
    const nextIdx = (idx + dir + projects.length) % projects.length;
    selectProject(projects[nextIdx].id);
  };

  const toggleTvMode = () => {
    if (!tvMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setTvPlaying(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setTvMode(!tvMode);
  };

  const toggleFullscreenOnly = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    if (!tvMode || !tvPlaying || projects.length < 2) return;
    const t = setInterval(() => goToProject(1), tvInterval * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvMode, tvPlaying, tvInterval, selectedProjectId, projects.length]);

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

  // Controles que vivem dentro da faixa do cabeçalho do relatório (desktop).
  // No mobile eles ficam na barra superior / menu lateral.
  const reportActions = (
    <>
      <ProjectSelector showDelete tone="dark" />

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
        onClick={openExportDialog}
      >
        <Download className="h-3.5 w-3.5" />
        Exportar
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center justify-center h-8 w-8 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            title="Mais opções"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={togglePresentation}>
            <Presentation className="h-4 w-4 mr-2" /> Modo apresentação
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTvMode}>
            <Tv className="h-4 w-4 mr-2" /> Modo TV
          </DropdownMenuItem>
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
    </>
  );

  return (
    <div className={`min-h-screen flex bg-background ${presentationMode || tvMode ? 'overflow-auto' : ''}`}>
      {!presentationMode && !tvMode && <AppSidebar />}
      <div className="flex-1 min-w-0">
      {/* Barra superior — só no mobile. No desktop os controles ficam dentro do
          cabeçalho do relatório (ver `reportActions`). */}
      {!presentationMode && !tvMode && (
        <div className="sm:hidden bg-card border-b border-border px-3 py-2.5 flex items-center justify-between gap-2 print:hidden sticky top-0 z-50">
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-between">
            <div className="min-w-0 flex-1">
              <ProjectSelector />
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex items-center justify-center h-11 w-11 rounded-lg hover:bg-muted text-foreground transition-colors shrink-0"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  <Button variant="outline" className="justify-start h-11" onClick={() => { setMobileMenuOpen(false); openExportDialog(); }}>
                    <Download className="h-4 w-4 mr-2" /> Exportar PDF
                  </Button>
                  <Button variant="outline" className="justify-start h-11" onClick={() => { setMobileMenuOpen(false); togglePresentation(); }}>
                    <Presentation className="h-4 w-4 mr-2" /> Modo apresentação
                  </Button>
                  <Button variant="outline" className="justify-start h-11" onClick={() => { setMobileMenuOpen(false); toggleTvMode(); }}>
                    <Tv className="h-4 w-4 mr-2" /> Modo TV
                  </Button>
                  <Button variant="outline" className="justify-start h-11" onClick={() => { setMobileMenuOpen(false); toggleTheme(); }}>
                    {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                  </Button>
                  {!isStandalone && (
                    <Button variant="outline" className="justify-start h-11" onClick={() => { setMobileMenuOpen(false); navigate('/install'); }}>
                      <Smartphone className="h-4 w-4 mr-2" /> Instalar no celular
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {/* Diálogo de exportação — compartilhado pelo botão do cabeçalho (desktop) e pelo menu mobile */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
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

      {/* Modo TV: barra de controle flutuante */}
      {tvMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-foreground text-background rounded-full pl-3 pr-2 py-1.5 shadow-2xl text-sm">
          <span className="font-semibold px-1.5 tabular-nums">
            {projects.length > 0 ? `${tvIndex + 1}/${projects.length}` : '0/0'}
          </span>
          <button onClick={() => goToProject(-1)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-background/10 transition-colors" title="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setTvPlaying((p) => !p)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-background/10 transition-colors" title={tvPlaying ? 'Pausar' : 'Reproduzir'}>
            {tvPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => goToProject(1)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-background/10 transition-colors" title="Próximo">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-0.5 mx-1 pl-1 border-l border-background/20">
            {TV_INTERVALS.map((s) => (
              <button
                key={s}
                onClick={() => setTvInterval(s)}
                className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium transition-colors',
                  tvInterval === s ? 'bg-primary text-primary-foreground' : 'hover:bg-background/10'
                )}
              >
                {s}s
              </button>
            ))}
          </div>
          <button
            onClick={toggleFullscreenOnly}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium hover:bg-background/10 transition-colors"
          >
            <Maximize className="h-3.5 w-3.5" />
            Tela cheia
          </button>
          <button onClick={toggleTvMode} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-background/10 transition-colors ml-1" title="Sair do Modo TV">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={reportRef} className="px-3 sm:px-4 py-3 sm:py-4 space-y-4 pb-20 sm:pb-6">
        <ReportHeader actions={presentationMode || tvMode ? undefined : reportActions} />
        <ExecutiveSummary />

        {/* O layout é fixo: os seis cards aparecem sempre, zerados quando não
            houver dados importados para o projeto selecionado. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SCurveChart />
          <FiveWeekChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MonthChart />
          <HistogramChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActionsTable />
          <ProgramacaoSemanalCard
            data={current?.programacaoSemanal ?? []}
            histogramData={current?.histogramData}
          />
        </div>

        {/* Cronograma — largura total: são as 15 colunas do template */}
        <ScheduleTable />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-3 text-xs text-muted-foreground border-t border-border"
        >
          One Page Report · Gerado automaticamente
        </motion.div>
      </div>

      {/* Mobile bottom nav */}
      {!presentationMode && !tvMode && (
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
