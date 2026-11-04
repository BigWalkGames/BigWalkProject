import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts, which throws without Supabase env vars. Tests fake Supabase.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
