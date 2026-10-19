import type { StatsSink } from './types'

/** Default sink until the Supabase one is finished: just logs the result. */
export const consoleStatsSink: StatsSink = {
  async saveResult(result) {
    console.info('[stats] test finished', result)
  },
}
