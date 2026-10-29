/**
 * The solo game modes. Routes, labels and the WPM formula for each mode live
 * here, so screens, saving and History read one list instead of hardcoding.
 */
export type GameMode = 'time-attack' | 'classic'

/**
 * - 'net': Net WPM from the project doc, (all characters / 5 - uncorrected
 *   errors) per minute, so mistakes left in lower it.
 * - 'classic': the original formula, correct letters / 5 per minute. Wrong
 *   letters just don't count; nothing is subtracted.
 */
export type WpmFormula = 'net' | 'classic'

export interface GameModeInfo {
  label: string
  route: string
  resultsRoute: string
  wpmFormula: WpmFormula
}

export const GAME_MODES: Record<GameMode, GameModeInfo> = {
  'time-attack': {
    label: 'Time Attack',
    route: '/solo/time-attack',
    resultsRoute: '/solo/time-attack/results',
    wpmFormula: 'net',
  },
  classic: {
    label: 'Classic',
    route: '/solo/classic',
    resultsRoute: '/solo/classic/results',
    wpmFormula: 'classic',
  },
}

/** Results saved before modes existed have no mode; they were all Time Attack. */
export const DEFAULT_GAME_MODE: GameMode = 'time-attack'

/**
 * Shows the mode selector on the History screen.
 * TODO(supabase): keep false until users.matches stores a mode and
 * get_all_matches returns it (see db/matches/game-mode.todo.sql). Until then
 * every saved match looks like Time Attack, so filtering would mislabel
 * Classic games. Flip to true once the backend is updated.
 */
export const HISTORY_MODE_FILTER_ENABLED = false
