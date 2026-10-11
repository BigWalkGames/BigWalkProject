import { Fragment, useCallback, useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../utils/supabase";
import "./AuthTestPage.css";

type LogEntry = { time: string; msg: string };
type Message = { kind: "ok" | "err"; text: string };

const STATUS_LABEL = {
  out: "Signed out",
  guest: "Guest",
  member: "Signed in",
} as const;

const formatDate = (value: string | number) => new Date(value).toLocaleString();

/**
 * AuthTestPage
 * A throwaway page for testing Supabase guest (anonymous) + email/password auth.
 * Shows the live session so you can confirm what each action actually does.
 */
export default function AuthTestPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const user = session?.user ?? null;
  const isGuest = !!user?.is_anonymous;
  const isMember = !!user && !isGuest;
  const status = !user ? "out" : isGuest ? "guest" : "member";
  const credentials = { email, password };
  const canSubmit = email.trim() !== "" && password.length >= 6 && !busy;

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setEvents((prev) => [{ time, msg }, ...prev].slice(0, 30));
  }, []);

  // onAuthStateChange fires INITIAL_SESSION on subscribe, so it also covers
  // restoring an existing session; no separate getSession() call is needed.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      log(`Auth event: ${event}`);
    });
    return () => data.subscription.unsubscribe();
  }, [log]);

  // Wraps every action with busy / success / error handling
  const run = async (
    fn: () => Promise<{ error: Error | null }>,
    successMsg: string,
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await fn();
      if (error) throw error;
      setMessage({ kind: "ok", text: successMsg });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Something went wrong";
      setMessage({ kind: "err", text });
      log(`Error: ${text}`);
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = () =>
    run(() => supabase.auth.signInAnonymously(), "Signed in as a guest.");

  const signUp = () =>
    run(
      () => supabase.auth.signUp(credentials),
      "Account created. If email confirmation is on, check your inbox.",
    );

  const signIn = () =>
    run(() => supabase.auth.signInWithPassword(credentials), "Signed in.");

  // Turns the current guest into a permanent user, keeping the same user id
  const upgradeGuest = () =>
    run(
      () => supabase.auth.updateUser(credentials),
      "Upgrade requested. If email confirmation is on, confirm the link to finish.",
    );

  const signOut = () => run(() => supabase.auth.signOut(), "Signed out.");

  // Enter key submits: "Save account" for guests, "Sign in" otherwise
  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (canSubmit) (isGuest ? upgradeGuest : signIn)();
  };

  const sessionRows: [string, string][] = user
    ? [
        ["User id", user.id],
        ["Is anonymous", String(isGuest)],
        ["Email", user.email || "none"],
        ["Created", formatDate(user.created_at)],
        [
          "Token expires",
          session?.expires_at ? formatDate(session.expires_at * 1000) : "n/a",
        ],
      ]
    : [];

  if (loading) return <p style={{ padding: 24 }}>Loading session…</p>;

  return (
    <main className="at">
      <header className="at-head">
        <h1>Auth test page</h1>
        <span className={`at-badge ${status}`}>{STATUS_LABEL[status]}</span>
      </header>

      {message && (
        <div
          className={`at-msg ${message.kind}`}
          role={message.kind === "err" ? "alert" : "status"}>
          {message.text}
        </div>
      )}

      <div className="at-grid">
        {/* LEFT: actions */}
        <section className="at-card">
          {!user && (
            <>
              <h2>Get started</h2>
              <button
                className="primary"
                onClick={continueAsGuest}
                disabled={busy}>
                Continue as guest
              </button>
              <p className="hint">
                Creates an anonymous user. No email needed.
              </p>
              <div className="divider">
                <span>or use an account</span>
              </div>
            </>
          )}

          {isMember && (
            <>
              <h2>You're signed in</h2>
              <p className="hint">Signed in as {user.email}.</p>
            </>
          )}

          {isGuest && (
            <>
              <h2>Save your guest account</h2>
              <p className="hint">
                Add an email and password to keep this guest's data. The user id
                stays the same.
              </p>
            </>
          )}

          {!isMember && (
            <form onSubmit={handleSubmit} className="at-form">
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={isGuest ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="hint">At least 6 characters.</p>

              {isGuest ? (
                <button className="primary" disabled={!canSubmit}>
                  Save account
                </button>
              ) : (
                <div className="row">
                  <button disabled={!canSubmit}>Sign in</button>
                  <button type="button" onClick={signUp} disabled={!canSubmit}>
                    Create account
                  </button>
                </div>
              )}
            </form>
          )}

          {user && (
            <button className="danger" onClick={signOut} disabled={busy}>
              Sign out
            </button>
          )}
        </section>

        {/* RIGHT: inspector */}
        <section className="at-card">
          <h2>Current session</h2>
          {user ? (
            <dl className="at-dl">
              {sessionRows.map(([label, value]) => (
                <Fragment key={label}>
                  <dt>{label}</dt>
                  <dd className="mono">{value}</dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            <p className="hint">No active session.</p>
          )}

          <h2 style={{ marginTop: 24 }}>Event log</h2>
          <ul className="at-log">
            {events.length === 0 && <li className="hint">Nothing yet.</li>}
            {events.map((e, i) => (
              <li key={i}>
                <span className="mono">{e.time}</span> {e.msg}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
