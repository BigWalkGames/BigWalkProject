import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeLocalStorage } from '../../tests/wordEngineFixtures';

const supabase = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../lib/supabase', () => ({ getSupabase: () => supabase.current }));

type Prefs = Record<string, unknown>;
type AuthUser = { id: string; is_anonymous: boolean };
type AuthCallback = (event: string, session: { user: AuthUser } | null) => void;

// Stands in for Supabase: auth events and the two settings functions.
class FakeSettingsSupabase {
  prefs: Prefs | null;
  saves: Prefs[] = [];
  reads = 0;
  private authCallback: AuthCallback | null = null;

  constructor(prefs: Prefs | null = null) {
    this.prefs = prefs;
  }

  auth = {
    onAuthStateChange: (callback: AuthCallback) => {
      this.authCallback = callback;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  };

  rpc = async (fn: string, args?: { patch: Prefs }) => {
    if (fn === 'get_my_settings') {
      this.reads++;
      return { data: this.prefs, error: null };
    }
    if (fn === 'save_my_settings') {
      this.saves.push(args!.patch);
      this.prefs = { ...(this.prefs ?? {}), ...args!.patch };
      return { data: null, error: null };
    }
    throw new Error(`Unexpected rpc: ${fn}`);
  };

  signIn(id = 'player-1') {
    this.authCallback?.('SIGNED_IN', { user: { id, is_anonymous: false } });
  }

  signInAsGuest(id = 'guest-1') {
    this.authCallback?.('SIGNED_IN', { user: { id, is_anonymous: true } });
  }

  // Verifying the upgrade code keeps the id and turns is_anonymous off.
  upgradeGuest(id = 'guest-1') {
    this.authCallback?.('USER_UPDATED', { user: { id, is_anonymous: false } });
  }

  signOut() {
    this.authCallback?.('SIGNED_OUT', null);
  }
}

const REMOTE = {
  typing: { caretSpeed: 'slow', smoothLines: false },
  emotes: { up: 'gl', left: 'hf', right: 'lol', down: 'thanks' },
};

// The stores and the sync module keep state at module level, so each test loads fresh copies.
async function setUp(prefs: Prefs | null = null) {
  const fake = new FakeSettingsSupabase(prefs);
  supabase.current = fake;
  vi.resetModules();
  const sync = await import('./settingsSync');
  const typing = await import('../typing/typingSettings');
  const emotes = await import('../versus/emoteSettings');
  const audio = await import('../audio/audioSettings');
  sync.startSettingsSync();
  return { fake, typing, emotes, audio };
}

beforeEach(() => {
  fakeLocalStorage();
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('settings sync', () => {
  it('uploads both sections on a first sign-in', async () => {
    const { fake, typing, emotes } = await setUp(null);
    fake.signIn();
    await vi.runAllTimersAsync();

    expect(fake.reads).toBe(1);
    expect(fake.saves).toEqual([
      { typing: typing.getTypingSettings(), emotes: emotes.getEmoteSlots() },
    ]);
  });

  it('applies an existing row and saves nothing back', async () => {
    const { fake, typing, emotes } = await setUp(REMOTE);
    fake.signIn();
    await vi.runAllTimersAsync();

    expect(typing.getTypingSettings()).toEqual(REMOTE.typing);
    expect(emotes.getEmoteSlots()).toEqual(REMOTE.emotes);
    expect(fake.saves).toEqual([]);
  });

  it('sends three quick edits as one save', async () => {
    const { fake, typing } = await setUp(REMOTE);
    fake.signIn();
    await vi.runAllTimersAsync();

    typing.setTypingSettings({ caretSpeed: 'fast' });
    await vi.advanceTimersByTimeAsync(100);
    typing.setTypingSettings({ smoothLines: true });
    await vi.advanceTimersByTimeAsync(100);
    typing.setTypingSettings({ caretSpeed: 'off' });

    // Each edit restarts the wait, so nothing is sent until 600 ms after the last one.
    await vi.advanceTimersByTimeAsync(500);
    expect(fake.saves).toEqual([]);
    await vi.runAllTimersAsync();

    expect(fake.saves).toEqual([{ typing: { caretSpeed: 'off', smoothLines: true } }]);
  });

  it('keeps an edit made while the account is loading', async () => {
    const { fake, typing } = await setUp(REMOTE);
    fake.signIn();
    // Signed in, but the deferred load hasn't run yet.
    typing.setTypingSettings({ caretSpeed: 'fast' });
    await vi.runAllTimersAsync();

    expect(typing.getTypingSettings().caretSpeed).toBe('fast');
    expect(fake.saves).toEqual([{ typing: typing.getTypingSettings() }]);
  });

  it('drops a pending save on sign-out', async () => {
    const { fake, typing } = await setUp(REMOTE);
    fake.signIn();
    await vi.runAllTimersAsync();

    typing.setTypingSettings({ caretSpeed: 'fast' });
    fake.signOut();
    await vi.runAllTimersAsync();

    expect(fake.saves).toEqual([]);
    expect(typing.getTypingSettings().caretSpeed).toBe('fast'); // still kept on this device
  });

  it('never sends audio settings', async () => {
    const { fake, audio } = await setUp(REMOTE);
    fake.signIn();
    await vi.runAllTimersAsync();

    audio.setAudioSettings({ master: 10, sfx: 20 });
    await vi.runAllTimersAsync();

    expect(fake.saves).toEqual([]);
  });

  it('ignores invalid values from the account', async () => {
    const { fake, typing } = await setUp({ typing: { caretSpeed: 'warp', smoothLines: 'yes' } });
    fake.signIn();
    await vi.runAllTimersAsync();

    expect(typing.getTypingSettings()).toEqual({ caretSpeed: 'medium', smoothLines: true });
  });

  it('never reads or saves for a guest', async () => {
    const { fake, typing } = await setUp(null);
    fake.signInAsGuest();
    await vi.runAllTimersAsync();

    typing.setTypingSettings({ caretSpeed: 'fast' });
    await vi.runAllTimersAsync();

    expect(fake.reads).toBe(0);
    expect(fake.saves).toEqual([]);
    expect(typing.getTypingSettings().caretSpeed).toBe('fast'); // kept on this device
  });

  it("uploads a guest's settings when they upgrade to a member", async () => {
    const { fake, typing, emotes } = await setUp(null);
    fake.signInAsGuest();
    typing.setTypingSettings({ caretSpeed: 'slow', smoothLines: false });
    emotes.setEmoteSlot('up', 'gl');
    await vi.runAllTimersAsync();
    expect(fake.saves).toEqual([]);

    fake.upgradeGuest();
    await vi.runAllTimersAsync();

    expect(fake.reads).toBe(1);
    expect(fake.saves).toEqual([
      { typing: { caretSpeed: 'slow', smoothLines: false }, emotes: emotes.getEmoteSlots() },
    ]);
    expect(emotes.getEmoteSlots().up).toBe('gl');
  });

  it('saves edits made after the upgrade', async () => {
    const { fake, typing } = await setUp(null);
    fake.signInAsGuest();
    fake.upgradeGuest();
    await vi.runAllTimersAsync();

    typing.setTypingSettings({ caretSpeed: 'off' });
    await vi.runAllTimersAsync();

    expect(fake.saves.at(-1)).toEqual({ typing: { caretSpeed: 'off', smoothLines: true } });
  });
});
