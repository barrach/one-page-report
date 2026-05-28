import { useState, useEffect } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@budget/components/ui/button";
import { Card } from "@budget/components/ui/card";
import { usePwaInstall } from "@budget/hooks/usePwaInstall";

const InstallPrompt = () => {
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    // Delay showing prompt
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) handleDismiss();
  };

  if (isInstalled || dismissed || !show) return null;
  if (!canInstall && !isIos) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-card border-primary/20 shadow-xl max-w-md mx-auto animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-lg shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Instalar MegaBudget</h3>
          {isIos ? (
            <p className="text-xs text-muted-foreground mt-1">
              Toque em <Share className="w-3 h-3 inline" /> <strong>Compartilhar</strong> e depois em <Plus className="w-3 h-3 inline" /> <strong>Adicionar à Tela de Início</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Acesse mais rápido direto da sua área de trabalho
            </p>
          )}
          {canInstall && (
            <Button size="sm" className="mt-2 h-7 text-xs gap-1" onClick={handleInstall}>
              <Download className="w-3.5 h-3.5" />
              Instalar
            </Button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-muted-foreground"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};

export default InstallPrompt;
