# Word Engine

## Overview

The word engine adapts typing practice to each player. It has three jobs:

1. **Build** the word bank for the player's next match.
2. **Learn** from each finished match by updating the player's typing stats.
3. **Report** the player's weak spots for display.

It finds the letter pairs (bigrams) a player is slow or error-prone on and gives them more practice on those pairs. The targeted words are mixed with common English words so practice still resembles normal typing.

- **Import from** `src/features/word-engine` (the `index.ts` barrel). Don't import internal files.
- **Pure TypeScript.** No React, no network, no storage. Every function takes data in and returns new data. Nothing is mutated.
- **Keyboard:** QWERTY only.
- **Word list:** 9,048 English words ranked by frequency, stored in the Supabase `words` table. The caller loads it and passes it in (see [Supabase data calls](#supabase-data-calls)).

## What the engine does

| Job | Input → Output | Methods |
|---|---|---|
| **1. Build** | `PlayerData` + recent words → word bank | `getWordBank` |
| **2. Learn** | `PlayerData` + one match's keystrokes → updated `PlayerData` | `cleanKeystrokes` → `updateStats` |
| **3. Report** | `PlayerData` → weakest bigrams, class latencies, hand accuracy | `getFeedback` |

Job 2 is what makes the engine adaptive. If it never runs, every bank is plain frequency sampling.

## What the engine doesn't do

These are owned by gameplay and backend code:

| Responsibility | Details |
|---|---|
| **Loading the word list** | Fetch the `words` table from Supabase once per session and pass it to `getWordBank` (see [Supabase data calls](#supabase-data-calls)). |
| **Typing UI and keystroke capture** | Record every keypress during a match as a `Keystroke`, following the [keystroke contract](#keystroke-contract). |
| **WPM and accuracy** | Compute `netWpm` and `netAccuracy` after each match and write them into `PlayerData`. The engine only reads `netWpm` (to choose a mode). It never calculates it. |
| **Saving and loading `PlayerData`** | Load it from Supabase before a match, save the result of `updateStats` after. The engine has no storage. |
| **Recent words** | Keep the words from the player's last ~3 banks and pass them to `getWordBank` so words don't repeat across matches. |
| **Creating new players** | Build an empty `PlayerData` for a first-time player (see [New player](#new-player)). |
| **Showing feedback** | `getFeedback` returns data. Rendering it is up to the UI. |
| **Beginner mode** | Not implemented. Players below `beginnerWpm` currently get frequency-sampled words. |

## Match lifecycle (For Brandon and Matthew)

Calls marked `// Supabase` are where data enters or leaves the database. Everything else runs in memory.

```ts
import { getWordBank, cleanKeystrokes, updateStats, type Keystroke } from './features/word-engine'

// Once per session
const words = await loadWords()                         // Supabase: words table (see below)

// Before the match
const player = await loadPlayer(userId)                 // Supabase: player stats
const recent = await loadRecentWords(userId)            // Supabase (or in memory): Set<string>
const bank = getWordBank(words, 30, player, recent)

// During the match
const log: Keystroke[] = []                             // yours: push one entry per keypress

// After the match
const updated = updateStats(player, cleanKeystrokes(log))
updated.netWpm = computeNetWpm(log)                     // yours
updated.netAccuracy = computeNetAccuracy(log)           // yours
await savePlayer(updated)                               // Supabase: player stats
await saveRecentWords(userId, bank)                     // Supabase (or in memory)
```

## Supabase data calls (For Ramon)

The engine never calls Supabase itself. These are the points where gameplay or backend code does:

| When | Call | Table | Feeds / stores |
|---|---|---|---|
| Once per session | Load word list | `words` (exists: `db/words/schema.sql`) | `words` argument of `getWordBank` |
| Before each match | Load player | player stats (not created yet) | `player` argument of `getWordBank`, `updateStats`, `getFeedback` |
| Before each match | Load recent words | player stats, or keep in memory | `recentWords` argument of `getWordBank` |
| After each match | Save player | player stats | result of `updateStats`, plus `netWpm` / `netAccuracy` |
| After each match | Save recent words | player stats, or keep in memory | the bank that was just played, last ~3 kept |

### Loading the word list (For Brandon and Kevin)

Supabase returns **at most 1,000 rows per request** by default, and the table has 9,048 rows, so page through it. Columns are snake_case in the database and camelCase in `Word`, so map each row.

```ts
import { supabase } from '../lib/supabase'
import type { Word } from './features/word-engine'

const PAGE_SIZE = 1000

export async function loadWords(): Promise<Word[]> {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .order('rank')                                     // getWordBank requires rank order
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows.map((r) => ({
    rank: r.rank,
    word: r.word,
    length: r.length,
    letters: r.letters,
    letterMask: r.letter_mask,
    hand: r.hand,
    bigrams: r.bigrams,
    alternationCount: r.alternation_count,
    rollCount: r.roll_count,
    rowJumpCount: r.row_jump_count,
    sameFingerCount: r.same_finger_count,
    repeatCount: r.repeat_count,
  }))
}
```

- **Load once, then reuse.** The list doesn't change during a session. Keep it in memory instead of fetching before every match.
- **Read access:** the table's row-level security policy allows reads by `anon` and `authenticated`, so it works before sign-in.
- **Keep rank order.** `getWordBank` takes the first `frequencyPool` entries as the common-word pool, so an unsorted list breaks frequency sampling.

### Player stats table (for Ramon)

`PlayerData` needs a table before load and save can be written. A suggested shape, one row per player:

| Column | Type | Maps to |
|---|---|---|
| `user_id` | `uuid`, primary key, references `auth.users` | `userId` |
| `net_wpm` | `real` | `netWpm` |
| `net_accuracy` | `real` | `netAccuracy` |
| `bigram_stats` | `jsonb` | `bigramStats` (store as-is) |
| `key_stats` | `jsonb` | `keyStats` (store as-is) |
| `recent_words` | `text[]` | `recentWords` (optional) |
| `updated_at` | `timestamptz` | none |

Row-level security should restrict each player to reading and writing their own row (`auth.uid() = user_id`).

## Methods

### Core

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `getWordBank` | `words: Word[]` (sorted by rank), `count: number`, `player: PlayerData \| null = null`, `recentWords: ReadonlySet<string> = new Set()`, `config = DEFAULT_CONFIG` | `Word[]` | Builds the next match's word bank. With no player or too little data, returns common words only. Output is shuffled and has no duplicates. |
| `cleanKeystrokes` | `log: Keystroke[]`, `config = DEFAULT_CONFIG` | `CleanedSamples` | Filters one match's raw keystrokes into usable samples. Drops backspaces, retypes, word starts, spaces, errors that follow another error, and long pauses. |
| `updateStats` | `player: PlayerData`, `samples: CleanedSamples`, `config = DEFAULT_CONFIG` | `PlayerData` | Folds a match's samples into the player's per-bigram and per-key stats. Returns a new object. `netWpm` and `netAccuracy` are left unchanged. |
| `getFeedback` | `player: PlayerData`, `config = DEFAULT_CONFIG` | `PlayerFeedback` | Weakest 5 bigrams, average latency per bigram class, and accuracy per hand. Empty lists until enough data exists. |

### Mode

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `computeBaselines` | `player: PlayerData`, `config = DEFAULT_CONFIG` | `Baselines \| null` | Typical latency and error rate for each bigram class. `null` means not enough data yet. Needed for `pickMode`. |
| `pickMode` | `player: PlayerData \| null`, `baselines: Baselines \| null`, `config = DEFAULT_CONFIG` | `Mode` | `'beginner'` if `netWpm < beginnerWpm`, `'cold_start'` if there are no baselines, otherwise `'speed'`. Use it to suggest beginner mode or show "still learning your typing". |

### Utilities

| Export | Description |
|---|---|
| `words` | A bundled copy of the word list from `db/words/words.csv`, sorted by rank. For local development and the test page only. Game code should load the list from Supabase. |
| `classifyBigram(bigram)` | Returns the bigram's class (see [Bigram classes](#bigram-classes)), or `null` for non-letters. |
| `BACKSPACE` | `'Backspace'`. The `typed` value for a backspace press. |
| `DEFAULT_CONFIG` | Default tuning values (see [Config](#config)). |

## Keystroke contract

`cleanKeystrokes` trusts the log. **A malformed log produces wrong stats without any error**, so follow these rules exactly.

```ts
interface Keystroke {
  expected: string    // the character the player should type at this position
  typed: string       // the key actually pressed: KeyboardEvent.key, or BACKSPACE
  latencyMs: number   // ms since the previous keystroke
  wordIndex: number   // index of the word in the bank
  charIndex: number   // index of the character in that word
}
```

- **One entry per keypress**, in order, including wrong keys and backspaces.
- **Spaces are keystrokes too.** The space after a word has `expected: ' '` and `charIndex = word.length`.
- **Backspace:** `typed: BACKSPACE`. `expected` and `charIndex` refer to the position being erased.
- **Retyping after a backspace:** use the **same** `wordIndex`/`charIndex` as the original attempt. The engine relies on this to recognize corrections.
- **`latencyMs`** is the time since the previous keypress of any kind, measured with `performance.now()` rather than `Date.now()`.
- **Lowercase.** The word list is lowercase a–z. Normalize `typed` before comparing if you allow caps lock or shift.

Example: typing `the` with one mistake on `h`:

```ts
{ expected: 't', typed: 't',         latencyMs: 420, wordIndex: 0, charIndex: 0 }
{ expected: 'h', typed: 'j',         latencyMs: 160, wordIndex: 0, charIndex: 1 }  // error
{ expected: 'h', typed: 'Backspace', latencyMs: 210, wordIndex: 0, charIndex: 1 }
{ expected: 'h', typed: 'h',         latencyMs: 240, wordIndex: 0, charIndex: 1 }  // retype: same position
{ expected: 'e', typed: 'e',         latencyMs: 150, wordIndex: 0, charIndex: 2 }
{ expected: ' ', typed: ' ',         latencyMs: 140, wordIndex: 0, charIndex: 3 }
```

## Data types

### PlayerData

```ts
interface PlayerData {
  userId: string                           // Supabase auth user id (uuid)
  netWpm: number                           // set by gameplay; engine reads it for mode
  netAccuracy: number                      // set by gameplay; engine does not read it
  bigramStats: Record<string, ItemStats>   // owned by the engine, e.g. { th: {...} }
  keyStats: Record<string, ItemStats>      // owned by the engine, e.g. { e: {...} }
}

interface ItemStats {
  ewmaLatency: number      // smoothed latency in ms
  latencySamples: number
  ewmaErrorRate: number    // smoothed error rate, 0–1
  errorSamples: number
}
```

Treat `bigramStats` and `keyStats` as opaque. Only `updateStats` should write them. Store them as-is (e.g. a `jsonb` column).

#### New player

```ts
const player: PlayerData = { userId, netWpm: 0, netAccuracy: 0, bigramStats: {}, keyStats: {} }
```

### Word

One row of the `words` table (`db/words/schema.sql`), with camelCase field names.

| Field | Database column | Description |
|---|---|---|
| `rank` | `rank` | Frequency rank, 1 = most common |
| `word`, `length` | `word`, `length` | The word |
| `letters`, `letterMask` | `letters`, `letter_mask` | Unique letters, as text and as a 26-bit mask |
| `hand` | `hand` | `left`, `right` or `both` |
| `bigrams` | `bigrams` | Every bigram in order, e.g. `the` → `['th', 'he']` |
| `alternationCount`, `rollCount`, `rowJumpCount`, `sameFingerCount`, `repeatCount` | `alternation_count`, `roll_count`, `row_jump_count`, `same_finger_count`, `repeat_count` | Number of bigrams of each class |

### PlayerFeedback

```ts
interface PlayerFeedback {
  weakestBigrams: { bigram: string, weakness: number }[]                       // up to 5, highest first
  classSummary: { cls: BigramClass, latencyMs: number, vsAlternationMs: number }[]
  handSummary: { left: number | null, right: number | null }                   // accuracy 0–1
}
```

`weakness` is relative: 0 means typical for that kind of bigram, and 1.0 means roughly twice as slow as typical or clearly error-prone. Compare weaknesses with each other, not with a fixed threshold.

## How a bank is built

In speed mode:

1. Each bigram's **weakness** is how much slower or more error-prone it is than other bigrams of the **same class**. Same-finger bigrams are compared only with same-finger bigrams, so bigrams that are naturally slow aren't flagged forever.
2. Weakness is scaled by confidence, so bigrams with few samples count less.
3. Each word's **score** is the average weakness of its bigrams.
4. **60%** of the bank (`targetedRatio`) is drawn from words of length ≥ 3 that aren't in `recentWords`, picked at random with higher-scoring words more likely.
5. The rest is drawn uniformly from the **3,000** most common words (`frequencyPool`).

In cold start and beginner mode, the whole bank comes from step 5.

### Bigram classes

| Class | Meaning | Example |
|---|---|---|
| `alternation` | Switches hands | `th` |
| `roll` | Same hand, different fingers | `er` |
| `row_jump` | Same hand, top row ↔ bottom row | `ex` |
| `same_finger` | Same finger, different keys | `ed` |
| `repeat` | Same key twice | `ll` |

## Config

Every function takes an optional `config`. Pass the **same** config to every call.

| Field | Default | Effect |
|---|---|---|
| `bankSize` | 30 | Suggested bank size. **Not read by the engine.** Pass it as `count` to `getWordBank`. |
| `targetedRatio` | 0.6 | Share of the bank chosen by weakness |
| `beginnerWpm` | 25 | Below this `netWpm`, the mode is `beginner` |
| `ewmaWindow` | 50 | How many recent samples the stats remember |
| `minSamples` | 10 | Samples a bigram needs before it counts toward class baselines |
| `minClassBigrams` | 5 | Qualifying bigrams a class needs, else it uses the overall baseline |
| `kErr` | 5 | Weight of errors relative to slowness |
| `kConf` | 10 | Higher = needs more samples before trusting a bigram |
| `latencyCapMs` | 1500 | Keystrokes slower than this are treated as pauses and ignored |
| `latencyCapMult` | 3 | ...or slower than 3× the player's median latency |
| `minWordLength` | 3 | Shortest word allowed in the targeted share |
| `frequencyPool` | 3000 | Size of the common-word pool |

These are starting values. Tune them on the test page.

## Word list

- **Source:** [first20hours/google-10000-english](https://github.com/first20hours/google-10000-english) (no-swears list), filtered to dictionary words. Abbreviations, brands and single letters other than `a` and `i` are removed.
- **Regenerate:** `node scripts/build-words.mjs` writes `db/words/words.csv`.
- **Import into Supabase:** run `db/words/schema.sql` in the SQL editor, then import `db/words/words.csv` into the `words` table from the Table Editor.
- **Production source:** the Supabase `words` table (see [Loading the word list](#loading-the-word-list)).
- **Bundled copy:** the exported `words` is the CSV bundled into the app (about 640 KB raw), for local development and the test page. Once game code loads from Supabase, nothing outside the test page should import it.
- Proper nouns (`texas`, `monday`) are included and stored lowercase.

## Test page

`pnpm dev`, then open `http://localhost:5173/banktest.html`.

A simulated typist with configurable slow and error-prone bigrams plays matches through the real engine. The page shows the bank adapting, with weak bigrams highlighted. It isn't included in production builds. The simulator (`simulate.ts`) is test-only and isn't exported.

## Known limitations

- QWERTY only. Bigram classes are hard-coded to that layout.
- Beginner mode is detected but not implemented.
- Word transitions (space bigrams) aren't tracked.
- Stats from a single match are noisy. Expect 50+ matches before targeting is reliable.
- Randomness uses `Math.random`, so banks can't be reproduced from a seed.
