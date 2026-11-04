# Word engine tests

## How to run

From `web/`, after `pnpm install`:

```bash
node scripts/test-word-engine.mjs
```

- See every test name: `node scripts/test-word-engine.mjs --reporter=verbose`
- Run matching tests only: `node scripts/test-word-engine.mjs -t "logging out"`

No Supabase connection, env vars or dev server are needed. Supabase and `localStorage` are faked.

## What's expected

```
Test Files  4 passed (4)
     Tests  42 passed (42)
```

The script exits with code `0`, normally within a few seconds.

| File | Tests | Covers |
|---|---|---|
| `src/features/word-engine/engine.test.ts` | 15 | Which words a bank picks, with and without saved stats, plus keystroke cleaning and stat updates |
| `src/features/typing/player/playerStore.test.ts` | 13 | Loading and saving stats, moving local stats to Supabase, and Supabase failures |
| `src/features/typing/wordbank/loadWordBank.test.ts` | 8 | The whole flow: play matches, log out, log back in, and check the bank |
| `src/features/typing/wordbank/wordBankDebug.test.ts` | 6 | The `focusedBigrams()` console command |

## What counts as failing

The run fails if any of these happen. The script exits with a non-zero code.

- Any test fails. Vitest prints the test name and what it expected.
- Fewer than 4 files or 42 tests run. Update the numbers above when tests are added or removed on purpose.
- Vitest reports an error outside a test, such as a file that won't import.

Random numbers are seeded, so results repeat. **Don't rerun to get a pass.** A failure means something changed.

| Failing tests mention | Likely problem |
|---|---|
| `targeted share`, `favors saved weak bigrams` | Saved stats no longer steer the word bank |
| `uses common words` | Targeting started before there's enough data, or under 25 WPM |
| `slow for everyone` | Bigrams are no longer compared within their own class |
| `logging out and back in`, `new login` | Stats aren't surviving a new session |
| `never overwrite`, `never save over` | **Serious:** a member's saved stats could be lost |
| `all-time averages`, `net stats` | `netWpm` no longer comes from the all-time average |

## See focused bigrams in the app

To see what the engine targeted in a real bank, open Time Attack, then run this in the browser console:

```js
focusedBigrams()
```

It prints the mode, the focused bigrams with their stats, the targeted words, and the common words, which may contain weak bigrams by chance. If nothing was targeted, it says why, and during cold start it lists the bigrams closest to the 10 samples needed.

It describes the most recently loaded bank, which was built before that match was played. To see the effect of a finished match, start a new one and run the command again.

## What a pass doesn't prove

- **Real Supabase:** permissions and the `get_player_stats` / `update_player_stats` functions aren't exercised. Test those by playing a match as a signed-in member.
- **How strong targeting feels:** the tests check that a weak bigram is favored, not by how much. In simulation, a bigram missed 50% of the time reached about 2 to 4 words in a 30-word bank after 40 matches, and rare bigrams stayed under 1.
- **Other screens:** Versus and the results UI aren't covered.
