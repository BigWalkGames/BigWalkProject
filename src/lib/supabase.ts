import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

// Created on first use, not at import time, so a bad env var can't crash app startup.
export function getSupabase(): SupabaseClient {
  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
