import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/notifications/read - mark notification as read
export async function POST(request: Request) {
  // #region agent log
  try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/read/route.ts:entry',message:'POST /api/notifications/read entered',data:{},timestamp:Date.now(),hypothesisId:'R1'})}).catch(()=>{}); } catch {}
  // #endregion
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { recipientId } = body;
    if (!recipientId) return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });

    const { error } = await sb
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("id", recipientId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    // #region agent log
    try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'notifications/read/route.ts:catch',message:'read route threw',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'R2'})}).catch(()=>{}); } catch {}
    // #endregion
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
