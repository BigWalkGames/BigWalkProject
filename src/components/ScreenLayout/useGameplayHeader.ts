import { createContext, useContext } from 'react';

/** The places in the gameplay header that a screen's content can portal into. */
export type GameplayHeaderSlots = {
  hud: HTMLElement | null;       // left side: timer, WPM, accuracy
  shortcuts: HTMLElement | null; // right side, before Back
};

export const GameplayHeaderContext = createContext<GameplayHeaderSlots | null>(null);

/** The gameplay header's slots, or null on a screen with the standard header. */
export function useGameplayHeader() {
  return useContext(GameplayHeaderContext);
}
