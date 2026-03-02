"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PricingModel, ServiceFrequency } from "@/types/database";

async function getSupabase() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Not authenticated" };
  // Skip profile role check – RLS will block non-managers; avoids " schema cache" issues
  return { supabase, error: null };
}

export async function createBuilding(name: string, address: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("buildings").insert({ name, address });
  if (error) return { success: false, error: `${error.message} (${error.code ?? "unknown"})` };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function updateBuilding(id: string, name: string, address: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("buildings").update({ name, address }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteBuilding(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { data: units } = await supabase.from("units").select("id").eq("building_id", id).limit(1);
  if (units && units.length > 0)
    return { success: false, error: "Cannot delete: building has units. Remove or reassign units first." };
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function createUnit(
  buildingId: string,
  unitName: string,
  unitTypeName: string,
  sizeM2: number | null,
  block: string | null,
  entrance: string | null,
  floor: string | null
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("units").insert({
    building_id: buildingId,
    unit_name: unitName,
    type: unitTypeName,
    size_m2: sizeM2 ?? null,
    block: block || null,
    entrance: entrance || null,
    floor: floor || null,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function updateUnit(
  id: string,
  buildingId: string,
  unitName: string,
  unitTypeName: string,
  sizeM2: number | null,
  block: string | null,
  entrance: string | null,
  floor: string | null
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("units").update({
    building_id: buildingId,
    unit_name: unitName,
    type: unitTypeName,
    size_m2: sizeM2 ?? null,
    block: block || null,
    entrance: entrance || null,
    floor: floor || null,
  }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteUnit(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function createService(
  name: string,
  unitTypeName: string,
  pricingModel: PricingModel,
  priceValue: number,
  frequency: ServiceFrequency
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("services").insert({
    name,
    unit_type: unitTypeName,
    pricing_model: pricingModel,
    price_value: priceValue,
    frequency,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function updateService(
  id: string,
  name: string,
  unitTypeName: string,
  pricingModel: PricingModel,
  priceValue: number,
  frequency: ServiceFrequency
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("services").update({
    name,
    unit_type: unitTypeName,
    pricing_model: pricingModel,
    price_value: priceValue,
    frequency,
  }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteService(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function createUnitType(name: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("unit_types").insert({ name: name.trim() });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

async function isUnitTypeInUse(supabase: Awaited<ReturnType<typeof createClient>>, typeName: string) {
  const [unitsRes, servicesRes] = await Promise.all([
    supabase.from("units").select("id").eq("type", typeName).limit(1),
    supabase.from("services").select("id").eq("unit_type", typeName).limit(1),
  ]);
  const unitsUsed = (unitsRes.data?.length ?? 0) > 0;
  const servicesUsed = (servicesRes.data?.length ?? 0) > 0;
  return unitsUsed || servicesUsed;
}

export async function updateUnitType(id: string, newName: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { data: row } = await supabase.from("unit_types").select("name").eq("id", id).single();
  if (!row) return { success: false, error: "Unit type not found" };
  if (await isUnitTypeInUse(supabase, row.name))
    return { success: false, error: "Cannot edit: this type is used by units or services" };
  const { error } = await supabase.from("unit_types").update({ name: newName.trim() }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function createServiceCategory(name: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("service_categories").insert({ name: name.trim() });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function updateServiceCategory(id: string, newName: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("service_categories").update({ name: newName.trim() }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteServiceCategory(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("service_categories").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function createVendor(name: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("vendors").insert({ name: name.trim() });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function updateVendor(id: string, newName: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("vendors").update({ name: newName.trim() }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteVendor(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteUnitType(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { data: row } = await supabase.from("unit_types").select("name").eq("id", id).single();
  if (!row) return { success: false, error: "Unit type not found" };
  if (await isUnitTypeInUse(supabase, row.name))
    return { success: false, error: "Cannot delete: this type is used by units or services" };
  const { error } = await supabase.from("unit_types").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function createExpense(
  title: string,
  category: string,
  vendor: string,
  amount: number,
  frequency: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("expenses").insert({
    title,
    category,
    vendor,
    amount,
    frequency,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function updateExpense(
  id: string,
  title: string,
  category: string,
  vendor: string,
  amount: number,
  frequency: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("expenses").update({
    title,
    category,
    vendor,
    amount,
    frequency,
  }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function markExpenseAsPaid(expenseId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("expenses")
    .update({ paid_at: new Date().toISOString(), paid_by: user.id })
    .eq("id", expenseId);
  
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function markExpenseAsUnpaid(expenseId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authErr } = await getSupabase();
  if (authErr || !supabase) return { success: false, error: authErr ?? "Not authenticated" };
  
  const { error } = await supabase
    .from("expenses")
    .update({ paid_at: null, paid_by: null })
    .eq("id", expenseId);
  
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}
