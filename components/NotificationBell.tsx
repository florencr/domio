"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NotificationItem = {
  recipientId: string;
  readAt: string | null;
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

type NotificationBellProps = {
  isManager?: boolean;
  onSendClick?: () => void;
};

export function NotificationBell({ isManager, onSendClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setNotifications(json.notifications ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open]);

  const markRead = async (recipientId: string) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId }),
    });
    setNotifications(prev => prev.map(n => n.recipientId === recipientId ? { ...n, readAt: new Date().toISOString() } : n));
  };

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[360px] overflow-y-auto">
        {isManager && onSendClick && (
          <>
            <button
              type="button"
              className="w-full px-2 py-2 text-sm font-medium text-blue-600 hover:bg-accent rounded-sm text-left"
              onClick={() => { onSendClick(); setOpen(false); }}
            >
              + Send notification
            </button>
            <div className="h-px bg-border mx-2" />
          </>
        )}
        {loading ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">No notifications</div>
        ) : (
          notifications.map(n => (
            <button
              key={n.recipientId}
              type="button"
              className={`w-full text-left px-3 py-2 rounded-sm hover:bg-accent transition-colors ${!n.readAt ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
              onClick={() => { if (!n.readAt) markRead(n.recipientId); }}
            >
              <p className="text-sm font-medium truncate">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
              <p className="text-xs text-muted-foreground mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
