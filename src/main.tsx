import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Auto-update PWA: quando uma nova versão for publicada, recarrega automaticamente.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (!isInIframe && !isPreviewHost && "serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nova versão detectada: aplica e recarrega.
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      // Verifica atualizações a cada 60s enquanto o app estiver aberto.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60_000);
      }
    },
  });
}
