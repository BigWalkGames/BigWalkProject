// TODO: paste the fallback word bank between the backticks.
// Any text works: it's split on spaces and line breaks, then cleaned on load
// (lowercased, anything except a-z removed), so line breaks, capitals and
// apostrophes are fine to leave in.
const FALLBACK_TEXT = `
the quick brown fox jumps over the lazy dog
walk path light stone river green house water
small world place sound think every great night
`

export const FALLBACK_WORDS: string[] = FALLBACK_TEXT.split(/\s+/).filter(Boolean)
