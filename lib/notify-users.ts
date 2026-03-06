import { SupabaseClient } from "@supabase/supabase-js";
import { getFcmMessaging } from "@/lib/firebase-admin";

/** Send in-app notification to specific users. Creates notification + recipients, optionally sends push. */
export async function notifyUsers(
  admin: SupabaseClient,
  createdByUserId: string,
  userIds: Set<string>,
  title: string,
  body: string | null
): Promise<{ success: boolean; count: number }> {
  if (userIds.size === 0) return { success: true, count: 0 };

  const { data: notif, error: insErr } = await admin.from("notifications").insert({
    title,
    body: body ?? null,
    created_by: createdByUserId,
    target_audience: "both",
    target_unit_types: null,
    unpaid_only: false,
  }).select("id").single();

  if (insErr || !notif?.id) return { success: false, count: 0 };

  const recipientRows = [...userIds].map(uid => ({ notification_id: notif.id, user_id: uid }));
  const { error: recErr } = await admin.from("notification_recipients").insert(recipientRows);
  if (recErr) return { success: false, count: 0 };

  const fcm = getFcmMessaging();
  if (fcm && userIds.size > 0) {
    const { data: tokens } = await admin.from("device_tokens").select("token").in("user_id", [...userIds]);
    if (tokens && (tokens as { token: string }[]).length > 0) {
      const sendPromises = (tokens as { token: string }[]).map(({ token }) =>
        fcm.send({
          token,
          notification: { title, body: body ?? undefined },
          data: { notificationId: notif.id },
        }).catch(() => null)
      );
      await Promise.allSettled(sendPromises);
    }
  }

  return { success: true, count: recipientRows.length };
}
