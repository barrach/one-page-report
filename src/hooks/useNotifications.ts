// Notificações nativas do SO (Web Notifications API)
export function useNotifications() {
  const supported = typeof window !== 'undefined' && 'Notification' in window;

  const requestPermission = async (): Promise<boolean> => {
    if (!supported) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  const notify = (title: string, options?: NotificationOptions) => {
    if (!supported || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
    } catch {
      /* alguns navegadores exigem SW.showNotification — ignora silenciosamente */
    }
  };

  return { supported, permission: supported ? Notification.permission : 'denied', requestPermission, notify };
}
