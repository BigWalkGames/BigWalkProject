-- Test data for the History and Match History date filters (Day / Week / Month / Year).
-- Puts a match just inside and just outside every period boundary, plus older matches so All scrolls.
-- Dates are relative to now() in the tester's time zone, so re-run this right before each test pass.
--
-- Setup: sign up both accounts through the app, then run this in the Supabase SQL editor.
-- It replaces the Time Attack and multiplayer matches of these two accounts only.
-- The result table lists the expected row count per tab on each screen.

drop table if exists pg_temp.qa_history_expected;
create temp table qa_history_expected (tab text, history bigint, match_history bigint, sort int);

do $$
declare
  test_username  constant text := 'qa_history';        -- gets the test matches
  empty_username constant text := 'qa_history_empty';  -- kept at zero matches, for the empty state
  tz             constant text := 'America/Los_Angeles'; -- the tester's browser time zone

  -- local wall-clock boundaries, the same ones the client computes
  today       timestamp := date_trunc('day', now() at time zone tz);
  week_start  timestamp := today - extract(dow from today)::int * interval '1 day'; -- Sunday
  month_start timestamp := date_trunc('month', today);
  year_start  timestamp := date_trunc('year', today);

  acct uuid;
  empty_acct uuid;
begin
  select account_id into acct from users.users where username = test_username;
  if acct is null then
    raise exception 'No account named %. Sign it up through the app first.', test_username;
  end if;

  select account_id into empty_acct from users.users where username = empty_username;
  if empty_acct is null then
    raise notice 'No account named %, skipping the empty-state account.', empty_username;
  else
    delete from users.matches where account_id = empty_acct;
    delete from users.multiplayer_results where account_id = empty_acct;
  end if;

  delete from users.matches where account_id = acct;
  delete from users.multiplayer_results where account_id = acct;

  -- Edge times shared by both screens. Each boundary uses its own offset so rows never share
  -- a time when boundaries line up (e.g. today is Sunday or the 1st).
  create temp table qa_edges on commit drop as
  select * from (values
    (1, now() at time zone tz - interval '5 minutes'), -- just played
    (2, today       + interval '30 seconds'),          -- Day: just after midnight
    (3, today       - interval '30 seconds'),          -- yesterday 23:59:30, not in Day
    (4, week_start  + interval '40 seconds'),          -- Week: Sunday just after midnight
    (5, week_start  - interval '40 seconds'),          -- last Saturday, not in Week
    (6, month_start + interval '50 seconds'),          -- Month: the 1st just after midnight
    (7, month_start - interval '50 seconds'),          -- last day of last month, not in Month
    (8, year_start  + interval '60 seconds'),          -- Year: Jan 1 just after midnight
    (9, year_start  - interval '60 seconds')           -- Dec 31 last year, not in Year
  ) as e(n, local_time)
  union all
  -- older matches every 13 days back past a year, so the All list scrolls
  select 9 + i, today - i * interval '13 days' + interval '14 hours'
  from generate_series(1, 30) as i;

  insert into users.matches (account_id, match_time, wpm, accuracy)
  select acct, local_time at time zone tz, 40 + (n * 7) % 60, 0.80 + (n % 20) / 100.0
  from qa_edges;

  -- One-sided rows against a guest opponent; every fourth match is a Custom Game,
  -- and results cycle win / loss / draw independently of the mode.
  insert into users.multiplayer_results
    (match_id, account_id, opponent_id, mode, room_code, outcome,
     wpm, accuracy, opponent_wpm, opponent_accuracy, finished_at)
  select gen_random_uuid(), acct, null,
         case when n % 4 = 0 then 'custom' else 'quick_match' end,
         case when n % 4 = 0 then 'QATST' end,
         (array['win', 'loss', 'draw'])[n % 3 + 1],
         40 + (n * 7) % 60, 0.80 + (n % 20) / 100.0,
         40 + (n * 11) % 60, 0.80 + (n % 13) / 100.0,
         local_time at time zone tz
  from qa_edges;

  insert into qa_history_expected
  select p.tab,
         (select count(*) from users.matches m
           where m.account_id = acct and m.match_time >= p.from_ts and m.match_time < p.to_ts),
         (select count(*) from users.multiplayer_results r
           where r.account_id = acct and r.finished_at >= p.from_ts and r.finished_at < p.to_ts),
         p.sort
  from (values
    (1, 'All',   '-infinity'::timestamptz,     'infinity'::timestamptz),
    (2, 'Day',   today at time zone tz,       (today + interval '1 day') at time zone tz),
    (3, 'Week',  week_start at time zone tz,  (week_start + interval '7 days') at time zone tz),
    (4, 'Month', month_start at time zone tz, (month_start + interval '1 month') at time zone tz),
    (5, 'Year',  year_start at time zone tz,  (year_start + interval '1 year') at time zone tz)
  ) as p(sort, tab, from_ts, to_ts);
end;
$$;

select tab, history as "History rows", match_history as "Match History rows"
from qa_history_expected
order by sort;