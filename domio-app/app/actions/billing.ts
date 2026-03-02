"use server";

import { createClient } from "@/lib/supabase/server";

async function ensureManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  
  if (error) {
    console.error("Profile fetch error:", error);
    throw new Error("Failed to verify role");
  }
  
  if (profile?.role !== "manager") throw new Error("Only managers can do this");
  return supabase;
}

export async function generateBills(periodMonth: number, periodYear: number) {
  const supabase = await ensureManager();

  const { data: units } = await supabase.from("units").select("id, building_id, type, size_m2");
  if (!units?.length) return { success: true, created: 0, skipped: 0 };

  const { data: recurrentServices } = await supabase
    .from("services")
    .select("id, name, unit_type, pricing_model, price_value")
    .eq("frequency", "recurrent");
  if (!recurrentServices) return { success: false, error: "Failed to load services" };

  const { data: recurrentExpenses } = await supabase
    .from("expenses")
    .select("id, category, vendor, amount, building_id")
    .eq("frequency", "recurrent");
  if (!recurrentExpenses) return { success: false, error: "Failed to load expenses" };

  const unitsByBuilding = new Map<string, typeof units>();
  for (const u of units) {
    const list = unitsByBuilding.get(u.building_id) ?? [];
    list.push(u);
    unitsByBuilding.set(u.building_id, list);
  }

  let created = 0;
  let skipped = 0;

  for (const unit of units) {
    const { data: existing } = await supabase
      .from("bills")
      .select("id, status")
      .eq("unit_id", unit.id)
      .eq("period_month", periodMonth)
      .eq("period_year", periodYear)
      .single();
    if (existing && existing.status !== "reversed") {
      skipped++;
      continue;
    }
    if (existing?.status === "reversed") {
      await supabase.from("bills").delete().eq("id", existing.id);
    }

    const lines: { line_type: string; reference_id: string | null; description: string; amount: number }[] = [];
    let total = 0;

    for (const s of recurrentServices) {
      if (s.unit_type !== unit.type) continue;
      const amount =
        s.pricing_model === "per_m2"
          ? Number(s.price_value) * (unit.size_m2 ?? 0)
          : Number(s.price_value);
      lines.push({
        line_type: "service",
        reference_id: s.id,
        description: s.name,
        amount: Math.round(amount * 100) / 100,
      });
      total += amount;
    }

    const buildingUnits = unitsByBuilding.get(unit.building_id) ?? [];
    const unitCount = buildingUnits.length || 1;
    for (const e of recurrentExpenses) {
      if (e.building_id != null && e.building_id !== unit.building_id) continue;
      const share = Number(e.amount) / unitCount;
      const amount = -Math.round(share * 100) / 100;
      lines.push({
        line_type: "expense",
        reference_id: e.id,
        description: `${e.category} – ${e.vendor}`,
        amount,
      });
      total += amount;
    }

    total = Math.round(total * 100) / 100;

    const { data: newBill, error: billErr } = await supabase
      .from("bills")
      .insert({
        unit_id: unit.id,
        period_month: periodMonth,
        period_year: periodYear,
        total_amount: total,
        status: "draft",
      })
      .select("id")
      .single();
    if (billErr || !newBill) return { success: false, error: billErr?.message ?? "Failed to create bill" };

    for (const line of lines) {
      await supabase.from("bill_lines").insert({
        bill_id: newBill.id,
        line_type: line.line_type,
        reference_id: line.reference_id,
        description: line.description,
        amount: line.amount,
      });
    }
    created++;
  }

  return { success: true, created, skipped };
}

export async function reverseBills(periodMonth: number, periodYear: number) {
  const supabase = await ensureManager();

  const { data: bills } = await supabase
    .from("bills")
    .select("id")
    .eq("period_month", periodMonth)
    .eq("period_year", periodYear);
  if (!bills?.length) return { success: true, deleted: 0 };

  for (const b of bills) {
    await supabase.from("bill_lines").delete().eq("bill_id", b.id);
    await supabase.from("bills").delete().eq("id", b.id);
  }
  return { success: true, deleted: bills.length };
}

export async function markBillAsPaid(billId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await ensureManager();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("bills")
      .update({ paid_at: new Date().toISOString(), paid_by: user.id })
      .eq("id", billId);
    
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function markBillAsUnpaid(billId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await ensureManager();
    const { error } = await supabase
      .from("bills")
      .update({ paid_at: null, paid_by: null })
      .eq("id", billId);
    
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
