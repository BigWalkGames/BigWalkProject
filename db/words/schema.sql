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



-- Schema: users (+ triggers)

-- Table: users
create table users.users (
  account_id uuid not null,
  name character varying(80) not null,
  profile_pic integer not null,
  username text null,
  constraint users_pk primary key (account_id),
  constraint users_account_id_fkey foreign KEY (account_id) references auth.users (id) on delete CASCADE,
  constraint users_username_format check (
    (
      (username is null)
      or (username ~ '^[A-Za-z0-9_]{3,20}$'::text)
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists users_username_lower_key on users.users using btree (lower(username)) TABLESPACE pg_default;

create trigger on_users_user_created
after INSERT on users.users for EACH row
execute FUNCTION trigger_create_history ();

-- Table: guests
create table users.guests (
  account_id uuid not null,
  constraint guests_pk primary key (account_id),
  constraint guests_account_id_fkey foreign KEY (account_id) references users.users (account_id) on delete CASCADE
) TABLESPACE pg_default;

--Table: members
create table users.members (
  account_id uuid not null,
  email character varying(80) not null,
  password character varying(128) not null,
  constraint members_pk primary key (account_id),
  constraint members_account_id_fkey foreign KEY (account_id) references users.users (account_id) on delete CASCADE
) TABLESPACE pg_default;

--Table: settings
create table users.settings (
  account_id uuid not null,
  master_volume integer not null,
  music_volume integer not null,
  sfx_volume integer not null,
  keyboard_style character varying(50) not null,
  font_style character varying(50) not null,
  theme character varying(50) not null,
  colorblind_mode boolean not null,
  motion_reduction boolean not null,
  constraint settings_pk primary key (account_id),
  constraint settings_account_id_fkey foreign KEY (account_id) references users.users (account_id) on delete CASCADE,
  constraint settings_font_styles foreign KEY (font_style) references users.font_styles (name),
  constraint settings_keyboard_styles foreign KEY (keyboard_style) references users.keyboard_styles (name),
  constraint settings_themes foreign KEY (theme) references users.themes (name)
) TABLESPACE pg_default;

--Table: keyboard_styles (Look-Up Table)
create table users.keyboard_styles (
  name character varying(50) not null,
  constraint keyboard_styles_pk primary key (name)
) TABLESPACE pg_default;

--Table: font_styles (Look-Up Table)
create table users.font_styles (
  name character varying(50) not null,
  constraint font_styles_pk primary key (name)
) TABLESPACE pg_default;

--Table: themes (Look-Up Table)
create table users.themes (
  name character varying(50) not null,
  constraint themes_pk primary key (name)
) TABLESPACE pg_default;

--Table: Keybinds
create table users.keybinds (
  account_id uuid not null,
  name character varying(50) not null,
  action character varying(50) not null,
  constraint keybinds_pk primary key (account_id),
  constraint keybinds_account_id_fkey foreign KEY (account_id) references users.settings (account_id) on delete CASCADE
) TABLESPACE pg_default;

--Table: histories
create table users.histories (
  account_id uuid not null,
  match_count integer not null,
  match_wins integer not null,
  total_wpm numeric(7, 4) not null,
  total_accuracy numeric(7, 5) not null,
  constraint histories_pk primary key (account_id),
  constraint histories_account_id_fkey foreign KEY (account_id) references users.users (account_id) on delete CASCADE
) TABLESPACE pg_default;

create trigger on_global_stats_update_accuracy
after
update on users.histories for EACH row
execute FUNCTION trigger_update_global_stats_accuracy ();

create trigger on_global_stats_update_count
after
update on users.histories for EACH row
execute FUNCTION trigger_update_global_stats_count ();

create trigger on_global_stats_update_wpm
after
update on users.histories for EACH row
execute FUNCTION trigger_update_global_stats_wpm ();

create trigger on_player_accuracy_update
after
update on users.histories for EACH row
execute FUNCTION trigger_player_data_update_accuracy ();

create trigger on_player_wpm_update
after
update on users.histories for EACH row
execute FUNCTION trigger_player_data_update_wpm ();

--Table: matches
create table users.matches (
  account_id uuid not null,
  match_time timestamp with time zone not null,
  accuracy numeric(7, 5) not null,
  wpm numeric(7, 4) not null,
  constraint matches_pk primary key (account_id, match_time),
  constraint matches_account_id_fkey foreign KEY (account_id) references users.histories (account_id) on delete CASCADE
) TABLESPACE pg_default;

create trigger on_match_inserted_accuracy
after INSERT on users.matches for EACH row
execute FUNCTION trigger_update_total_accuracy ();

create trigger on_match_inserted_count
after INSERT on users.matches for EACH row
execute FUNCTION trigger_update_match_count ();

create trigger on_match_inserted_wpm
after INSERT on users.matches for EACH row
execute FUNCTION trigger_update_total_wpm ();

--Table: multiplayer_match:
create table users.multiplayer_match (
  account_id uuid not null,
  match_time timestamp with time zone not null,
  winner boolean not null,
  constraint multiplayer_match_pk primary key (account_id, match_time),
  constraint multiplayer_match_account_id_match_time_fkey foreign KEY (account_id, match_time) references users.matches (account_id, match_time) on delete CASCADE
) TABLESPACE pg_default;

create trigger on_match_inserted_wins
after INSERT on users.multiplayer_match for EACH row
execute FUNCTION trigger_update_match_wins ();

--Table: multiplayer_results
create table users.multiplayer_results (
  match_id uuid not null,
  account_id uuid not null,
  opponent_id uuid null,
  mode text not null,
  room_code text null,
  outcome text not null,
  wpm numeric not null,
  accuracy numeric not null,
  opponent_wpm numeric not null,
  opponent_accuracy numeric not null,
  finished_at timestamp with time zone not null,
  constraint multiplayer_results_pkey primary key (match_id, account_id),
  constraint multiplayer_results_account_id_fkey foreign KEY (account_id) references users.users (account_id) on delete CASCADE,
  constraint multiplayer_results_opponent_id_fkey foreign KEY (opponent_id) references users.users (account_id) on delete set null,
  constraint multiplayer_results_check1 check (
    (
      (mode = 'custom'::text)
      or (room_code is null)
    )
  ),
  constraint multiplayer_results_mode_check check (
    (
      mode = any (array['quick_match'::text, 'custom'::text])
    )
  ),
  constraint multiplayer_results_opponent_accuracy_check check (
    (
      (opponent_accuracy >= (0)::numeric)
      and (opponent_accuracy <= (1)::numeric)
    )
  ),
  constraint multiplayer_results_wpm_check check ((wpm >= (0)::numeric)),
  constraint multiplayer_results_opponent_wpm_check check ((opponent_wpm >= (0)::numeric)),
  constraint multiplayer_results_outcome_check check (
    (
      outcome = any (array['win'::text, 'loss'::text, 'draw'::text])
    )
  ),
  constraint multiplayer_results_accuracy_check check (
    (
      (accuracy >= (0)::numeric)
      and (accuracy <= (1)::numeric)
    )
  ),
  constraint multiplayer_results_room_code_check check ((room_code ~ '^[A-Z0-9]{5}$'::text)),
  constraint multiplayer_results_check check ((opponent_id is distinct from account_id))
) TABLESPACE pg_default;

create index IF not exists multiplayer_results_account_finished_idx on users.multiplayer_results using btree (account_id, finished_at desc) TABLESPACE pg_default;

create index IF not exists multiplayer_results_opponent_idx on users.multiplayer_results using btree (opponent_id) TABLESPACE pg_default;

--Table: match_bigram_statistics
create table users.match_bigram_statistics (
  account_id uuid not null,
  match_time timestamp with time zone not null,
  bigram character varying(2) not null,
  hits integer not null,
  misses integer not null,
  constraint match_bigram_statistics_pkey primary key (account_id, match_time, bigram),
  constraint match_bigram_statistics_account_id_match_time_fkey foreign KEY (account_id, match_time) references users.matches (account_id, match_time) on delete CASCADE
) TABLESPACE pg_default;

--Table: history_key_statistics
create table users.history_key_statistics (
  account_id uuid not null,
  keys_name character varying(4) not null,
  hits integer not null,
  misses integer not null,
  accuracy numeric(6, 4) not null,
  constraint history_key_statistics_pk primary key (account_id, keys_name),
  constraint history_key_statistics_account_id_fkey foreign KEY (account_id) references users.histories (account_id) on delete CASCADE,
  constraint history_key_statistics_keys_name_fkey foreign KEY (keys_name) references key.keys (name) on delete CASCADE
) TABLESPACE pg_default;

create trigger on_update_global_key_stats_hits
after
update on users.history_key_statistics for EACH row
execute FUNCTION trigger_update_global_key_stats_hits ();

create trigger on_update_global_key_stats_misses
after
update on users.history_key_statistics for EACH row
execute FUNCTION trigger_update_global_key_stats_misses ();

--Table: match_key_statistics
create table users.match_key_statistics (
  account_id uuid not null,
  match_time timestamp with time zone not null,
  key_name character varying(4) not null,
  hits integer not null,
  misses integer not null,
  accuracy numeric(6, 4) not null,
  constraint match_key_statistics_pkey primary key (account_id, match_time, key_name),
  constraint match_key_statistics_account_id_match_time_fkey foreign KEY (account_id, match_time) references users.matches (account_id, match_time) on delete CASCADE,
  constraint match_key_statistics_key_name_fkey foreign KEY (key_name) references key.keys (name) on delete CASCADE
) TABLESPACE pg_default;

create trigger on_history_key_stats_update_accuracy
after INSERT on users.match_key_statistics for EACH row
execute FUNCTION trigger_update_history_key_statistics_accuracy ();

create trigger on_history_key_stats_update_hits
after INSERT on users.match_key_statistics for EACH row
execute FUNCTION trigger_update_history_key_statistics_hits ();





--Schema: key
--Table: keys
create table key.keys (
  name character varying(4) not null,
  constraint keys_pk primary key (name)
) TABLESPACE pg_default;








--Schema: multiplayer
--Table: messages
create table multiplayer.messages (
  room_code integer not null,
  account_id uuid not null,
  contents character varying(300) not null,
  constraint messages_pk primary key (room_code, account_id),
  constraint messages_account_id_fkey foreign KEY (account_id) references users.users (account_id) on delete CASCADE,
  constraint messages_room_code_fkey foreign KEY (room_code) references multiplayer.rooms (code) on delete CASCADE
) TABLESPACE pg_default;

--Table: rooms
create table multiplayer.rooms (
  code integer not null,
  constraint rooms_pk primary key (code)
) TABLESPACE pg_default;






--Schema: word_engine
--Table: player_data
create table word_engine.player_data (
  account_id uuid not null,
  net_wpm numeric(7, 4) not null,
  net_accuracy numeric(7, 5) not null,
  bigram_stats jsonb not null,
  key_stats jsonb not null,
  recent_words text[] null,
  updated_at timestamp with time zone not null,
  constraint player_data_pk primary key (account_id),
  constraint player_data_users foreign KEY (account_id) references users.users (account_id) on delete CASCADE
) TABLESPACE pg_default;