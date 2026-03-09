"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotificationItem } from "@/components/NotificationBell";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function OwnerNotificationsPage() {
  const { locale } = useLocale();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.resolve({ notifications: [] }))
      .then((json: { notifications?: NotificationItem[] }) => setNotifications(json.notifications ?? []));
  }, []);

  return (
    <Card className="mt-2">
      <CardHeader><CardTitle>{t(locale, "notifications.bellTitle")} ({notifications.length})</CardTitle></CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t(locale, "notifications.noNotificationsYet")}</p>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.recipientId}
                className={`p-4 rounded-lg border ${!n.readAt ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200" : "bg-muted/20"}`}
              >
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-2">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
