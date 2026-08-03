import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, X, Tv } from 'lucide-react';
import ReportHeader from '@/components/ReportHeader';
import SCurveChart from '@/components/SCurveChart';
import { useProjectStore, useCurrentProject } from '@/store/projectStore';
import { initTheme } from '@/hooks/use-theme';

const DURATIONS = [10, 20, 30, 60];

const TvMode = () => {
  const navigate = useNavigate();
  const { projects, selectedProjectId, selectProject } = useProjectStore();
  const current = useCurrentProject();
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(20);
  const [elapsed, setElapsed] = useState(0);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => { initTheme(); }, []);

  const index = Math.max(0, projects.findIndex((p) => p.id === selectedProjectId));

  const go = useCallback((delta: number) => {
    if (projects.length === 0) return;
    const next = (index + delta + projects.length) % projects.length;
    selectProject(projects[next].id);
    setElapsed(0);
  }, [index, projects, selectProject]);

  // slide timer
  useEffect(() => {
    if (paused || projects.length <= 1) return;
    const tick = 100;
    const id = setInterval(() => {
      setElapsed((e) => {
        const next = e + tick / 1000;
        if (next >= duration) { go(1); return 0; }
        return next;
      });
    }, tick);
    return () => clearInterval(id);
  }, [paused, duration, go, projects.length]);

  // auto-hide controls
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setShowControls(true);
      clearTimeout(t);
      t = setTimeout(() => setShowControls(false), 4000);
    };
    wake();
    window.addEventListener('mousemove', wake);
    return () => { window.removeEventListener('mousemove', wake); clearTimeout(t); };
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { document.exitFullscreen?.().catch(() => {}); navigate('/'); }
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, navigate]);

  const enterFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => {});

  const progress = Math.min(100, (elapsed / duration) * 100);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-muted z-50">
        <div
          className="h-full gradient-primary transition-[width] duration-100 ease-linear"
          style={{ width: `${projects.length > 1 && !paused ? progress : 0}%` }}
        />
      </div>

      {/* Slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedProjectId}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4 }}
          className="px-6 xl:px-10 py-6 max-w-[1900px] mx-auto space-y-4"
        >
          <ReportHeader />
          {Array.isArray(current?.sCurveData) && current.sCurveData.length > 0 && <SCurveChart />}
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="mx-auto mb-4 w-fit flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/95 backdrop-blur border card-shadow-elevated">
          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground">
            <Tv className="h-4 w-4 text-primary" />
            {index + 1}/{projects.length}
          </div>
          <button onClick={() => go(-1)} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center" title="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setPaused((p) => !p)} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center" title={paused ? 'Retomar' : 'Pausar'}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button onClick={() => go(1)} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center" title="Próximo">
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1 pl-2 border-l border-border">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => { setDuration(d); setElapsed(0); }}
                className={`px-2 h-8 rounded-lg text-xs font-semibold transition-colors ${
                  duration === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>

          <button onClick={enterFullscreen} className="px-2 h-9 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted">
            Tela cheia
          </button>
          <button
            onClick={() => { document.exitFullscreen?.().catch(() => {}); navigate('/'); }}
            className="h-9 w-9 rounded-lg hover:bg-destructive/10 text-destructive flex items-center justify-center"
            title="Sair (ESC)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TvMode;
