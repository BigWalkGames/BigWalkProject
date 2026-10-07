// TODO: paste the fallback word bank between the backticks.
// Any text works: it's split on spaces and line breaks, then cleaned on load
// (lowercased, anything except a-z removed), so line breaks, capitals and
// apostrophes are fine to leave in.
const FALLBACK_TEXT = `
we should be together loves so hard to find break your heart i 
would never girl id rather die really want ya say i wanna give 
you my name will forever yours every hour night day on my soul 
imma love like you been before put it anything everything have 
traveled all around the world and now here turns out dont need 
a rocket ship no own shooting star baby tryna live dream but 
need team if me let hear scream apple banana castle dragon 
elephant flower guitar house island jungle kangaroo lemon 
mountain notebook orange puzzle queen rocket sunshine tiger 
umbrella volcano whale xylophone yellow zebra
`

export const FALLBACK_WORDS: string[] = FALLBACK_TEXT.split(/\s+/).filter(Boolean)
