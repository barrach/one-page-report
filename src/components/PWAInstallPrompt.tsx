import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'megahub_pwa_dismissed';
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const isDismissed = () => {
  const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

const isIOSorMac = () =>
  /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/chrome|crios|edg/i.test(navigator.userAgent);

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showMacHint, setShowMacHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Safari (Mac/iOS) não dispara beforeinstallprompt — mostra instrução manual
    if (isIOSorMac()) { setShowMacHint(true); setShow(true); }

    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setShow(false);
    else dismiss();
    setDeferred(null);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-1.5rem)] max-w-md rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
      style={{ backgroundColor: '#002054', color: '#fff' }}
    >
      <Download className="h-5 w-5 shrink-0 text-white/80" />
      {showMacHint ? (
        <div className="flex-1 text-xs leading-snug">
          Para instalar: toque em <Share className="inline h-3.5 w-3.5 mx-0.5" /> <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
        </div>
      ) : (
        <div className="flex-1 text-sm font-medium">Instalar One Page Report como app</div>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        {!showMacHint && (
          <button onClick={install} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors">
            Instalar
          </button>
        )}
        <button onClick={dismiss} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="Agora não">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
