"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export function PushNotificationSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        const status = permStatus.receive === "prompt"
          ? (await PushNotifications.requestPermissions()).receive
          : permStatus.receive;
        if (status !== "granted") return;

        handle = await PushNotifications.addListener("registration", async (token) => {
          const platform = Capacitor.getPlatform() as "ios" | "android";
          if (platform !== "ios" && platform !== "android") return;
          try {
            const res = await fetch("/api/notifications/register-device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: token.value, platform }),
            });
            if (!res.ok) console.warn("Push device registration failed:", await res.text());
          } catch (err) {
            console.warn("Push device registration error:", err);
          }
        });

        await PushNotifications.register();
      } catch (err) {
        console.warn("Push notification setup error:", err);
      }
    };

    setup();
    return () => {
      if (handle) handle.remove();
    };
  }, []);

  return null;
}
