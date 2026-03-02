import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  // #region agent log
  try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/route.ts:entry',message:'GET /api/notifications entered',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{}); } catch {}
  // #endregion
  try {
    const sb = await createClient();
    // #region agent log
    try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/route.ts:afterCreateClient',message:'createClient ok',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{}); } catch {}
    // #endregion
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // #region agent log
    try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/route.ts:afterGetUser',message:'user ok',data:{userId:user.id},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{}); } catch {}
    // #endregion

    const { data, error } = await sb
      .from("notification_recipients")
      .select("id, read_at, notifications!inner(id, title, body, created_at)")
      .eq("user_id", user.id)
      .limit(100);

    // #region agent log
    try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/route.ts:afterQuery',message:'query done',data:{error:error?.message,rowCount:data?.length??0},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{}); } catch {}
    // #endregion

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const raw = data || [];
    const items: Array<{ recipientId: string; readAt: string | null; id: string; title: string; body: string | null; created_at: string }> = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const notif = Array.isArray(row.notifications) ? row.notifications[0] : row.notifications;
      if (notif && notif.id) {
        items.push({
          recipientId: row.id,
          readAt: row.read_at,
          id: notif.id,
          title: notif.title || "",
          body: notif.body,
          created_at: notif.created_at,
        });
      }
    }

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return NextResponse.json({ notifications: items });
  } catch (e) {
    // #region agent log
    try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/route.ts:catch',message:'exception',data:{err:String(e),msg:e instanceof Error?e.message:'?'},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{}); } catch {}
    // #endregion
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
