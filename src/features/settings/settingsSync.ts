import { getSupabase } from '../../lib/supabase';
import {
  applyRemoteTypingSettings,
  getTypingSettings,
  loadDefaultTypingSettings,
  onTypingSettingsEdited,
} from '../typing/typingSettings';
import {
  applyRemoteEmoteSlots,
  getEmoteSlots,
  loadDefaultEmoteSlots,
  onEmoteSlotsEdited,
} from '../versus/emoteSettings';
import { DEFAULT_AUDIO_SETTINGS, setAudioSettings } from '../audio/audioSettings';

/**
 * Keeps typing and emote settings on the player's account.
 * Audio settings are deliberately left out: they stay on this device.
 */
type Prefs = { typing?: unknown; emotes?: unknown };
type Section = keyof Prefs;

const SAVE_DELAY_MS = 600;

/**
 * localStorage key for the id of the account whose settings are on this device.
 * It tells a returning guest (keep their settings) from a new one (start on defaults).
 */
const OWNER_KEY = 'bigwalk.settingsOwner';

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null; // storage unavailable
  }
}

function writeOwner(id: string) {
  try {
    localStorage.setItem(OWNER_KEY, id);
  } catch {
    // Storage unavailable: a reload may treat this guest as new.
  }
}

/**
 * Called whenever a guest is signed in, including on every page load.
 * A guest this device hasn't seen before is a new guest account, so they start
 * on the default settings, audio included. The same guest reloading keeps theirs.
 */
function startGuest(guestId: string) {
  const owner = readOwner();
  if (owner === guestId) return; // the same guest, back after a reload

  // No owner yet means the settings are from before this check existed:
  // let the guest keep them rather than resetting someone mid-session.
  if (owner !== null) {
    loadDefaultTypingSettings();
    loadDefaultEmoteSlots();
    setAudioSettings(DEFAULT_AUDIO_SETTINGS);
  }
  writeOwner(guestId);
}

let userId: string | null = null;
let loaded = false; // nothing is saved until the account's settings have been read
let pending: Prefs = {};
let timer: ReturnType<typeof setTimeout> | undefined;

function queue(section: Section, value: unknown) {
  if (!userId) return; // signed out: localStorage only
  pending = { ...pending, [section]: value };
  if (!loaded) return; // sent once loading finishes
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
}

async function flush() {
  clearTimeout(timer);
  if (!userId || !loaded || Object.keys(pending).length === 0) return;
  const patch = pending;
  pending = {};
  const { error } = await getSupabase().rpc('save_my_settings', { patch });
  if (error) {
    console.warn('[settings] save failed; retrying with the next change', error);
    pending = { ...patch, ...pending };
  }
}

async function load(id: string) {
  const { data, error } = await getSupabase().rpc('get_my_settings');
  if (id !== userId) return; // signed out or switched accounts while loading
  if (error) {
    console.warn('[settings] load failed; using this device’s settings', error);
    loaded = true; // later edits still save, one section at a time
    return;
  }

  const prefs = (data ?? {}) as Prefs;
  // A section edited while loading keeps the new local value.
  if (prefs.typing && !pending.typing) applyRemoteTypingSettings(prefs.typing);
  if (prefs.emotes && !pending.emotes) applyRemoteEmoteSlots(prefs.emotes);

  // Upload sections the account doesn't have yet: a first sign-in, or a section added since.
  if (!prefs.typing) pending.typing ??= getTypingSettings();
  if (!prefs.emotes) pending.emotes ??= getEmoteSlots();

  loaded = true;
  await flush();
}

/** Call once at startup, like startAudio(). */
export function startSettingsSync() {
  onTypingSettingsEdited((settings) => queue('typing', settings));
  onEmoteSlotsEdited((slots) => queue('emotes', slots));

  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    console.warn('[settings] Supabase unavailable; settings stay on this device', error);
    return;
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    // Only members sync. Guests keep settings on this device.
    // A guest upgrade keeps the user id and becomes a member so the settings
    // get a row in users.settings at the users id
    const user = session?.user;
    if (user?.is_anonymous) startGuest(user.id); // must run before the early return, since a guest's id is null below
    const id = user && !user.is_anonymous ? user.id : null;
    if (id) writeOwner(id); // a members settings are added to device
    if (id === userId) return; // token refresh, or still the same guest or member

    // New account or signed out: drop the old account's unsaved changes.
    // Its session is already gone, so they can't be saved anyway.
    clearTimeout(timer);
    pending = {};
    loaded = false;
    userId = id;

    // Supabase advises against calling it from inside this callback, so defer the load.
    if (id) setTimeout(() => void load(id), 0);
  });

  // Best effort: send a pending save when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
