import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import ParetoCausas from '@/components/ParetoCausas';
import ClimaCard from '@/components/ClimaCard';
import CardArrumavel from '@/components/CardArrumavel';
import {
  normalizarLayout, moverCard, reordenarCard, alternarLargura, ajustarAltura, alternarOculto,
} from '@/lib/layoutRelatorio';
import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { useThemeStore, initTheme } from '@/hooks/use-theme';
import { useTvMode } from '@/hooks/use-tv-mode';
import AppSidebar from '@/components/AppSidebar';
import { FileText, Database, Download, Moon, Sun, Shield, Smartphone, Presentation, Tv, Play, Pause, ChevronLeft, ChevronRight, Maximize, X, Menu, MoreVertical, LayoutGrid } from 'lucide-react';
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
import { paginar } from '@/lib/pdfPaginacao';
import { useExportMode } from '@/hooks/use-export-mode';
import { toast } from 'sonner';

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
  const { tvMode, setTvMode } = useTvMode();
  const { setExportando } = useExportMode();
  const [tvPlaying, setTvPlaying] = useState(true);
  const [tvInterval, setTvInterval] = useState<number>(20);
  /** Barra de controle da TV: aparece ao interagir e se esconde sozinha. */
  const [tvUiVisible, setTvUiVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const current = useCurrentProject();
  const { isAdmin, canEdit } = useAuth();

  // ── Arrumação dos cards (só administrador) ──
  const setLayoutRelatorio = useProjectStore((s) => s.setLayoutRelatorio);
  const [editandoLayout, setEditandoLayout] = useState(false);
  const arrastando = useRef<string | null>(null);
  // Normaliza sempre: card novo criado depois entra no fim em vez de sumir do
  // relatório de quem já tinha layout salvo.
  const layout = useMemo(() => normalizarLayout(current?.layoutRelatorio), [current?.layoutRelatorio]);

  const renderizarCard = (id: string) => {
    switch (id) {
      case 'scurve': return <SCurveChart />;
      case 'fiveweek': return <FiveWeekChart />;
      case 'month': return <MonthChart />;
      case 'histogram': return <HistogramChart />;
      case 'schedule': return <ScheduleTable />;
      case 'clima': return <ClimaCard />;
      case 'actions': return <ActionsTable />;
      case 'progsemanal': return (
        <ProgramacaoSemanalCard
          data={current?.programacaoSemanal ?? []}
          histogramData={current?.histogramData}
        />
      );
      case 'pareto': return <ParetoCausas />;
      default: return null;
    }
  };

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
      setTvUiVisible(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setTvMode(!tvMode);
  };

  // A barra de controle se esconde após alguns segundos sem interação e volta a
  // qualquer sinal de uso. Numa TV ela simplesmente desaparece e fica só o painel.
  useEffect(() => {
    if (!tvMode) return;
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTvUiVisible(false), 4000);
    };
    const wake = () => { setTvUiVisible(true); arm(); };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [tvMode]);

  // Sair do fullscreen (ESC, por exemplo) NÃO encerra o modo TV — ele só sai pelo
  // botão. Numa TV, um ESC acidental não pode derrubar o painel.
  useEffect(() => {
    if (!tvMode) return;
    const block = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    window.addEventListener('keydown', block);
    return () => window.removeEventListener('keydown', block);
  }, [tvMode]);

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

  /**
   * Exporta o relatório em A4 retrato, com quantas páginas forem necessárias.
   *
   * Captura BLOCO POR BLOCO (cada card) em vez da página inteira, e monta as
   * folhas encaixando um bloco por vez. Assim nenhum card é partido: quando o
   * próximo não cabe no que resta da folha, começa outra. Só um bloco mais alto
   * que a folha inteira precisa ser fatiado — e aí o corte acontece no fim de
   * uma linha de tabela, nunca no meio dela.
   *
   * Cada bloco é capturado na largura que já tem na tela e desenhado nos 194 mm
   * úteis, então quem é meia-largura sai com texto maior no papel. A classe
   * `exportando-pdf` só esconde controles e destrava overflow — mexer em largura
   * fazia o recharts redesenhar e o gráfico saía vazio.
   */
  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const idsToExport = selectedExportIds.length > 0 ? selectedExportIds : [selectedProjectId];
      const originalId = selectedProjectId;

      // compress: true faz o jsPDF usar Flate nas imagens; sem isso ele embute
      // RGB cru e um relatório de 3 páginas passa de 40 MB.
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const margem = 8;
      const larguraUtil = pdf.internal.pageSize.getWidth() - margem * 2;
      const alturaUtil = pdf.internal.pageSize.getHeight() - margem * 2;
      const espacoEntreBlocos = 3;

      // Cada bloco é capturado na largura que tem na tela e desenhado em 194 mm.
      // Mexer na largura antes de capturar fazia o recharts redesenhar e o
      // html2canvas pegava o gráfico vazio.
      const capturar = (el: HTMLElement) =>
        html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

      const paraJpeg = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.92);

      // Troca os campos editáveis por texto estático antes de capturar: o
      // html2canvas corta o valor dos inputs e não desenha o texto dos selects.
      setExportando(true);
      await new Promise((r) => setTimeout(r, 200));

      let primeiraPagina = true;
      let y = margem;

      const novaPagina = () => {
        if (!primeiraPagina) pdf.addPage();
        primeiraPagina = false;
        y = margem;
      };

      for (const projectId of idsToExport) {
        selectProject(projectId);
        await new Promise((r) => setTimeout(r, 400));
        const raiz = reportRef.current;
        if (!raiz) continue;

        raiz.classList.add('exportando-pdf');
        // Folga para o layout assentar depois de esconder os controles.
        await new Promise((r) => setTimeout(r, 400));

        // Blocos = filhos diretos; dentro de um grid, cada card é um bloco.
        //
        // Guardo o CAMINHO (índices) e não o nó: entre capturas o React
        // re-renderiza e trocar de projeto pode substituir os nós. Segurando a
        // referência antiga, o html2canvas recebia um elemento fora da página e
        // devolvia canvas vazio — foi assim que o 2º projeto perdeu os últimos
        // cards (Programação Semanal, Pareto, Cronograma e rodapé).
        const caminhos: [number, number | null][] = [];
        Array.from(raiz.children).forEach((filho, i) => {
          const el = filho as HTMLElement;
          if (el.dataset.pdfSkip !== undefined) return; // Resumo Executivo não vai ao papel
          if (el.classList.contains('grid')) {
            Array.from(el.children).forEach((_, j) => caminhos.push([i, j]));
          } else {
            caminhos.push([i, null]);
          }
        });

        const resolver = ([i, j]: [number, number | null]): HTMLElement | null => {
          const filho = raiz.children[i] as HTMLElement | undefined;
          if (!filho) return null;
          if (j === null) return filho;
          return (filho.children[j] as HTMLElement) ?? null;
        };

        novaPagina();

        for (const caminho of caminhos) {
          const bloco = resolver(caminho);
          if (!bloco || bloco.dataset.pdfSkip !== undefined) continue;
          if (bloco.getBoundingClientRect().height <= 8) continue;

          const canvas = await capturar(bloco);
          if (canvas.width === 0 || canvas.height === 0) {
            console.warn('Bloco não capturado no PDF:', caminho, bloco.className);
            continue;
          }

          const mmPorPx = larguraUtil / canvas.width;
          const alturaMm = canvas.height * mmPorPx;

          // Cabe inteiro numa folha: encaixa, abrindo página nova se preciso.
          if (alturaMm <= alturaUtil) {
            if (y + alturaMm > margem + alturaUtil) novaPagina();
            pdf.addImage(paraJpeg(canvas), 'JPEG', margem, y, larguraUtil, alturaMm);
            y += alturaMm + espacoEntreBlocos;
            continue;
          }

          // Mais alto que a folha: fatia nos fins de linha de tabela.
          const escala = canvas.height / bloco.scrollHeight;
          const topo = bloco.getBoundingClientRect().top;
          const quebras = new Set<number>();
          bloco.querySelectorAll('tr, li, tbody > tr').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.height > 0) quebras.add(Math.round((r.bottom - topo) * escala));
          });

          const alturaPaginaPx = Math.floor(alturaUtil / mmPorPx);
          const fatias = paginar(canvas.height, alturaPaginaPx, [...quebras]);

          for (const { inicio, fim } of fatias) {
            const alturaFatia = fim - inicio;
            if (alturaFatia <= 0) continue;

            const corte = document.createElement('canvas');
            corte.width = canvas.width;
            corte.height = alturaFatia;
            const ctx = corte.getContext('2d');
            if (!ctx) continue;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, corte.width, corte.height);
            ctx.drawImage(canvas, 0, inicio, canvas.width, alturaFatia, 0, 0, canvas.width, alturaFatia);

            const fatiaMm = alturaFatia * mmPorPx;
            if (y + fatiaMm > margem + alturaUtil) novaPagina();
            pdf.addImage(paraJpeg(corte), 'JPEG', margem, y, larguraUtil, fatiaMm);
            y += fatiaMm + espacoEntreBlocos;
          }
        }

        raiz.classList.remove('exportando-pdf');
      }

      selectProject(originalId);
      setExportando(false);

      // Nome do arquivo: o do projeto quando é um só; com vários, deixa claro
      // quantos vão no arquivo em vez de usar o nome de um deles.
      const limpar = (t: string) => t.replace(/[\/:*?"<>|]/g, '-').trim();
      const nome = idsToExport.length === 1
        ? limpar(projects.find(p => p.id === idsToExport[0])?.name || 'relatorio')
        : `One Page Report - ${idsToExport.length} projetos`;
      pdf.save(`${nome}.pdf`);
      setShowExportDialog(false);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Não foi possível exportar o PDF. Veja o console para o detalhe.');
      reportRef.current?.classList.remove('exportando-pdf');
      setExportando(false);
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
          {/* Arrumar o relatório é do administrador: o layout vale para todos
              que abrirem o projeto. */}
          {isAdmin && (
            <DropdownMenuItem onClick={() => setEditandoLayout((v) => !v)}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              {editandoLayout ? 'Concluir arrumação' : 'Arrumar relatório'}
            </DropdownMenuItem>
          )}
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
    <div className={`flex bg-background ${tvMode ? 'h-screen overflow-hidden' : presentationMode ? 'min-h-screen overflow-auto' : 'min-h-screen'}`}>
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
      <AnimatePresence>
      {tvMode && tvUiVisible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-foreground text-background rounded-full pl-3 pr-2 py-1.5 shadow-2xl text-sm"
        >
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
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── MODO TV ──────────────────────────────────────────────────────────
          Pensado para uma TV na parede: só o cabeçalho do contrato (com os KPIs) e
          os dois gráficos principais, tudo em UMA tela. Sem rolagem, sem nada
          clicável e sem o Resumo Executivo — o gestor olha de longe e entende.
          A troca de contrato entra com animação. */}
      {tvMode ? (
        <div className="h-screen overflow-hidden flex flex-col gap-3 p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedProjectId}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex-1 min-h-0 flex flex-col gap-3"
            >
              <ReportHeader />
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <SCurveChart />
                <FiveWeekChart />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
      <div ref={reportRef} className="px-3 sm:px-4 py-3 sm:py-4 space-y-4 pb-20 sm:pb-6">
        <ReportHeader actions={presentationMode ? undefined : reportActions} />
        <ExecutiveSummary />

        {/* Uma única grade de duas colunas: a ordem, a largura e a altura de
            cada card vêm do layout salvo no projeto. O export em PDF percorre os
            filhos da grade, então o papel sai na mesma ordem da tela. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {layout.map((item, i) => (
            <CardArrumavel
              key={item.id}
              item={item}
              editando={editandoLayout}
              primeiro={i === 0}
              ultimo={i === layout.length - 1}
              onMover={(dir) => setLayoutRelatorio(moverCard(layout, item.id, dir))}
              onLargura={() => setLayoutRelatorio(alternarLargura(layout, item.id))}
              onAltura={(passos) => setLayoutRelatorio(ajustarAltura(layout, item.id, passos))}
              onOculto={() => setLayoutRelatorio(alternarOculto(layout, item.id))}
              onArrastarInicio={() => { arrastando.current = item.id; }}
              onSoltarSobre={() => {
                if (arrastando.current) {
                  setLayoutRelatorio(reordenarCard(layout, arrastando.current, item.id));
                }
                arrastando.current = null;
              }}
            >
              {renderizarCard(item.id)}
            </CardArrumavel>
          ))}
        </div>

        {editandoLayout && (
          <div
            data-pdf-skip
            data-html2canvas-ignore
            className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 print:hidden"
          >
            <p className="text-xs text-muted-foreground">
              Arraste os cards ou use as setas para reordenar. A arrumação vale para
              <strong className="text-foreground"> todo mundo que abrir este projeto</strong>.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setLayoutRelatorio(null)}>
                Restaurar padrão
              </Button>
              <Button size="sm" onClick={() => setEditandoLayout(false)}>Concluir</Button>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-3 text-xs text-muted-foreground border-t border-border"
        >
          One Page Report · Gerado automaticamente
        </motion.div>
      </div>
      )}

      {/* Mobile bottom nav */}
      {!presentationMode && !tvMode && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-card border-t border-border flex justify-around items-stretch h-14 print:hidden">
          <Link to="/" className="flex flex-col items-center justify-center flex-1 gap-0.5 text-primary">
            <FileText className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Relatório</span>
          </Link>
          {canEdit && (
            <Link to="/dados" className="flex flex-col items-center justify-center flex-1 gap-0.5 text-muted-foreground">
              <Database className="h-5 w-5" />
              <span className="text-[10px] font-medium">Dados</span>
            </Link>
          )}
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
