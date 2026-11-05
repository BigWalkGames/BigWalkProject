import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { NavButton } from '../../components/NavButton/NavButton';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { ResultsPanel, WordBankBox } from '../../features/typing/components/ResultsPanel';
import { LiveStats, StatsBar } from '../../features/typing/components/StatsBar';
import {
  computeBigramLatency,
  computeBigrams,
  computePerKey,
  computeWpm,
} from '../../features/typing/stats/computeStats';
import type { TestResult } from '../../features/typing/stats/types';
import { WordsDisplay } from '../../features/typing/components/WordsDisplay';
import { EmoteChat } from '../../features/versus/EmoteChat';
import { PlayerCards } from '../../features/versus/PlayerCards';
import { PlayerProgress } from '../../features/versus/PlayerProgress';
import { useEmoteKeys } from '../../features/versus/useEmoteKeys';
import { useVersusRace } from '../../features/versus/useVersusRace';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useQuickMatch } from '../../net/useQuickMatch';
import { getState, setReady, type Emote, type Progress } from '../../net/quickMatch';
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
  const { status, mode, match, countdown, raceStartedAt, opponent, result, sessionId, lobby, matchNumber, roomEnded, emotes } =
    useQuickMatch();

  // Custom Game rematch: who has pressed Ready again.
  const me = lobby?.players.find((player) => player.id === sessionId);
  const friend = lobby?.players.find((player) => player.id !== sessionId);

  // Opened directly (a refresh, or typing the address): there is no match, so go back.
  // Only checked once on arrival: a match that ends badly also goes idle, and
  // useQuickMatch sends that player to the Main Menu with a message instead.
  useEffect(() => {
    if (getState().status === 'idle') navigate('/multiplayer', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRematch = status === 'finished' && mode === 'custom' && !roomEnded;
  // Custom Game rematch: ready up again (press again to undo). The room stays open.
  const rematch = () => {
    if (canRematch) setReady(!me?.ready);
  };
  const playAgainNow = () => {
    if (status !== 'finished') return;
    // Quick Match: queue again. Custom Game: leave this room to make or join another.
    navigate(mode === 'custom' ? '/multiplayer/custom' : '/multiplayer/matchmaking', { replace: true });
  };
  useHotkeys({ r: rematch, q: playAgainNow });

  if (!match) {
    return <ScreenLayout title="Versus" backTo="/multiplayer" background="faded-still"><p>Waiting for the match...</p></ScreenLayout>;
  }
  // The rematch banner under the headline. `request` is the one that must not be missed.
  const friendWantsRematch = canRematch && Boolean(friend?.ready) && !me?.ready;
  let playAgain = '';
  let playAgainTone: RematchTone = 'info';
  if (mode === 'custom') {
    if (roomEnded) {
      playAgain = 'Your friend left, so the room is closed.';
      playAgainTone = 'closed';
    } else if (me?.ready) {
      playAgain = "You're ready for a rematch. Waiting for your friend...";
    } else if (friendWantsRematch) {
      playAgain = 'Your friend wants a rematch! Press R to play again.';
      playAgainTone = 'request';
    }
  }

  // Buttons under the results. The keys work too.
  const footer =
    status === 'finished' ? (
      <>
        {mode === 'custom' ? (
          <>
            <NavButton hotkey="R" onClick={rematch} disabled={!canRematch} highlight={friendWantsRematch}>
              {me?.ready ? 'Cancel Rematch' : 'Rematch'}
            </NavButton>
            <NavButton hotkey="Q" onClick={playAgainNow}>Custom Game</NavButton>
          </>
        ) : (
          <NavButton hotkey="Q" onClick={playAgainNow}>Play Again</NavButton>
        )}
      </>
    ) : undefined;

  return (
    <Race
      key={matchNumber}
      words={match.words}
      durationMs={match.durationSeconds * 1000}
      racing={status === 'racing'}
      startedAt={raceStartedAt}
      countdown={countdown}
      finished={status === 'finished'}
      opponent={opponent}
      result={result}
      sessionId={sessionId}
      emotes={emotes}
      chatOpen={status === 'finished' && !roomEnded}
      playAgain={playAgain}
      playAgainTone={playAgainTone}
      footer={footer}
    />
  );
}

type RematchTone = 'info' | 'request' | 'closed';

type RaceProps = {
  words: string[];
  durationMs: number;
  racing: boolean;
  startedAt: number | null;
  countdown: number | null;
  finished: boolean;
  opponent: Progress;
  result: ReturnType<typeof useQuickMatch>['result'];
  sessionId: string | null;
  emotes: Emote[];
  /** The room is still open after the results, so the players can keep chatting. */
  chatOpen: boolean;
  playAgain: string;
  playAgainTone: RematchTone;
  footer?: React.ReactNode;
};

// Split out so the race state (the words and counts) starts fresh with each match.
function Race({ words, durationMs, racing, startedAt, countdown, finished, opponent, result, sessionId, emotes, chatOpen, playAgain, playAgainTone, footer }: RaceProps) {
  const race = useVersusRace(words, racing, startedAt, durationMs);
  // After the match one short summary fits the screen. D swaps it for the full
  // breakdown, which scrolls inside its own box, so the page itself never scrolls.
  const [showDetails, setShowDetails] = useState(false);
  const summary = finished && Boolean(result);
  useHotkeys({ d: () => { if (summary) setShowDetails((open) => !open); } });
  // The arrow keys send emotes during the race and on the summary, until the room closes (P43).
  // Not on the Details view, where the arrows are free to scroll.
  const chatLive = racing || (summary && !showDetails && chatOpen);
  useEmoteKeys(chatLive);

  const mine = result && sessionId ? result.results[sessionId] : undefined;
  const theirs = result ? Object.entries(result.results).find(([id]) => id !== sessionId)?.[1] : undefined;
  // Same panel as Time Attack. WPM and accuracy are the server's official numbers;
  // the per-key table comes from this player's own keystrokes.
  const resultMs = result?.durationSeconds ? result.durationSeconds * 1000 : durationMs;
  const myResult: TestResult | null = mine
    ? {
        durationMs: resultMs,
        wpm: mine.wpm,
        rawWpm: computeWpm(mine.typed, resultMs),
        accuracy: mine.accuracy / 100,
        perKey: computePerKey(race.keystrokes),
        bigrams: computeBigrams(race.keystrokes),
        bigramLatencyMs: computeBigramLatency(race.keystrokes),
        keystrokes: race.keystrokes,
        wordBankSource: 'server',
        completedAt: new Date().toISOString(),
      }
    : null;
  const headline = !result ? '' : result.winner === null ? "It's a draw" : result.winner === sessionId ? 'You win!' : 'Opponent wins';

  const screenFooter = (
    <>
      {footer}
      {summary && myResult && (
        <NavButton hotkey="D" onClick={() => setShowDetails((open) => !open)}>
          {showDetails ? 'Summary' : 'Details'}
        </NavButton>
      )}
    </>
  );

  // Details: the same one-screen results layout Time Attack uses. The ResultsPanel has to be
  // the direct child of the screen body for that layout to fit the window.
  if (summary && showDetails) {
    return (
      <ScreenLayout title="Versus" backTo="/multiplayer" footer={screenFooter} background="faded-still">
        {myResult ? (
          <ResultsPanel result={myResult} board={race.board} saveStatus="saved" hideSaveStatus compact />
        ) : (
          <p>You: no result</p>
        )}
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Versus" backTo="/multiplayer" footer={screenFooter} background="faded-still">
      <div className="time-attack">
        <div className={`tt versus-tt${summary ? ' is-summary' : ''}`}>
          {/* The live row ticks on its own while racing, so the clock doesn't re-render the race. */}
          {racing ? (
            <LiveStats
              startedAt={startedAt}
              endedAt={null}
              durationMs={durationMs}
              keystrokeCount={race.typed}
              correctCount={race.correct}
              failCount={race.errors}
            />
          ) : (
            <StatsBar
              timeLeftMs={finished ? 0 : durationMs}
              wpm={mine ? mine.wpm : 0}
              accuracy={mine ? mine.accuracy / 100 : race.accuracy}
              hasTyped={race.typed > 0}
            />
          )}

          {!summary && <WordsDisplay board={race.board} showCursor={racing} />}

          {!summary && <PlayerProgress words={words} wordResults={opponent.wordResults ?? ''} />}

          {/* Sidebar: both players' numbers and the chat. */}
          <aside className="versus-side">
            {!summary && (
            <PlayerCards
              racing={racing}
              startedAt={startedAt}
              durationMs={durationMs}
              me={{ typed: race.typed, correct: race.correct, errors: race.errors }}
              opponent={opponent}
              myOfficial={mine ? { wpm: mine.wpm, accuracy: mine.accuracy } : undefined}
              theirOfficial={theirs ? { wpm: theirs.wpm, accuracy: theirs.accuracy } : undefined}
              winner={!result || result.winner === null ? null : result.winner === sessionId ? 'me' : 'them'}
            />
            )}
            <EmoteChat emotes={emotes} sessionId={sessionId} active={chatLive} closed={finished && !chatOpen} />
          </aside>

          {!summary && (
          <p className="tt-hint">
            {countdown !== null && `Starting in ${countdown}...`}
            {racing && !race.finishedTyping && `Opponent: ${opponent.correct} correct / ${opponent.typed} typed`}
            {racing && race.finishedTyping && 'Finished! Waiting for the results...'}
            {!racing && !finished && countdown === null && 'Waiting for the match to start...'}
          </p>
          )}

          {summary && result && (
            <div className="versus-results">
              <h2 className="versus-headline">{headline}</h2>
              {playAgain && (
                <p className={`versus-rematch is-${playAgainTone}`} role="status">
                  {playAgain}
                </p>
              )}
              {mine && theirs && (
                <div className="versus-compare" aria-label="Final numbers">
                  <CompareCard name="You" wpm={mine.wpm} accuracy={mine.accuracy} typed={mine.typed} isWinner={result.winner === sessionId} />
                  <CompareCard name="Opponent" wpm={theirs.wpm} accuracy={theirs.accuracy} typed={theirs.typed} isWinner={result.winner !== null && result.winner !== sessionId} />
                </div>
              )}
              <div className="versus-wordbank"><WordBankBox board={race.board} /></div>
              <p className="versus-more">Press D for the full breakdown.</p>
            </div>
          )}
        </div>
      </div>
    </ScreenLayout>
  );
}

function CompareCard({ name, wpm, accuracy, typed, isWinner }: { name: string; wpm: number; accuracy: number; typed: number; isWinner: boolean }) {
  return (
    <div className={`versus-compare__card${isWinner ? ' is-winner' : ''}`}>
      <h3 className="versus-compare__name">{name}</h3>
      <div className="versus-compare__numbers">
        <span><strong>{wpm}</strong> WPM</span>
        <span><strong>{accuracy}%</strong> accuracy</span>
        <span><strong>{typed}</strong> keystrokes</span>
      </div>
    </div>
  );
}
