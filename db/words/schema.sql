-- Word list for the adaptive word engine.
-- Source: first20hours/google-10000-english (no-swears), ordered by frequency.
-- Keyboard features assume QWERTY with standard touch-typing finger assignment.
-- Generate rows with: node scripts/build-words.mjs  → db/words/words.csv

create table public.words (
  rank              integer primary key,          -- 1 = most frequent
  word              text not null unique,
  length            smallint not null,
  letters           text not null,                -- sorted unique letters, e.g. 'eht'
  letter_mask       integer not null,             -- bit i set = letter ('a' + i) present
  hand              text not null check (hand in ('left', 'right', 'both')),
  bigrams           text[] not null,              -- in order, duplicates kept
  alternation_count smallint not null,            -- bigram switches hands
  roll_count        smallint not null,            -- same hand, different finger, row gap < 2
  row_jump_count    smallint not null,            -- same hand, different finger, top <-> bottom row
  same_finger_count smallint not null,            -- same finger, different key
  repeat_count      smallint not null             -- same key twice, e.g. 'll'
);

-- "Words containing bigram X" lookups for weakness targeting.
create index words_bigrams_idx on public.words using gin (bigrams);

-- Read-only reference data for clients.
alter table public.words enable row level security;

create policy "words are readable by everyone"
  on public.words for select
  to anon, authenticated
  using (true);
