# Player stats functions fixed and wired up

**Applied:** 2026-11-03 23:48 PST (2026-11-04 07:48 UTC) to `BigWalkProject`
**Migration:** `20261104074854_player_data_owner_only_access`
**For:** Ramon. These functions and the table look like yours, so please check this matches what you intended.

## Why

The word engine kept player stats only in the browser's `localStorage`, so they were lost on a new device or when site data was cleared. `word_engine.player_data` already existed but had 0 rows for 51 users, and nothing could use it:

- No row was ever created. `trigger_create_player_data` exists but isn't attached to any table.
- Clients have no access to the `word_engine` schema, so `get_player_stats` and `update_player_stats` (both security invoker) couldn't reach the table.
- Both functions accepted any `acc_id` with no ownership check, and anon could execute them. Only the missing schema access was protecting the data.
- RLS was off on the table.

No code on any remote branch called either function, so nothing depended on the old behaviour.

## What changed

**`word_engine.player_data`**
- RLS is on, with no policies. All privileges are revoked from `public`, `anon` and `authenticated`, so the functions below are the only client access.

**`public.get_player_stats(acc_id uuid)`**
- Now security definer with `search_path = ''`. Raises `42501` unless `acc_id = auth.uid()`.
- Callable by `authenticated` only (this includes guests).
- **Return type changed** from `word_engine.player_data` to `returns table (...)` with the same columns, so the function was dropped and recreated.
- Reads from `users.histories` left-joined to `player_data`. It returns a row before the player has a `player_data` row, with `{}` stats and `net_wpm` / `net_accuracy` from their all-time averages.

**`public.update_player_stats(acc_id uuid, bigrams jsonb, keys jsonb)`**
- Same signature and same security changes as above.
- Now an **upsert**, because nothing else creates rows. `net_wpm` / `net_accuracy` are seeded from `users.histories` on insert and never changed by this function.
- `updated_at` is now `now()`. It used to be the latest match time, which is null for a player with no matches and would break the `not null` column on insert.

**Client: `src/features/typing/player/playerStore.ts`**
- Signed-in players (members and guests) load and save through these functions.
- `localStorage` is now only for signed-out players and for saves that failed.
- On load, a leftover local copy is compared with Supabase, and whichever has more samples wins. If the local copy wins it's uploaded, and either way it's then removed. This also moves existing players' stats over.
- If Supabase can't be read, the client doesn't save to it, so it can't overwrite stats it never loaded.

## Decision: `netWpm` is the all-time average

For signed-in players, `net_wpm` and `net_accuracy` come from `users.histories`, kept in step by the existing `on_player_wpm_update` and `on_player_accuracy_update` triggers. The client no longer writes them. Signed-out players have no history, so they still use their last match. The engine uses `netWpm` to choose beginner mode, and the average is steadier than a single match.

## Left alone

- `trigger_create_player_data` is still unattached. The upsert makes it unnecessary. If you attach it, note it sets `updated_at` from `last_sign_in_at`, which may be null and would then fail the insert, blocking sign-up.
- `recent_words` is unused. Recent words are still kept in memory by `loadWordBank`.
- Players can write any stats to their own row, because the client computes them. That's fine while the stats only drive word selection, but not if they ever feed rankings.
- Lifetime latency per bigram isn't stored anywhere. `bigram_stats` holds moving averages. `users.match_bigram_statistics` has lifetime hits and misses, but no latency.

## Verified

Run as `anon` and `authenticated` in a transaction that was rolled back, plus REST calls made without signing in:

| Check | Result |
|---|---|
| anon calls either function (SQL and REST) | Denied, `42501` |
| Authenticated player reads own stats before any row exists | 1 row, `{}` stats, `net_wpm` present |
| Authenticated player saves twice | Insert, then update |
| Authenticated player reads or saves another player's stats | Denied, `42501` |
| Authenticated player selects from the table directly | Denied, `42501` |
| New match via `save_match_stats` | `player_data.net_wpm` = `histories.total_wpm` = average of matches |

**Tested in the app (2026-11-03):** a guest session saved a row with 123 bigrams and 23 keys, and its `net_wpm` / `net_accuracy` matched `users.histories`.

**Not verified:** a member account, and the word bank using these stats across devices.

## Roll back

Restore the old behaviour by disabling RLS, then dropping both functions and recreating them from the migration history. The client needs reverting too, because the old `get_player_stats` isn't reachable from the client.

## SQL

```sql
alter table word_engine.player_data enable row level security;
revoke all on word_engine.player_data from public, anon, authenticated;

drop function public.get_player_stats(uuid);

create function public.get_player_stats(acc_id uuid)
returns table (
  account_id   uuid,
  net_wpm      numeric,
  net_accuracy numeric,
  bigram_stats jsonb,
  key_stats    jsonb,
  recent_words text[],
  updated_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if acc_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  select h.account_id, h.total_wpm, h.total_accuracy,
         coalesce(p.bigram_stats, '{}'::jsonb), coalesce(p.key_stats, '{}'::jsonb),
         p.recent_words, p.updated_at
  from users.histories h
  left join word_engine.player_data p on p.account_id = h.account_id
  where h.account_id = acc_id;
end;
$$;

revoke all on function public.get_player_stats(uuid) from public, anon;
grant execute on function public.get_player_stats(uuid) to authenticated;

create or replace function public.update_player_stats(acc_id uuid, bigrams jsonb, keys jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if acc_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  insert into word_engine.player_data (account_id, net_wpm, net_accuracy, bigram_stats, key_stats, updated_at)
  select h.account_id, h.total_wpm, h.total_accuracy, bigrams, keys, now()
  from users.histories h
  where h.account_id = acc_id
  on conflict (account_id) do update
    set bigram_stats = excluded.bigram_stats,
        key_stats    = excluded.key_stats,
        updated_at   = excluded.updated_at;
end;
$$;

revoke all on function public.update_player_stats(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_player_stats(uuid, jsonb, jsonb) to authenticated;
```
