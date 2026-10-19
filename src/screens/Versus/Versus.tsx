import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { ResultsPanel } from '../../features/typing/components/ResultsPanel';
import { Stat, StatsBar } from '../../features/typing/components/StatsBar';
import { computePerKey, computeWpm } from '../../features/typing/stats/computeStats';
import type { TestResult } from '../../features/typing/stats/types';
import { WordsDisplay } from '../../features/typing/components/WordsDisplay';
import { useVersusRace } from '../../features/versus/useVersusRace';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useQuickMatch } from '../../net/useQuickMatch';
import { getState } from '../../net/quickMatch';
import '../../features/typing/components/typing.css';
import '../TimeAttack/TimeAttack.css';
import '../../features/versus/versus.css';

/**
 * Quick Match race (P19, P20, P21). Reuses the Time Attack board and stats bar.
 * The words, the countdown and the start come from the server.
 *
 * The opponent box and the results are plain text for now; they are meant to be
 * replaced by the real opponent word box (P20) and results screen (P21).
 */
export default function Versus() {
  const navigate = useNavigate();
  const { status, match, countdown, raceStartedAt, opponent, result, sessionId } = useQuickMatch();

  // Opened directly (a refresh, or typing the address): there is no match, so go back.
  // Only checked once on arrival: a match that ends badly also goes idle, and
  // useQuickMatch sends that player to the Main Menu with a message instead.
  useEffect(() => {
    if (getState().status === 'idle') navigate('/multiplayer', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHotkeys({
    q: () => {
      if (status === 'finished') navigate('/multiplayer/matchmaking', { replace: true });
    },
  });

  if (!match) {
    return <ScreenLayout title="Versus" backTo="/multiplayer"><p>Waiting for the match...</p></ScreenLayout>;
  }
  return (
    <Race
      words={match.words}
      durationMs={match.durationSeconds * 1000}
      racing={status === 'racing'}
      startedAt={raceStartedAt}
      countdown={countdown}
      finished={status === 'finished'}
      opponent={opponent}
      result={result}
      sessionId={sessionId}
    />
  );
}

type RaceProps = {
  words: string[];
  durationMs: number;
  racing: boolean;
  startedAt: number | null;
  countdown: number | null;
  finished: boolean;
  opponent: { typed: number; correct: number };
  result: ReturnType<typeof useQuickMatch>['result'];
  sessionId: string | null;
};

// Split out so the race state (the words and counts) starts fresh with each match.
function Race({ words, durationMs, racing, startedAt, countdown, finished, opponent, result, sessionId }: RaceProps) {
  const race = useVersusRace(words, racing, startedAt, durationMs);

  const mine = result && sessionId ? result.results[sessionId] : undefined;
  const theirs = result ? Object.entries(result.results).find(([id]) => id !== sessionId)?.[1] : undefined;
  // Same panel as Time Attack. WPM and accuracy are the server's official numbers;
  // the per-key table comes from this player's own keystrokes.
  const myResult: TestResult | null = mine
    ? {
        durationMs,
        wpm: mine.wpm,
        rawWpm: computeWpm(mine.typed, durationMs),
        accuracy: mine.accuracy / 100,
        perKey: computePerKey(race.keystrokes),
        keystrokes: race.keystrokes,
        wordBankSource: 'server',
        completedAt: new Date().toISOString(),
      }
    : null;
  const headline = !result ? '' : result.winner === null ? "It's a draw" : result.winner === sessionId ? 'You win!' : 'Opponent wins';

  return (
    <ScreenLayout title="Versus" backTo="/multiplayer">
      <div className="time-attack">
        <div className="tt">
          <StatsBar
            timeLeftMs={finished ? 0 : race.timeLeftMs}
            wpm={mine ? mine.wpm : race.wpm}
            accuracy={mine ? mine.accuracy / 100 : race.accuracy}
            hasTyped={race.typed > 0}
          />

          <WordsDisplay board={race.board} showCursor={racing} />

          <p className="tt-hint">
            {countdown !== null && `Starting in ${countdown}...`}
            {racing && `Opponent: ${opponent.correct} correct / ${opponent.typed} typed`}
            {!racing && !finished && countdown === null && 'Waiting for the match to start...'}
          </p>

          {finished && result && (
            <div className="versus-results">
              <h2 className="versus-headline">{headline}</h2>
              {theirs && (
                <div className="tt-stats versus-opponent" aria-label="Opponent results">
                  <Stat label="Opponent WPM" value={theirs.wpm.toString()} />
                  <Stat label="Opponent accuracy" value={`${theirs.accuracy}%`} />
                  <Stat label="Opponent keystrokes" value={theirs.typed.toString()} />
                </div>
              )}
              {myResult ? (
                <ResultsPanel result={myResult} saveStatus="saved" />
              ) : (
                <p>You: no result</p>
              )}
              <p className="versus-playagain">Press Q to play again, or Esc for the Main Menu.</p>
            </div>
          )}
        </div>
      </div>
    </ScreenLayout>
  );
}
