"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createUser(
  email: string,
  password: string,
  name: string,
  surname: string,
  phone: string,
  role: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/users/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, surname, phone, role }),
    });

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/dashboard/manager");
    return { success: true, userId: result.userId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create user" };
  }
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function assignUnitToOwner(
  unitId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { data: existing } = await supabase
    .from("unit_owners")
    .select("id")
    .eq("unit_id", unitId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Unit already has an owner. Remove current owner first." };
  }

  const { error } = await supabase.from("unit_owners").insert({
    unit_id: unitId,
    owner_id: ownerId,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function removeUnitOwner(unitId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("unit_owners").delete().eq("unit_id", unitId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function assignUnitToTenant(
  unitId: string,
  tenantId: string,
  isPaymentResponsible: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { data: existing } = await supabase
    .from("unit_tenant_assignments")
    .select("id")
    .eq("unit_id", unitId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Unit already has a tenant. Remove current tenant first." };
  }

  const { error } = await supabase.from("unit_tenant_assignments").insert({
    unit_id: unitId,
    tenant_id: tenantId,
    is_payment_responsible: isPaymentResponsible,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}

export async function removeUnitTenant(unitId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("unit_tenant_assignments").delete().eq("unit_id", unitId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/manager");
  return { success: true };
}
