/**
 * Sound effects, played with the Web Audio API: short, preloaded sounds that
 * can overlap at typing speed with no delay, and never re-render anything.
 *
 * Chain: each sound -> SFX volume -> Master volume -> speakers. A Music
 * volume also feeds Master, ready for music later (see getMusicOutput).
 *
 * Browsers keep audio off until the player interacts with the page, so
 * startAudio() waits for the first key press or click. Before that, sounds
 * are skipped silently.
 */
import key1 from '../../assets/sounds/key-1.wav'
import key2 from '../../assets/sounds/key-2.wav'
import key3 from '../../assets/sounds/key-3.wav'
import space from '../../assets/sounds/space.wav'
import backspace from '../../assets/sounds/backspace.wav'
import wrong from '../../assets/sounds/wrong.wav'
import menuMove from '../../assets/sounds/menu-move.wav'
import menuSelect from '../../assets/sounds/menu-select.wav'
import menuBack from '../../assets/sounds/menu-back.wav'
import {
  getAudioSettings,
  levelToGain,
  subscribeAudioSettings,
  type AudioSettings,
} from './audioSettings'

export type SoundName =
  | 'key'
  | 'space'
  | 'backspace'
  | 'wrong'
  | 'menuMove'
  | 'menuSelect'
  | 'menuBack'

/** Several files for one name: a random one plays each time, so fast typing doesn't sound mechanical. */
export const SOUND_FILES: Record<SoundName, string[]> = {
  key: [key1, key2, key3],
  space: [space],
  backspace: [backspace],
  wrong: [wrong],
  menuMove: [menuMove],
  menuSelect: [menuSelect],
  menuBack: [menuBack],
}

/** Most sounds allowed at once; extra ones are skipped (they'd be lost in the noise anyway). */
export const MAX_VOICES = 8
/** Random pitch change per play, as a fraction (0.03 = up to 3% higher or lower). */
const PITCH_VARIATION = 0.03
/** Fewest milliseconds between two plays of these sounds, so sweeping the mouse doesn't spam ticks. */
const MIN_GAP_MS: Partial<Record<SoundName, number>> = { menuMove: 45 }
/** How quickly volume changes take effect, in seconds (smooth, so there's no pop). */
const VOLUME_SMOOTHING = 0.015
/**
 * A sound asked for while audio is still starting is kept this long (ms) and
 * played once it's on, so the key press or click that turns audio on still
 * makes its sound. Older ones are dropped rather than played late.
 */
const PENDING_MAX_AGE_MS = 300

interface EngineDeps {
  createContext: () => AudioContext
  loadFile: (url: string) => Promise<ArrayBuffer>
  /** Decodes a file. Works before any user gesture, so sounds are ready when audio turns on. */
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>
  getSettings: () => AudioSettings
  random: () => number
  now: () => number
}

export function createSoundEngine(deps: EngineDeps) {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let sfx: GainNode | null = null
  let music: GainNode | null = null
  const buffers = new Map<SoundName, AudioBuffer[]>()
  const lastPlayed = new Map<SoundName, number>()
  /** Sounds asked for while audio was starting, with when; at most one per name. */
  const pending = new Map<SoundName, number>()
  let voices = 0
  let preloading = false

  /** Downloads and decodes every sound (no audio output needed yet). */
  function preload() {
    if (preloading) return
    preloading = true
    for (const [name, urls] of Object.entries(SOUND_FILES) as [SoundName, string[]][]) {
      void Promise.all(urls.map(async (url) => deps.decode(await deps.loadFile(url)))).then(
        (decoded) => buffers.set(name, decoded),
        (error: unknown) => console.warn(`[sound] could not load "${name}"`, error),
      )
    }
  }

  function applyVolumes() {
    if (!ctx || !master || !sfx || !music) return
    const { master: m, sfx: s, music: mu } = deps.getSettings()
    const t = ctx.currentTime
    master.gain.setTargetAtTime(levelToGain(m), t, VOLUME_SMOOTHING)
    sfx.gain.setTargetAtTime(levelToGain(s), t, VOLUME_SMOOTHING)
    music.gain.setTargetAtTime(levelToGain(mu), t, VOLUME_SMOOTHING)
  }

  /** Plays the sounds that were waiting for audio to start, if they're still recent. */
  function playPending() {
    const t = deps.now()
    const waiting = [...pending]
    pending.clear()
    for (const [name, askedAt] of waiting) {
      if (t - askedAt <= PENDING_MAX_AGE_MS) play(name)
    }
  }

  /**
   * Creates the audio output, or asks the browser again to start it. Call from
   * a user gesture (a key press or click). Some gestures don't count for the
   * browser (Esc, Shift, a touch press), so keep calling this until running().
   */
  function unlock() {
    if (!ctx) {
      ctx = deps.createContext()
      ctx.addEventListener('statechange', () => {
        if (ctx?.state === 'running') playPending()
      })
      master = ctx.createGain()
      sfx = ctx.createGain()
      music = ctx.createGain()
      sfx.connect(master)
      music.connect(master)
      master.connect(ctx.destination)
      // Start at the saved levels right away, not faded in.
      const s = deps.getSettings()
      master.gain.value = levelToGain(s.master)
      sfx.gain.value = levelToGain(s.sfx)
      music.gain.value = levelToGain(s.music)
      preload()
    }
    // Rejected if the browser still says no; the next gesture tries again.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  }

  /** Whether audio is on (the browser has allowed it). */
  function running() {
    return ctx?.state === 'running'
  }

  /** Plays one sound effect at the current SFX and Master levels. Never throws. */
  function play(name: SoundName) {
    // Before any gesture there's no audio at all: skip. While audio is
    // starting, keep the sound for a moment (see PENDING_MAX_AGE_MS).
    if (!ctx || !sfx) return
    if (ctx.state !== 'running') {
      pending.set(name, deps.now())
      return
    }
    const { master: m, sfx: s } = deps.getSettings()
    if (m === 0 || s === 0) return
    const options = buffers.get(name)
    if (!options || options.length === 0 || voices >= MAX_VOICES) return

    const minGap = MIN_GAP_MS[name]
    if (minGap !== undefined) {
      const t = deps.now()
      if (t - (lastPlayed.get(name) ?? -Infinity) < minGap) return
      lastPlayed.set(name, t)
    }

    try {
      const source = ctx.createBufferSource()
      source.buffer = options[Math.floor(deps.random() * options.length)]
      source.playbackRate.value = 1 + (deps.random() * 2 - 1) * PITCH_VARIATION
      source.connect(sfx)
      voices += 1
      source.onended = () => {
        voices -= 1
        source.disconnect()
      }
      source.start()
    } catch (error) {
      console.warn(`[sound] could not play "${name}"`, error)
    }
  }

  return {
    preload,
    unlock,
    running,
    play,
    applyVolumes,
    /** Where music should connect once the game has some (it then follows the Music slider). */
    musicOutput: () => music,
    /** For tests. */
    activeVoices: () => voices,
  }
}

// An offline context only decodes; it doesn't need a user gesture. Its
// buffers play in the real context (resampled if the rates differ).
let decoder: OfflineAudioContext | null = null

const engine = createSoundEngine({
  createContext: () => new AudioContext(),
  loadFile: (url) => fetch(url).then((response) => response.arrayBuffer()),
  decode: (data) => (decoder ??= new OfflineAudioContext(1, 1, 44100)).decodeAudioData(data),
  getSettings: getAudioSettings,
  random: Math.random,
  now: () => performance.now(),
})

export const playSound = engine.play

/** The node to connect music to, or null until audio has started. For future music. */
export const getMusicOutput = engine.musicOutput

let started = false

/** Gestures that can turn audio on. Taps only count on release, hence pointerup/touchend. */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const

/**
 * Call once at app start: downloads the sounds after the first screen shows,
 * follows the volume settings, and turns audio on at the first key press or
 * click (browsers don't allow it sooner). It keeps listening until audio is
 * really on, since some keys (Esc, Shift) don't count for the browser.
 */
export function startAudio() {
  if (started || typeof window === 'undefined' || !('AudioContext' in window)) return
  started = true
  subscribeAudioSettings(engine.applyVolumes)
  const unlock = () => {
    if (engine.running()) {
      for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true)
      return
    }
    engine.unlock()
  }
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true)
  window.addEventListener('load', () => engine.preload(), { once: true })
  if (document.readyState === 'complete') engine.preload()
}
