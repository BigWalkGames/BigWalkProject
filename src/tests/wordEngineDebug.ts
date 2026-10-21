import { BACKSPACE, cleanKeystrokes, type Keystroke } from '../features/word-engine'

const SLOW_KEY_MS = 5000

function samePosition(a: Keystroke, b: Keystroke): boolean {
  return a.wordIndex === b.wordIndex && a.charIndex === b.charIndex
}

/** Checks the log against the keystroke contract in word-engine/README.md. Returns the problems found. */
function findProblems(log: Keystroke[]): string[] {
  const problems: string[] = []
  const flag = (i: number, message: string) => problems.push(`#${i}: ${message}`)

  if (log.length > 0 && log[0].latencyMs !== 0) {
    flag(0, `first latencyMs is ${log[0].latencyMs}, expected 0`)
  }

  log.forEach((k, i) => {
    const prev = log[i - 1]

    if (!Number.isFinite(k.latencyMs) || k.latencyMs < 0) {
      flag(i, `invalid latencyMs ${k.latencyMs}`)
    } else if (k.latencyMs > SLOW_KEY_MS) {
      flag(i, `latencyMs ${Math.round(k.latencyMs)} is over ${SLOW_KEY_MS} (lastKeyTs not updating?)`)
    }

    if (k.expected === ' ' && k.charIndex === 0) {
      flag(i, 'space has charIndex 0, expected the previous word\'s length')
    }

    if (prev && k.wordIndex - prev.wordIndex > 1) {
      flag(i, `wordIndex jumped ${prev.wordIndex} -> ${k.wordIndex} (board space words counted?)`)
    }

    if (!prev) return

    // A backspace right after a typed key erases that key, so the positions match.
    if (k.typed === BACKSPACE && prev.typed !== BACKSPACE && !samePosition(k, prev)) {
      flag(i, `backspace at ${k.wordIndex}:${k.charIndex} but the key it erased was at ${prev.wordIndex}:${prev.charIndex}`)
    }

    // A retype after a single backspace reuses the same position.
    if (k.typed !== BACKSPACE && prev.typed === BACKSPACE && !samePosition(k, prev)) {
      flag(i, `retype at ${k.wordIndex}:${k.charIndex} but the backspace before it was at ${prev.wordIndex}:${prev.charIndex}`)
    }
  })

  return problems
}

/** Temporary debugging aid: logs an engine keystroke log, contract problems, and what cleanKeystrokes makes of it. */
export function debugEngineLog(log: Keystroke[]): void {
  console.group(`[word-engine] ${log.length} keystrokes`)

  console.table(
    log.map((k, i) => ({
      '#': i,
      word: k.wordIndex,
      char: k.charIndex,
      expected: k.expected,
      typed: k.typed,
      latencyMs: Math.round(k.latencyMs),
    })),
  )

  const problems = findProblems(log)
  if (problems.length === 0) {
    console.log('Contract check: no problems found.')
  } else {
    console.warn(`Contract check: ${problems.length} problem(s)`)
    problems.forEach((p) => console.warn(p))
  }

  const samples = cleanKeystrokes(log)
  console.log(`cleanKeystrokes: ${samples.latencies.length} latency samples, ${samples.errors.length} error samples`)
  console.table(samples.latencies)
  console.table(samples.errors)

  console.groupEnd()
}
