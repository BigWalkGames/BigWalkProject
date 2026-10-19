// Adapted from elpddev/typing-test (https://github.com/elpddev/typing-test),
// Copyright Eyal Lapid, licensed under Apache-2.0 (see ../LICENSE-typing-test.txt).
// Modified: uuid replaced with crypto.randomUUID, ids kept stable across
// updates, unused DisplayType removed.

import type { SuccessStatus } from './SuccessStatus'

export interface Letter {
  char: string
  status: SuccessStatus
  id: string
}

export function createLetter(char: string): Letter {
  return { char, status: 'initial', id: crypto.randomUUID() }
}

export function withStatus(letter: Letter, status: SuccessStatus): Letter {
  return { ...letter, status }
}
