import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'
import { boardFromWords } from '../versus/boardFromWords'
import { DEFAULT_AUDIO_SETTINGS, levelToGain, type AudioSettings } from './audioSettings'
import { MAX_VOICES, SOUND_FILES, createSoundEngine } from './sound'
import { createTypingSoundTracker } from './typingSounds'

describe('audio settings', () => {
  // The store reads localStorage when it loads, so each test gets a fresh copy.
  async function freshSettings() {
    vi.resetModules()
    return import('./audioSettings')
  }

  beforeEach(() => {
    fakeLocalStorage()
  })

  it('starts at Master 50, SFX 100, Music 100', async () => {
    const { getAudioSettings } = await freshSettings()
    expect(getAudioSettings()).toEqual({ master: 50, sfx: 100, music: 100 })
  })

  it('saves levels and reads them back after a reload', async () => {
    const first = await freshSettings()
    first.setAudioSettings({ sfx: 30 })
    first.setAudioSettings({ master: 80, music: 0 })
    const reloaded = await freshSettings()
    expect(reloaded.getAudioSettings()).toEqual({ master: 80, sfx: 30, music: 0 })
  })

  it('keeps levels within 0-100 as whole numbers', async () => {
    const { getAudioSettings, setAudioSettings } = await freshSettings()
    setAudioSettings({ master: 140, sfx: -5, music: 33.6 })
    expect(getAudioSettings()).toEqual({ master: 100, sfx: 0, music: 34 })
  })

  it('falls back to defaults for corrupt or partial saved data', async () => {
    localStorage.setItem('bigwalk.audioSettings', '{"master":"loud","sfx":20}')
    expect((await freshSettings()).getAudioSettings()).toEqual({ master: 50, sfx: 20, music: 100 })
    localStorage.setItem('bigwalk.audioSettings', 'not json')
    expect((await freshSettings()).getAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS)
  })

  it('notifies listeners on change', async () => {
    const { setAudioSettings, subscribeAudioSettings } = await freshSettings()
    const listener = vi.fn()
    const stop = subscribeAudioSettings(listener)
    setAudioSettings({ sfx: 10 })
    stop()
    setAudioSettings({ sfx: 20 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('maps slider levels to gain on a squared curve', () => {
    expect(levelToGain(0)).toBe(0)
    expect(levelToGain(50)).toBeCloseTo(0.25)
    expect(levelToGain(100)).toBe(1)
    expect(levelToGain(150)).toBe(1)
  })
})

/**
 * A minimal stand-in for the Web Audio API, recording what was played.
 * `state` starts as given; `allowStart()` makes the next resume() succeed, like
 * a browser seeing a gesture that counts (resume() is rejected before that).
 */
function fakeAudio(state: 'running' | 'suspended' = 'running') {
  const started: { buffer: unknown; rate: number; end: () => void }[] = []
  const stateListeners: (() => void)[] = []
  let allowed = false
  const gain = () => ({
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
  })
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'statechange') stateListeners.push(listener)
    },
    resume: vi.fn(async () => {
      if (!allowed) throw new Error('not allowed to start')
      ctx.state = 'running'
      stateListeners.forEach((listener) => listener())
    }),
    createGain: vi.fn(gain),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        onended: null as null | (() => void),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(() =>
          started.push({ buffer: source.buffer, rate: source.playbackRate.value, end: () => source.onended?.() }),
        ),
      }
      return source
    }),
  }
  return { ctx, started, allowStart: () => (allowed = true) }
}

/** Lets fake loading, decoding and resume() promises finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

async function readyEngine(settings: AudioSettings = { master: 50, sfx: 100, music: 100 }, now = () => 0) {
  const { ctx, started } = fakeAudio()
  const current = { ...settings }
  const engine = createSoundEngine({
    createContext: () => ctx as unknown as AudioContext,
    loadFile: async (url) => new TextEncoder().encode(url).buffer as ArrayBuffer,
    decode: async (data) => ({ url: new TextDecoder().decode(data) }) as unknown as AudioBuffer,
    getSettings: () => current,
    random: () => 0.5,
    now,
  })
  engine.unlock()
  await settle()
  return { engine, ctx, started, settings: current }
}

describe('sound engine', () => {
  it('plays nothing before audio is unlocked', () => {
    const { ctx, started } = fakeAudio()
    const engine = createSoundEngine({
      createContext: () => ctx as unknown as AudioContext,
      loadFile: async () => new ArrayBuffer(0),
      decode: async () => ({}) as AudioBuffer,
      getSettings: () => DEFAULT_AUDIO_SETTINGS,
      random: Math.random,
      now: () => 0,
    })
    engine.preload()
    engine.play('key')
    expect(started).toHaveLength(0)
    expect(ctx.createGain).not.toHaveBeenCalled()
  })

  it('plays a key click from the key versions, with a small pitch change', async () => {
    const { engine, started } = await readyEngine()
    engine.play('key')
    expect(started).toHaveLength(1)
    const url = (started[0].buffer as { url: string }).url
    expect(SOUND_FILES.key).toContain(url)
    expect(started[0].rate).toBeGreaterThanOrEqual(0.97)
    expect(started[0].rate).toBeLessThanOrEqual(1.03)
  })

  it('is silent when Master or SFX is 0', async () => {
    const { engine, started, settings } = await readyEngine()
    settings.master = 0
    engine.play('key')
    settings.master = 50
    settings.sfx = 0
    engine.play('key')
    expect(started).toHaveLength(0)
  })

  it(`caps sounds at ${MAX_VOICES} at once, freeing a slot when one ends`, async () => {
    const { engine, started } = await readyEngine()
    for (let i = 0; i < MAX_VOICES + 3; i += 1) engine.play('key')
    expect(started).toHaveLength(MAX_VOICES)
    started[0].end()
    engine.play('key')
    expect(started).toHaveLength(MAX_VOICES + 1)
  })

  it('throttles menu move ticks but not key clicks', async () => {
    let t = 0
    const { engine, started } = await readyEngine(undefined, () => t)
    engine.play('menuMove')
    t = 10
    engine.play('menuMove')
    t = 100
    engine.play('menuMove')
    expect(started).toHaveLength(2)
    started.forEach((s) => s.end())
    started.length = 0
    engine.play('key')
    engine.play('key')
    expect(started).toHaveLength(2)
  })

  it('sets Master, SFX and Music volumes from the settings', async () => {
    const { engine, ctx, settings } = await readyEngine()
    const [master, sfx, music] = ctx.createGain.mock.results.map((r) => r.value)
    expect(master.gain.value).toBeCloseTo(0.25) // 50 squared
    settings.sfx = 50
    settings.music = 0
    engine.applyVolumes()
    expect(sfx.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.25, 0, expect.any(Number))
    expect(music.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, expect.any(Number))
    expect(engine.musicOutput()).toBe(music)
  })
})

describe('turning audio on', () => {
  function suspendedEngine(now: () => number) {
    const audio = fakeAudio('suspended')
    const engine = createSoundEngine({
      createContext: () => audio.ctx as unknown as AudioContext,
      loadFile: async (url) => new TextEncoder().encode(url).buffer as ArrayBuffer,
      decode: async (data) => ({ url: new TextDecoder().decode(data) }) as unknown as AudioBuffer,
      getSettings: () => DEFAULT_AUDIO_SETTINGS,
      random: () => 0.5,
      now,
    })
    engine.preload()
    return { engine, ...audio }
  }

  it('recovers when the first key (Esc) does not count, on the next key that does', async () => {
    let t = 0
    const { engine, started, allowStart } = suspendedEngine(() => t)
    await settle()

    // Esc first: the browser refuses to start audio, and its back click waits.
    engine.unlock()
    engine.play('menuBack')
    await settle()
    expect(engine.running()).toBe(false)
    expect(started).toHaveLength(0)

    // A letter a second later counts: audio starts and that key's click plays.
    t = 1000
    allowStart()
    engine.unlock()
    engine.play('key')
    await settle()
    expect(engine.running()).toBe(true)
    // Only the key click: the Esc click is too old to play now.
    expect(started.map((s) => (s.buffer as { url: string }).url)).toEqual([SOUND_FILES.key[1]])
  })

  it('plays the sound of the gesture that turned audio on', async () => {
    const { engine, started, allowStart } = suspendedEngine(() => 0)
    await settle()
    allowStart()
    engine.unlock()
    engine.play('menuSelect') // asked for before resume() finishes
    await settle()
    expect(started).toHaveLength(1)
  })

  it('plays nothing late if nothing ever turned audio on', async () => {
    const { engine, started } = suspendedEngine(() => 0)
    await settle()
    engine.play('key') // no gesture at all yet: skipped, not kept
    engine.unlock()
    await settle()
    expect(started).toHaveLength(0)
  })
})

describe('typing sound tracker', () => {
  it('picks key, space, wrong and backspace like the game would score them', () => {
    const tracker = createTypingSoundTracker(boardFromWords(['ab', 'cd']))
    expect(tracker.soundFor('a')).toBe('key')
    expect(tracker.soundFor('X')).toBe('wrong') // wrong letter (case-insensitive, still wrong)
    expect(tracker.soundFor('Backspace')).toBe('backspace')
    expect(tracker.soundFor('B')).toBe('key') // case-insensitive
    expect(tracker.soundFor(' ')).toBe('space')
    expect(tracker.soundFor(' ')).toBeNull() // double space at a word start is ignored
    expect(tracker.soundFor('c')).toBe('key')
    expect(tracker.soundFor(' ')).toBe('wrong') // space mid-word counts as a wrong letter
  })

  it('stays silent for keys the game ignores', () => {
    const tracker = createTypingSoundTracker(boardFromWords(['a']))
    expect(tracker.soundFor('Backspace')).toBeNull() // nothing to erase
    expect(tracker.soundFor('a')).toBe('key')
    expect(tracker.soundFor('b')).toBeNull() // board finished
    expect(createTypingSoundTracker().soundFor('a')).toBeNull() // no board yet
  })

  it('starts over on reset', () => {
    const tracker = createTypingSoundTracker(boardFromWords(['ab']))
    tracker.soundFor('a')
    tracker.reset(boardFromWords(['xy']))
    expect(tracker.soundFor('x')).toBe('key')
  })
})
