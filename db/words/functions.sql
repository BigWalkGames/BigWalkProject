-- Functions of the database

-- *************************************** Functions that are called by the application ***************************************

-- Function: Get all matches w/ timeframe
-- get_all_matches(id uuid, p_from timestamp, p_to timestamp)

-- Retrieves all matches from a particular user over a particular timeframe.
CREATE FUNCTION get_all_matches(id uuid, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS setof users.matches
LANGUAGE sql
SECURITY definer
AS $$
    begin
    if id is distinct from auth.uid() then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    if p_from >= p_to then
        raise exception 'p_from must be before p_to' using errcode = '22023';
    end if;

    return query
        select *
        from users.matches m
        where m.account_id = id
        and (p_from is null or m.match_time >= p_from)
        and (p_to is null or m.match_time < p_to);
    end;
$$;

-- Function: Get email for user
-- get_email_for_username(p_username text)

-- Retrieves the email for a particular verified user.
CREATE FUNCTION get_email_for_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY definer
AS $$
    select a.email::text
    from users.users u
    join auth.users a on a.id = u.account_id
    where lower(u.username) = lower(p_username)
        and a.is_anonymous = false
        and a.email_confirmed_at is not null
    limit 1;
$$;

-- Function: Get match improvements
-- get_match_improvements(match_end timestamp, min_attempts integer, min_gain numeric, max_results integer, window_size integer)

-- Retrieves previous bigram stats and compares them to the current match to show potential improvement.
CREATE FUNCTION get_match_improvements(match_end timestamp with time zone, min_attempts integer DEFAULT 5, min_gain numeric DEFAULT 0.05, max_results integer DEFAULT 5, window_size integer DEFAULT 10)
RETURNS table(kind text, item text, current_accuracy numeric, previous_accuracy numeric, gain numeric)
LANGUAGE sql
SECURITY definer
AS $$
    with recent as (
        select m.match_time from users.matches m
        where m.account_id = auth.uid() and m.match_time < match_end
        order by m.match_time desc limit window_size
    ),
    stats as (
        select 'bigram'::text as k, b.bigram::text as i, b.match_time, b.hits, b.misses
        from users.match_bigram_statistics b where b.account_id = auth.uid()
        union all
        select 'key'::text, s.key_name::text, s.match_time, s.hits, s.misses
        from users.match_key_statistics s where s.account_id = auth.uid()
    ),
    cur as (
        select k, i, hits::numeric / (hits + misses) as acc
        from stats where match_time = match_end and hits + misses >= min_attempts
    ),
    prev as (
        select k, i, sum(hits)::numeric / sum(hits + misses) as acc
        from stats join recent using (match_time)
        group by k, i having sum(hits + misses) >= min_attempts
    ),
    ranked as (
        select c.k, c.i, round(c.acc, 3) as cur_acc, round(p.acc, 3) as prev_acc,
           round(c.acc - p.acc, 3) as diff,
           row_number() over (partition by c.k order by c.acc - p.acc desc) as rn
        from cur c join prev p using (k, i)
        where c.acc - p.acc >= min_gain
    )
    select k, i, cur_acc, prev_acc, diff from ranked
    where rn <= max_results order by k, diff desc;
$$;

-- Function: Get multiplayer history
-- get_multiplayer_history(p_from timestamp, p_to timestamp)

-- Gets the multiplayer history of the user who called this function.
CREATE FUNCTION get_multiplayer_history(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(match_id uuid, finished_at timestamp with time zone, mode text, room_code text, outcome text, wpm numeric, accuracy numeric, opponent_name text, opponent_wpm numeric, opponent_accuracy numeric)
LANGUAGE sql
SECURITY definer
AS $$
    begin
    if p_from >= p_to then
        raise exception 'p_from must be before p_to' using errcode = '22023';
    end if;

    return query
        select r.match_id, r.finished_at, r.mode, r.room_code, r.outcome,
           r.wpm, r.accuracy,
           coalesce(u.username, 'Guest'),
           r.opponent_wpm, r.opponent_accuracy
        from users.multiplayer_results r
        left join users.users u on u.account_id = r.opponent_id
        where r.account_id = (select auth.uid())
            and (p_from is null or r.finished_at >= p_from)
            and (p_to is null or r.finished_at < p_to)
        order by r.finished_at desc;
    end; 
$$;

-- Function: Multiplayer Leaderboard
-- get_multiplayer_leaderboard()

-- Retrieves all the verified users who played multiplayer matches and orders them by effective WPM (WPM * Accuracy)
CREATE FUNCTION get_multiplayer_leaderboard()
RETURNS void
LANGUAGE sql
AS $$
    SELECT "Username", "WPM", avg as "Accuracy", "Rating"
    FROM users.multiplayer_histories
    ORDER BY "Rating" DESC;
$$;

-- Function: WPM + Accuracy History Graph
-- get_wpm_accur_history(acc_id uuid, p_from timestamp, p_to timestamp)

-- Retrieves the WPM & accuracy of matches within the timeframe specified for the graphs to be drawn on the history page.
CREATE FUNCTION get_wpm_accur_history(acc_id uuid, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(wpm numeric, accuracy numeric)
LANGUAGE plpgsql
SECURITY definer
AS $$
  begin
    if acc_id is distinct from auth.uid() then
      raise exception 'not allowed' using errcode = '42501';
    end if;

    if p_from >= p_to then
      raise exception 'p_from must be before p_to' using errcode = '22023';
    end if;

    return query
      select m.wpm, m.accuracy
      from users.matches m
      where m.account_id = acc_id
        and (p_from is null or m.match_time >= p_from)
        and (p_to is null or m.match_time < p_to)
      order by m.match_time desc;
  end;
$$;

-- Function: Availability of username
-- username_available(p_username text)

-- Checks to see if the username is taken or not
CREATE FUNCTION username_available(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY definer
AS $$
    select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (
       select 1 from users.users
       where lower(username) = lower(p_username)
     );
$$;

-- Function: Update player stats
CREATE FUNCTION update_player_stats(acc_id uuid, bigrams jsonb, keys jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
AS $$
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

-- Function: Set username
CREATE FUNCTION set_username(p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
AS $$
    begin
    if auth.uid() is null then
        raise exception 'not signed in' using errcode = '42501';
    end if;

    if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
        raise exception 'invalid username' using errcode = '22023';
    end if;

    update users.users u
    set username = p_username,
        name     = p_username
    where u.account_id = auth.uid()
        and (
            u.username is null
            or exists (select 1 from auth.users a where a.id = auth.uid() and a.is_anonymous)
        );                                   -- unique index raises 23505 if taken

    if not found then
        raise exception 'username already set';
    end if;
    end;
$$;

