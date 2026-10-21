import { useMemo, useState, type CSSProperties } from 'react'
import {
  DEFAULT_CONFIG,
  cleanKeystrokes,
  computeBaselines,
  getFeedback,
  getWordBank,
  pickMode,
  updateStats,
  type PlayerData,
  type WordEngineConfig,
} from './engine'
import { DEFAULT_TYPIST, simulateMatch, type SimulatedTypist } from './simulate'
import { words, type Word } from './words'

const RECENT_MATCHES = 3

function emptyPlayer(netWpm: number): PlayerData {
  return { userId: '', netWpm, netAccuracy: 1, bigramStats: {}, keyStats: {} }
}

// "ce:200, ou:150" ↔ { ce: 200, ou: 150 }. Malformed entries are ignored.
function parseBigramMap(text: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const entry of text.split(',')) {
    const [bigram, value] = entry.split(':').map((s) => s.trim().toLowerCase())
    if (/^[a-z]{2}$/.test(bigram ?? '') && value && !Number.isNaN(Number(value))) map[bigram] = Number(value)
  }
  return map
}

function formatBigramMap(map: Record<string, number>): string {
  return Object.entries(map).map(([b, v]) => `${b}:${v}`).join(', ')
}

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14 }
const inputStyle: CSSProperties = { font: 'inherit', fontFamily: 'var(--mono)', padding: '4px 6px', minWidth: 0 }
const fieldsetStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 6,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 12,
  margin: 0,
}

function NumberField(props: { label: string, value: number, step?: number, onChange: (v: number) => void }) {
  return (
    <label style={fieldStyle}>
      {props.label}
      <input
        type="number"
        style={inputStyle}
        value={props.value}
        step={props.step ?? 1}
        onChange={(e) => {
          const v = e.target.valueAsNumber
          if (!Number.isNaN(v)) props.onChange(v)
        }}
      />
    </label>
  )
}

function TextField(props: { label: string, value: string, placeholder: string, onChange: (v: string) => void }) {
  return (
    <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
      {props.label}
      <input
        type="text"
        style={inputStyle}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  )
}

// Highlights the letters of any weak bigram inside the word.
function WordChip({ word, weak }: { word: Word, weak: Set<string> }) {
  const marked = new Set<number>()
  word.bigrams.forEach((b, i) => {
    if (weak.has(b)) {
      marked.add(i)
      marked.add(i + 1)
    }
  })
  return (
    <li
      title={`rank ${word.rank} · ${word.hand} · ${word.bigrams.join(' ')}`}
      style={{
        padding: '8px 12px',
        border: `1px solid ${marked.size ? 'var(--color-accent)' : 'var(--border)'}`,
        background: marked.size ? 'var(--color-frame)' : undefined,
        color: marked.size ? 'var(--color-light)' : undefined,
        borderRadius: 6,
        fontFamily: 'var(--mono)',
        fontSize: 18,
      }}
    >
      {[...word.word].map((ch, i) => (
        <span key={i} style={marked.has(i) ? { color: 'var(--color-accent)', fontWeight: 700 } : undefined}>
          {ch}
        </span>
      ))}
    </li>
  )
}

function BankTest() {
  const [config, setConfig] = useState<WordEngineConfig>(DEFAULT_CONFIG)
  const [typist, setTypist] = useState<SimulatedTypist>(DEFAULT_TYPIST)
  const [slowText, setSlowText] = useState(formatBigramMap(DEFAULT_TYPIST.slowBigrams))
  const [errorText, setErrorText] = useState(formatBigramMap(DEFAULT_TYPIST.errorBigrams))
  const [matchesPerRun, setMatchesPerRun] = useState(50)

  const [player, setPlayer] = useState<PlayerData>(() => emptyPlayer(60))
  const [matchCount, setMatchCount] = useState(0)
  const [recent, setRecent] = useState<string[][]>([])
  // Word engine output goes here.
  const [bank, setBank] = useState(() => getWordBank(words, DEFAULT_CONFIG.bankSize, null))

  const setConfigField = (key: keyof WordEngineConfig) => (v: number) => setConfig({ ...config, [key]: v })
  const setTypistField = (key: keyof SimulatedTypist) => (v: number) => setTypist({ ...typist, [key]: v })

  const recentSet = (history: string[][]) => new Set(history.flat())

  function nextBank(p: PlayerData, history: string[][]) {
    return getWordBank(words, config.bankSize, p, recentSet(history), config)
  }

  function simulate() {
    const t = { ...typist, slowBigrams: parseBigramMap(slowText), errorBigrams: parseBigramMap(errorText) }
    let p = player
    let history = recent
    for (let i = 0; i < matchesPerRun; i++) {
      const matchBank = nextBank(p, history)
      p = updateStats(p, cleanKeystrokes(simulateMatch(matchBank, t), config), config)
      history = [matchBank.map((w) => w.word), ...history].slice(0, RECENT_MATCHES)
    }
    setPlayer(p)
    setRecent(history)
    setMatchCount(matchCount + matchesPerRun)
    setBank(nextBank(p, history))
  }

  function reset() {
    const p = emptyPlayer(player.netWpm)
    setPlayer(p)
    setRecent([])
    setMatchCount(0)
    setBank(nextBank(p, []))
  }

  const baselines = useMemo(() => computeBaselines(player, config), [player, config])
  const mode = pickMode(player, baselines, config)
  const feedback = useMemo(() => getFeedback(player, config), [player, config])
  const weak = useMemo(() => new Set(feedback.weakestBigrams.map((b) => b.bigram)), [feedback])
  const hits = bank.filter((w) => w.bigrams.some((b) => weak.has(b))).length

  // Same count for frequency-only banks, as a reference for how much targeting adds.
  const coldHits = useMemo(() => {
    if (weak.size === 0) return null
    const runs = 20
    let total = 0
    for (let i = 0; i < runs; i++) {
      total += getWordBank(words, config.bankSize, null, new Set(), config)
        .filter((w) => w.bigrams.some((b) => weak.has(b))).length
    }
    return total / runs
  }, [weak, config])

  return (
    <main style={{ padding: '24px 16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 36, margin: 0 }}>Word Bank Test</h1>

      <fieldset style={fieldsetStyle}>
        <legend>Simulated typist</legend>
        <NumberField label="Net WPM (mode)" value={player.netWpm} onChange={(v) => setPlayer({ ...player, netWpm: v })} />
        <NumberField label="Base latency ms" value={typist.baseLatencyMs} onChange={setTypistField('baseLatencyMs')} />
        <NumberField label="Jitter ms" value={typist.jitterMs} onChange={setTypistField('jitterMs')} />
        <NumberField label="Same-finger penalty ms" value={typist.sameFingerPenaltyMs} onChange={setTypistField('sameFingerPenaltyMs')} />
        <NumberField label="Word-start penalty ms" value={typist.wordStartPenaltyMs} onChange={setTypistField('wordStartPenaltyMs')} />
        <NumberField label="Base error rate" value={typist.baseErrorRate} step={0.01} onChange={setTypistField('baseErrorRate')} />
        <TextField label="Slow bigrams (bigram:extra ms)" value={slowText} placeholder="ce:200, ou:150" onChange={setSlowText} />
        <TextField label="Error-prone bigrams (bigram:error rate)" value={errorText} placeholder="br:0.3" onChange={setErrorText} />
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend>Engine config</legend>
        <NumberField label="Bank size" value={config.bankSize} onChange={setConfigField('bankSize')} />
        <NumberField label="Targeted ratio" value={config.targetedRatio} step={0.1} onChange={setConfigField('targetedRatio')} />
        <NumberField label="Beginner WPM" value={config.beginnerWpm} onChange={setConfigField('beginnerWpm')} />
        <NumberField label="EWMA window" value={config.ewmaWindow} onChange={setConfigField('ewmaWindow')} />
        <NumberField label="Min samples" value={config.minSamples} onChange={setConfigField('minSamples')} />
        <NumberField label="kErr" value={config.kErr} step={0.5} onChange={setConfigField('kErr')} />
        <NumberField label="kConf" value={config.kConf} onChange={setConfigField('kConf')} />
        <NumberField label="Min word length" value={config.minWordLength} onChange={setConfigField('minWordLength')} />
        <NumberField label="Frequency pool" value={config.frequencyPool} step={500} onChange={setConfigField('frequencyPool')} />
      </fieldset>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <NumberField label="Matches per run" value={matchesPerRun} onChange={setMatchesPerRun} />
        <button type="button" onClick={simulate}>Simulate {matchesPerRun} matches</button>
        <button type="button" onClick={() => setBank(nextBank(player, recent))}>Refresh words</button>
        <button type="button" onClick={reset}>Reset player</button>
      </div>

      <p style={{ margin: 0 }}>
        Mode: <strong>{mode}</strong> · Matches simulated: <strong>{matchCount}</strong> ·
        {' '}{hits} of {bank.length} words contain a weak bigram
        {coldHits !== null && <> (frequency-only: ~{coldHits.toFixed(1)})</>}
      </p>

      <ol
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
          padding: 0,
          margin: 0,
          listStyle: 'none',
        }}
      >
        {bank.map((w) => <WordChip key={w.rank} word={w} weak={weak} />)}
      </ol>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, fontSize: 15 }}>
        <div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Weakest bigrams</h2>
          {feedback.weakestBigrams.length === 0
            ? <p>No data yet. Run a simulation.</p>
            : <ol style={{ margin: 0, fontFamily: 'var(--mono)' }}>
              {feedback.weakestBigrams.map((b) => <li key={b.bigram}>{b.bigram} = {b.weakness.toFixed(2)}</li>)}
            </ol>}
        </div>
        <div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Class latency</h2>
          {feedback.classSummary.length === 0
            ? <p>No baselines yet.</p>
            : <ul style={{ margin: 0, fontFamily: 'var(--mono)' }}>
              {feedback.classSummary.map((c) => (
                <li key={c.cls}>
                  {c.cls}: {c.latencyMs.toFixed(0)}ms ({c.vsAlternationMs >= 0 ? '+' : ''}{c.vsAlternationMs.toFixed(0)})
                </li>
              ))}
            </ul>}
        </div>
        <div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Hand accuracy</h2>
          <ul style={{ margin: 0, fontFamily: 'var(--mono)' }}>
            <li>left: {feedback.handSummary.left === null ? '—' : `${(feedback.handSummary.left * 100).toFixed(1)}%`}</li>
            <li>right: {feedback.handSummary.right === null ? '—' : `${(feedback.handSummary.right * 100).toFixed(1)}%`}</li>
          </ul>
        </div>
      </section>
    </main>
  )
}

export default BankTest
