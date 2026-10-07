export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

/** Makes the space key visible in tables. */
export function displayKey(key: string): string {
  return key === ' ' ? '␣' : key
}
