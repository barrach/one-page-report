import { useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@budget/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/components/ui/popover";
import { ScrollArea } from "@budget/components/ui/scroll-area";
import { useNotifications, type Notification } from "@budget/hooks/useNotifications";
import { cn } from "@budget/lib/utils";

const NotificationBell = () => {
  const { notifications, unreadCount, acceptInvite, declineInvite, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "accepted": return <span className="text-[10px] text-emerald-400 font-medium">Aceito</span>;
      case "declined": return <span className="text-[10px] text-destructive font-medium">Recusado</span>;
      case "read": return <span className="text-[10px] text-muted-foreground">Lida</span>;
      default: return null;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-muted-foreground">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</p>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 transition-colors",
                    n.status === "unread" && "bg-primary/5"
                  )}
                  onClick={() => n.status === "unread" && markAsRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                        {statusBadge(n.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(n.created_at)}</span>
                  </div>
                  {n.type === "convite_projeto" && n.status === "unread" && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); acceptInvite(n); }}
                      >
                        <Check className="w-3 h-3" /> Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); declineInvite(n); }}
                      >
                        <X className="w-3 h-3" /> Recusar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
