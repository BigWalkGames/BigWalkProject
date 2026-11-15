// Runs the word engine tests. See scripts/word-engine-tests.md.
// Usage: node scripts/test-word-engine.mjs [vitest options]

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VITEST = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))

const TEST_FILES = [
  'src/features/word-engine/engine.test.ts',
  'src/features/typing/player/playerStore.test.ts',
  'src/features/typing/wordbank/loadWordBank.test.ts',
  'src/features/typing/wordbank/wordBankDebug.test.ts',
]

if (!existsSync(VITEST)) {
  console.error('Vitest is not installed. Run `pnpm install` first.')
  process.exit(1)
}

const { status, error } = spawnSync(
  process.execPath,
  [VITEST, 'run', ...TEST_FILES, ...process.argv.slice(2)],
  { cwd: ROOT, stdio: 'inherit' },
)

if (error) {
  console.error(error)
  process.exit(1)
}
process.exit(status ?? 1)
