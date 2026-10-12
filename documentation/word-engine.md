# WordEngine

The WordEngine builds each Solo Time Attack word bank from the player's own
typing data: it estimates a **skill level**, finds the player's **weak keys**,
and picks words at the right difficulty with a share of them packed with
those weak keys. Every finished test feeds back in, so the next bank adapts.

| | |
|---|---|
| **Code** | [`src/features/word-engine/`](../src/features/word-engine/) (import from `src/features/word-engine`) |
| **Tests** | [`tests/word-engine/`](../tests/word-engine/), run with `pnpm test` |
| **Owner** | Justin Dela Cruz |
| **Runs** | In the client (MVP decision): solo play needs no game server |
| **Dependencies** | None. Pure TypeScript; no new packages |

---

## Contents
1. [Quick start](#1-quick-start)
2. [How it works](#2-how-it-works)
3. [Public API](#3-public-api)
4. [Hooks into the existing app](#4-hooks-into-the-existing-app)
5. [Guide for each teammate](#5-guide-for-each-teammate)
6. [Tuning](#6-tuning)
7. [Design decisions](#7-design-decisions)
8. [Testing](#8-testing)
9. [Limitations and next steps](#9-limitations-and-next-steps)
10. [File map](#10-file-map)

---

## 1. Quick start

### Use it in a screen (what `Game.tsx` does)

```tsx
import { useState } from 'react'
import { TypingTest } from './features/typing/components/TypingTest'
import { createSoloWordBankLoader, soloStatsSink } from './features/word-engine'

function SoloTimeAttack() {
  // Create the loader ONCE so `loader.load` keeps the same identity.
  const [loader] = useState(() => createSoloWordBankLoader())
  return <TypingTest durationMs={30_000} loadBank={loader.load} statsSink={soloStatsSink} />
}
```

That's the whole integration:
- `loadBank={loader.load}`: words come from the engine instead of a random pick.
- `statsSink={soloStatsSink}`: each finished test is logged to the console
  (as before) **and** saved to the session history the engine reads.

### Use the engine directly

```ts
import { createWordEngine, profileFromResults } from './features/word-engine'

const engine = createWordEngine()
const player = profileFromResults(recentTestResults)   // null if no history
const bank = engine.build(words, player, { count: 20 })

bank.words      // ['quick', 'jazz', ...]  <- give these to the game
bank.skill      // 57.2
bank.weakKeys   // ['q', 'z', 'j']
```

---

## 2. How it works

### Architecture map

The architecture map is in
[word-engine-architecture.drawio](word-engine-architecture.drawio)
(open it with draw.io / diagrams.net, or the Draw.io VS Code extension).
Inputs are at the top, the word bank at the bottom, and each box names
its file and technology.

- **Entry points:** words (Supabase, falling back to the offline list),
  player data (keystrokes → `TestResult` → browser storage), and global
  typing data (placeholder table in `config.ts`).
- **Exit point:** `adaptiveWordBank.load()` returns `{ words, source }`,
  which `TypingTest` takes as `loadBank` and `createBoard` displays.
- **Feedback loop:** a finished test is saved, the next Restart reads it
  from history, and the next bank adapts.

Inside `engine.build`:

1. **Per-key accuracy.** For each letter a–z:
   - typed before → `(correct + 10 × overall) / (attempts + 10)`. The `+10`
     ("smoothing") stops a letter typed twice from swinging the result;
     a letter typed 200 times is trusted.
   - never typed → the app-wide (global) accuracy for that letter.
2. **Skill level, 0–100.**
   `skill = 50% × min(WPM / 120, 1) + 30% × S(overall accuracy) + 20% × S(mean letter accuracy)`
   where `S` stretches accuracy so **75% or less counts as 0** and 100%
   counts as 1. Without the stretch everyone scores at least ~40, because
   real accuracy is almost always above 80%.
3. **Weak keys.** Up to 5 letters below the player's own average, weakest
   first. A player with even accuracy has none.
4. **Word difficulty.** Every word in the collection is rated 0–100 by
   percentile (60% length + 40% letter rarity), so any word list works
   without retuning: "difficulty 70" means "harder than 70% of this list".
5. **Pick the bank.** The target difficulty is the skill (± 20 for
   easy/hard). A share of the bank (30% at skill 0 → 60% at skill 100) is
   drawn from words dense in weak keys; the rest are random words within
   ±15 difficulty points of the target. Words from the previous bank are
   avoided so restarts feel fresh.

**Worked example:** a 55 WPM, 92%-accurate typist weak on `j k v y`
scores ~56. Their bank centres on mid-difficulty words, and ~10 of 20
words contain j, k, v or y.

---

## 3. Public API

Everything below is exported from `src/features/word-engine/index.ts`.
Anything not listed is internal.

### Engine

#### `createWordEngine(options?): WordEngine`

| Option | Type | Default | |
|---|---|---|---|
| `config` | `Partial<EngineConfig>` | `DEFAULT_ENGINE_CONFIG` | Override any tuning value. |
| `globalKeys` | `GlobalKeyAccuracy` | `DEFAULT_GLOBAL_KEYS` | App-wide accuracy per letter. Pass `{}` for none. |

Throws `WordEngineError` for an invalid config or global data.

#### `WordEngine`

| Method | Returns | |
|---|---|---|
| `build(words, player, request?)` | `WordBankResult` | The bank plus its reasoning. |
| `select(words, player, request?)` | `string[]` | Just the words. |
| `skillLevel(player)` | `number` | 0–100. |
| `keyAccuracy(player)` | `Record<Letter, number>` | Smoothed accuracy for all 26 letters. |
| `weakKeys(keyAccuracy)` | `Letter[]` | Weakest first. |
| `config` | `Readonly<EngineConfig>` | The resolved config. |

- `words`: any iterable of strings. Non a–z words and duplicates are dropped.
- `player`: `PlayerData`, or `null` for a new player.

#### `BankRequest` (all optional)

| Field | Type | Default | |
|---|---|---|---|
| `count` | `number` | `20` | Words to return. |
| `difficulty` | `'easy' \| 'adaptive' \| 'hard'` | `'adaptive'` | Shifts the target by −20 / 0 / +20. |
| `targetDifficulty` | `number` 0–100 | — | Absolute target; overrides `difficulty`. |
| `avoid` | `string[]` | `[]` | Left out if enough other words remain. |
| `seed` | `number` | random | Same seed + same inputs = same bank. |

#### `WordBankResult`

| Field | Type | |
|---|---|---|
| `words` | `string[]` | Unique, shuffled. Fewer than `count` only if the collection is smaller. |
| `skill` | `number` | 0–100. |
| `targetDifficulty` | `number` | The difficulty the bank centres on. |
| `meanDifficulty` | `number` | Average difficulty of the returned words. |
| `weakKeys` | `Letter[]` | Targeted letters, weakest first. |
| `weakRatio` | `number` | Intended share of weak-key words, 0–1. |
| `weakWordCount` | `number` | Words actually picked for weak keys. |
| `keyAccuracy` | `Record<Letter, number>` | Smoothed per-letter accuracy. |

#### `PlayerData` / `KeyCounts`

```ts
interface KeyCounts  { attempts: number; correct: number }      // may be fractional
interface PlayerData { wpm: number; accuracy: number; perKey: Partial<Record<string, KeyCounts>> }
```

A single `TestResult` already fits `PlayerData`. Keys that aren't a–z
(e.g. `' '`) are ignored. A missing `perKey` means no per-key data.

#### `WordEngineError`
Thrown for invalid input: accuracy outside 0–1, negative WPM,
`correct > attempts`, unknown difficulty, `count < 1`, no usable words,
bad config. Never thrown just because the collection is small.

#### Constants
- `DEFAULT_ENGINE_CONFIG`: see [Tuning](#6-tuning).
- `DEFAULT_GLOBAL_KEYS`: placeholder app-wide accuracy per letter
  (0.97 for `e` down to 0.859 for `z`, based on how rare each letter is).
  Replace it with real data when available (§5).
- `LETTERS`, type `Letter`.

### Player data

#### `profileFromResults(results, options?): PlayerData | null`
Combines a player's recent results into one `PlayerData`. Returns `null`
for no history.

| Option | Default | |
|---|---|---|
| `maxResults` | `20` | Only the newest N results count. |
| `decay` | `0.87` | Each older result counts 0.87× the next newer one (~5-test half-life). `1` = equal weight. |

- `perKey`: recency-weighted sums of attempts and correct.
- `wpm`: weighted by recency and test length.
- `accuracy`: weighted correct / attempts over all tracked keys.

Input only needs `wpm, accuracy, perKey, durationMs, completedAt`, so
rows read back from the database work without the keystroke log.

#### `PlayerHistory`
```ts
interface PlayerHistory { getRecentResults(limit: number): Promise<TestResult[]> }
```
The engine's only view of history. Swap the storage behind it freely.

#### `createLocalPlayerHistory(storage, options?): LocalPlayerHistory`
Browser-storage history. It is both a `PlayerHistory` and a `StatsSink`,
plus `count()` and `clear()`.
- `storage`: `localStorage`, any `StorageLike`, or a getter returning one.
- `options.key`: default `'bigwalk.wordEngine.history.v1'`.
- `options.maxStored`: default `50`.

The keystroke log is dropped before saving. Corrupted or missing storage
reads as "no history"; saving without storage rejects, so the results
panel shows "Couldn't save".

#### `combineStatsSinks(...sinks): StatsSink`
Saves to every sink and rejects if any fails. Used to keep console logging
and feed the engine at the same time; later, Supabase plus local.

### Game integration

#### `createAdaptiveWordBankLoader(options): AdaptiveWordBankLoader`

| Option | Required | |
|---|---|---|
| `engine` | yes | A `WordEngine`. |
| `loadWords` | yes | `() => Promise<LoadedWordBank>`: normally `loadWordBank`. |
| `history` | no | A `PlayerHistory`. Omit to always build as for a new player. |
| `request` | no | `count` / `difficulty` / `targetDifficulty`, or a function returning them (re-read each load, e.g. from settings). |
| `profile` | no | `ProfileOptions`. |
| `avoidRepeats` | no | Default `true`: skip the previous bank's words. |
| `onResult` | no | `(info: AdaptiveBankInfo) => void`, called after every load. |

Returns `{ load, lastBank }`:
- `load()` has the **same contract as `loadWordBank()`**: it resolves with
  `{ words, source }` and never rejects. If history fails, it builds for a
  new player. If the engine throws, it returns the plain loaded words.
  It has a stable identity, so it's safe as a React prop or dependency.
- `lastBank()` returns the previous bank's words.

`AdaptiveBankInfo`: `{ result, player, historyCount, source, error? }`.

#### Ready-made session wiring (`session.ts`)

| Export | |
|---|---|
| `wordEngine` | The app's engine (default config, placeholder global data). |
| `soloHistory` | `createLocalPlayerHistory(localStorage)`. Survives reloads, like a Guest session. |
| `soloStatsSink` | `combineStatsSinks(consoleStatsSink, soloHistory)`. |
| `createSoloWordBankLoader({ request?, onResult? })` | Adaptive loader using all of the above. |

---

## 4. Hooks into the existing app

### Existing interfaces the engine uses (unchanged)

| Existing code | How the engine uses it |
|---|---|
| `wordbank/loadWordBank.ts` `loadWordBank()` | The word source. It already handles Supabase, the 3-second timeout, the offline fallback and cleaning. The engine adds no word fetching. |
| `wordbank/types.ts` `LoadedWordBank` | The adaptive loader returns this same shape, so the game can't tell the difference. |
| `stats/types.ts` `TestResult`, `KeyStats` | Engine input. `perKey` `{attempts, correct}` is read directly. |
| `stats/types.ts` `StatsSink` | `soloHistory` is a sink; `combineStatsSinks` composes sinks. |
| `stats/consoleStatsSink.ts` | Kept in `soloStatsSink`, so console logging still happens. |
| `models/Board.ts` `createBoard(bank)` | Receives the engine's 20 words and repeats them across the board. |

### Changes to existing files (all backwards compatible)

| File | Change |
|---|---|
| `features/typing/useTypingTest.ts` | New optional 2nd parameter `loadBank` (default `loadWordBank`); `load` depends on it. |
| `features/typing/components/TypingTest.tsx` | New optional prop `loadBank`, passed to `useTypingTest`. |
| `src/Game.tsx` | Uses the adaptive loader and `soloStatsSink`; shows the dev-only debug panel. |
| `package.json` | New script: `"test": "node --test \"tests/**/*.test.ts\""`. No new dependencies. |
| `tsconfig.json` | References the new `tsconfig.test.json`, so `pnpm build` typechecks the tests. |

Without the new prop, `TypingTest` behaves exactly as before.

### Dev debug panel
In `pnpm dev`, the solo screen shows a **WordEngine (dev)** panel: the
player profile, skill, target difficulty, weak keys with their accuracy,
and the bank with weak-key words highlighted. **Reset saved results**
clears the session history and reloads as a new player. The panel is
hidden in production builds (`import.meta.env.DEV`).

---

## 5. Guide for each teammate

**Gameplay (Brandon).** Nothing required. To add engine options to the solo
menu (e.g. difficulty), pass a function so it's read on every restart:
```ts
createSoloWordBankLoader({ request: () => ({ difficulty: settings.difficulty }) })
```
Only pass a **stable** `loadBank` to `TypingTest`: create the loader once,
with `useState(() => ...)` or at module level. A new function every render
reloads the words every render.

**Database (Ramon).**
- Words: when the `words` table exists, `loadWordBank` uses it
  automatically. The engine needs only a `word` text column; any extra
  columns are fine.
- History: implement `PlayerHistory` with Supabase:
  ```ts
  const supabaseHistory: PlayerHistory = {
    async getRecentResults(limit) {
      const { data, error } = await supabase.from('typing_results')
        .select('wpm, accuracy, per_key, duration_ms, completed_at')
        .order('completed_at', { ascending: false }).limit(limit)
      if (error) throw error
      return data.map((r) => ({ wpm: r.wpm, accuracy: r.accuracy, perKey: r.per_key,
        durationMs: r.duration_ms, completedAt: r.completed_at,
        rawWpm: r.wpm, keystrokes: [], wordBankSource: 'supabase' }))
    },
  }
  ```
  The suggested `typing_results.per_key` jsonb column is enough; no
  per-key table is needed for the engine.
- Global data: a view summing per-key `attempts` / `correct` across all
  results gives `{ a: correct/attempts, ... }`. Pass it to
  `createWordEngine({ globalKeys })`.

**Full stack (Kevin).** No word bank route is needed for solo play: the
engine runs in the client. Swapping history from browser storage to
Supabase is a one-line change in `session.ts` (`soloHistory`) once
Ramon's history exists. Keep `soloStatsSink` composing both sinks if you
want offline play to keep adapting.

**Multiplayer (Post-MVP averaged bank).** The engine is pure, so the
Colyseus room can run the same `build()` with a combined profile and a
shared `seed`, giving both players the identical bank.

---

## 6. Tuning

All values are in `DEFAULT_ENGINE_CONFIG`
([`config.ts`](../src/features/word-engine/config.ts)) and can be
overridden per engine.

| Key | Default | Effect |
|---|---|---|
| `weightWpm` / `weightOverallAccuracy` / `weightKeyAccuracy` | 0.5 / 0.3 / 0.2 | Skill weights. |
| `wpmCap` | 120 | WPM counted as full speed. |
| `accuracyFloor` | 0.75 | Accuracy that scores 0 in the skill formula. |
| `priorAttempts` | 10 | Smoothing strength (0 = off). |
| `newPlayerWpm` / `newPlayerAccuracy` | 35 / 0.9 | Assumptions with no history (accuracy only used without global data). |
| `weakKeyCount` | 5 | Max weak keys targeted. |
| `weakRatioMin` / `weakRatioMax` | 0.3 / 0.6 | Weak-key share at skill 0 / 100. |
| `difficultyOffsets` | easy −20, adaptive 0, hard +20 | Difficulty classes (add your own). |
| `difficultyWindow` | 15 | ± range around the target. |
| `minPoolMultiplier` | 2 | The window widens until `count × this` words qualify. |

To see the effect of a change before touching TypeScript, use the Python
reference's sweep (`python sweep.py` in `word-engine-claude/`).

---

## 7. Design decisions

| Decision | Why |
|---|---|
| Runs in the client | Solo play works without the home server; picking a solo bank isn't security-sensitive. |
| Pure engine, I/O in adapters | Words, history and global data can each move (local → Supabase) without engine changes. |
| Difficulty is a percentile within the given collection | Any word list works with no retuning. |
| Accuracy stretched with a 0.75 floor | Spreads skill across 0–100; a fast but sloppy typist no longer outranks a careful one. |
| Overall and per-letter accuracy kept as separate terms | Overall is frequency-weighted (common letters dominate, space included). The per-letter mean weights all 26 letters equally, so it rewards breadth. |
| Smoothing with 10 imaginary attempts | Short tests give few samples of rare letters. |
| Global data only fills never-typed letters | It steers a new Guest, but never overrides real data. |
| Weak keys are relative (below the player's own mean) | Even a 99% typist has something to practise; a perfectly even typist gets a skill-only bank. |
| Recent results weighted more (decay 0.87 over 20) | The bank follows improvement within a session. |
| Previous bank avoided | Restarting gives fresh words. |
| Seeded RNG | Reproducible banks for tests, bug reports, and (Post-MVP) identical 1v1 banks. |
| Never fails the game | Every failure path still returns words. |

---

## 8. Testing

```bash
pnpm test     # 63 tests: engine, profile, history, loader, parity
pnpm build    # also typechecks the tests (tsconfig.test.json)
```

- `engine.test.ts`: skill, smoothing, weak keys, bank rules, errors.
- `integration.test.ts`: profile building, browser-storage history (with
  an in-memory storage), the adaptive loader including failure fallbacks
  and the full feedback loop.
- `parity.test.ts`: replays 16 scenarios from the **Python reference
  implementation** (`BigWalk/word-engine-claude/`) and requires
  **identical** output (same words, skill, weak keys, ratings). This lets
  the algorithm be explored in Python and trusted in TypeScript. After an
  intentional algorithm change, update `engine.py` the same way, then run
  `python parity.py` to regenerate `tests/word-engine/fixtures/parity.json`.

Tests use Node's built-in runner (Node ≥ 22.18 runs `.ts` directly),
so there are no test dependencies.

---

## 9. Limitations and next steps

- **History is per browser, not per account.** That matches the Guest
  session for the MVP; Members need the Supabase `PlayerHistory` (§5).
- **Global data is a placeholder** until the app-wide aggregate exists.
- **The offline fallback list is small (~150 words) and reads like song
  lyrics.** With few rare-letter words, the engine sometimes can't fill its
  weak-key share (e.g. 5 of 9). The project doc asks for non-copyright
  words, so the list should be replaced with a larger plain common-word
  list; the engine works with any list.
- **Per-key speed isn't used yet.** `Keystroke.t` timestamps would allow
  "slow keys" as well as "inaccurate keys".
- **`mistypedAs` isn't used yet.** Confusion pairs (e.g. `e→w`) could pick
  words that contain both letters.
- **Post-MVP 1v1:** combine two profiles and share a seed (§5).

---

## 10. File map

```
src/features/word-engine/
  index.ts               public API (import from here)
  engine.ts              createWordEngine: skill, weak keys, bank selection
  types.ts               PlayerData, BankRequest, WordBankResult, EngineConfig, WordEngineError
  config.ts              DEFAULT_ENGINE_CONFIG, DEFAULT_GLOBAL_KEYS
  difficulty.ts          word difficulty percentiles, word cleaning
  random.ts              seeded RNG, shuffle, weighted sampling
  letters.ts             a-z and letter frequencies
  profile.ts             profileFromResults
  history.ts             PlayerHistory, createLocalPlayerHistory, combineStatsSinks
  adaptiveWordBank.ts    createAdaptiveWordBankLoader (game glue)
  session.ts             ready-made solo wiring
  components/            WordEngineDebugPanel (dev only)
tests/word-engine/       engine, integration and parity tests; fixtures/parity.json
```
