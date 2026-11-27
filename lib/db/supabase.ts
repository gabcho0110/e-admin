import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function supabaseServiceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function isSupabaseConfigured(): boolean {
  if (process.env.DATA_MODE === "local") return false;
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

/**
 * Сървърен клиент с service role.
 * Използва се САМО в server actions/route handlers след проверка на права —
 * RLS остава втора линия на защита при директен достъп с anon ключ.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase не е конфигуриран.");
  }
  if (!cached) {
    cached = createClient(supabaseUrl(), supabaseServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "X-Client-Info": "pig-e-admin/1.0" } },
    });
  }
  return cached;
}

let cachedAuth: SupabaseClient | null = null;

/**
 * Клиент с anon ключ — използва се САМО за проверка на парола срещу
 * Supabase Auth (когато профилът няма локален scrypt хеш).
 * Никога не се използва за четене на таблици.
 */
export function supabaseAuthClient(): SupabaseClient | null {
  const anon = supabaseAnonKey();
  if (!isSupabaseConfigured() || !anon) return null;
  if (!cachedAuth) {
    cachedAuth = createClient(supabaseUrl(), anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "X-Client-Info": "pig-e-admin/1.0" } },
    });
  }
  return cachedAuth;
}

/** Проверява парола срещу Supabase Auth. Връща false при липса на конфигурация. */
export async function verifySupabasePassword(email: string, password: string): Promise<boolean> {
  const client = supabaseAuthClient();
  if (!client) return false;
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
