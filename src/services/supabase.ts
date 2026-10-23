import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type BonAppetitClient = SupabaseClient<Database>;

let browserClient: BonAppetitClient | undefined;

function envString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function supabaseProjectUrl(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

export function getSupabaseClient(): BonAppetitClient {
  if (!browserClient) {
    const url = supabaseProjectUrl(envString(import.meta.env.VITE_SUPABASE_URL));
    const anonKey = envString(import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (!url || !anonKey) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    }
    browserClient = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
