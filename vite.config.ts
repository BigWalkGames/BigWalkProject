import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load every env var (no prefix filter) from .env files and process.env.
  const env = loadEnv(mode, process.cwd(), '')

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase env vars: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY ' +
        '(or SUPABASE_ANON_KEY, or the VITE_-prefixed equivalents).',
    )
  }

  // `vercel pull` writes "[SENSITIVE]" for Sensitive env vars, which would
  // otherwise build fine and crash createClient() at runtime (blank page).
  if (!/^https?:\/\//.test(supabaseUrl) || supabaseKey === '[SENSITIVE]') {
    throw new Error(
      'Invalid Supabase env vars: SUPABASE_URL is not an http(s) URL or the key ' +
        'is "[SENSITIVE]". In a CI build this usually means the Vercel env vars ' +
        'are marked Sensitive, so `vercel pull` cannot read them.',
    )
  }

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    },
  }
})
