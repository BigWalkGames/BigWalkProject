import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Creates the client on first use, so bad env vars (e.g. the "[SENSITIVE]"
 * placeholder in CI preview builds) throw where it's called, which callers
 * can handle, instead of crashing the whole app at startup.
 */
export function getSupabase(): SupabaseClient {
  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
