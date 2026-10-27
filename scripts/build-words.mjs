// Builds db/words/words.csv from the google-10000-english word list.
// Usage: node scripts/build-words.mjs

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import nspell from 'nspell'
import en from 'dictionary-en'
import enGb from 'dictionary-en-gb'

const SOURCE_URL =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt'
const OUT_PATH = new URL('../db/words/words.csv', import.meta.url)

// QWERTY touch-typing layout. Fingers: 0 pinky, 1 ring, 2 middle, 3 index.
const LAYOUT = {
  q: ['L', 0, 0], w: ['L', 1, 0], e: ['L', 2, 0], r: ['L', 3, 0], t: ['L', 3, 0],
  a: ['L', 0, 1], s: ['L', 1, 1], d: ['L', 2, 1], f: ['L', 3, 1], g: ['L', 3, 1],
  z: ['L', 0, 2], x: ['L', 1, 2], c: ['L', 2, 2], v: ['L', 3, 2], b: ['L', 3, 2],
  y: ['R', 3, 0], u: ['R', 3, 0], i: ['R', 2, 0], o: ['R', 1, 0], p: ['R', 0, 0],
  h: ['R', 3, 1], j: ['R', 3, 1], k: ['R', 2, 1], l: ['R', 1, 1],
  n: ['R', 3, 2], m: ['R', 3, 2],
}

// Hunspell accepts many lowercase abbreviations at length <= 2 (pm, cd, st), so short words use an allowlist.
const SHORT_WORDS = new Set([
  'a', 'i',
  'ad', 'ah', 'am', 'an', 'as', 'at', 'aw', 'be', 'by', 'do', 'eh', 'ex', 'go', 'ha', 'he', 'hi', 'if', 'in',
  'is', 'it', 'ma', 'me', 'my', 'no', 'of', 'oh', 'on', 'or', 'ox', 'pa', 'so', 'to', 'uh', 'um', 'up', 'us',
  'we', 'ye', 'yo',
])
const spellers = [nspell(en), nspell(enGb)]

// Keeps dictionary words, including proper nouns (accepted when capitalized).
// Drops abbreviations (dictionary only has them uppercase: usa, pdf), brands and junk (ebay, www).
function isRealWord(word) {
  if (word.length <= 2) return SHORT_WORDS.has(word)
  if (!/[aeiouy]/.test(word)) return false // ltd, ftp, mph
  const capitalized = word[0].toUpperCase() + word.slice(1)
  return spellers.some((s) => s.correct(word) || s.correct(capitalized))
}

function classifyBigram(a, b) {
  if (a === b) return 'repeat'
  const [handA, fingerA, rowA] = LAYOUT[a]
  const [handB, fingerB, rowB] = LAYOUT[b]
  if (handA !== handB) return 'alternation'
  if (fingerA === fingerB) return 'same_finger'
  return Math.abs(rowA - rowB) === 2 ? 'row_jump' : 'roll'
}

function buildRow(word, rank) {
  const unique = [...new Set(word)].sort()
  const hands = new Set(unique.map((c) => LAYOUT[c][0]))
  const counts = { alternation: 0, roll: 0, row_jump: 0, same_finger: 0, repeat: 0 }
  const bigrams = []
  for (let i = 0; i < word.length - 1; i++) {
    bigrams.push(word[i] + word[i + 1])
    counts[classifyBigram(word[i], word[i + 1])]++
  }
  return [
    rank,
    word,
    word.length,
    unique.join(''),
    unique.reduce((mask, c) => mask | (1 << (c.charCodeAt(0) - 97)), 0),
    hands.size === 2 ? 'both' : hands.has('L') ? 'left' : 'right',
    `"{${bigrams.join(',')}}"`,
    counts.alternation,
    counts.roll,
    counts.row_jump,
    counts.same_finger,
    counts.repeat,
  ]
}

const res = await fetch(SOURCE_URL)
if (!res.ok) throw new Error(`Failed to fetch word list: ${res.status}`)
const source = (await res.text()).split('\n').map((w) => w.trim()).filter(Boolean)

const invalid = source.filter((w) => !/^[a-z]+$/.test(w))
if (invalid.length) throw new Error(`Non a-z words in source: ${invalid.slice(0, 10).join(', ')}`)

// rank stays the position among kept words, so it remains a contiguous frequency order.
const words = source.filter(isRealWord)
console.log(`Kept ${words.length} of ${source.length} words`)

const header = [
  'rank', 'word', 'length', 'letters', 'letter_mask', 'hand', 'bigrams',
  'alternation_count', 'roll_count', 'row_jump_count', 'same_finger_count', 'repeat_count',
]
const lines = [header.join(','), ...words.map((w, i) => buildRow(w, i + 1).join(','))]
await writeFile(OUT_PATH, lines.join('\n') + '\n')
console.log(`Wrote ${words.length} rows to ${fileURLToPath(OUT_PATH)}`)
