"use server";

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export type SignUpInput = {
  email: string;
  password: string;
  name: string;
  surname: string;
  phone: string;
  role: AppRole;
};

export async function createProfileAfterSignUp(input: SignUpInput, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").insert({
    id: userId,
    name: input.name,
    surname: input.surname,
    phone: input.phone || null,
    email: input.email,
    role: input.role,
  });
  if (error) throw error;
}
