import { useEffect, useRef, useState } from 'react';
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
import { CountUp } from '../../features/versus/CountUp';
import { PlayerCards } from '../../features/versus/PlayerCards';
import { PlayerProgress } from '../../features/versus/PlayerProgress';
import { useEmoteKeys } from '../../features/versus/useEmoteKeys';
import { useVersusRace } from '../../features/versus/useVersusRace';
import { COUNT_MS, NUMBERS_DELAY_MS, useMatchEndMorph } from '../../features/versus/useMatchEndMorph';
import { ProfilePicture } from '../../components/ProfilePicture/ProfilePicture';
import { opponentProfile } from '../../features/profile/profilePicture';
import { useMyProfilePicture } from '../../features/profile/useMyProfilePicture';
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
  // Both return false when they don't apply (e.g. typing R or Q mid-race), so
  // no menu click plays.
  const rematch = () => {
    if (!canRematch) return false;
    setReady(!me?.ready);
  };
  const playAgainNow = () => {
    if (status !== 'finished') return false;
    // Quick Match: queue again. Custom Game: leave this room to make or join another.
    navigate(mode === 'custom' ? '/multiplayer/custom' : '/multiplayer/matchmaking', { replace: true });
  };
  useHotkeys({ r: rematch, q: playAgainNow });

  if (!match) {
    return <ScreenLayout title="Versus" backTo="/multiplayer" background="faded-still" header="gameplay"><p>Waiting for the match...</p></ScreenLayout>;
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
  // The cards grow into the result boxes when the results arrive (useMatchEndMorph).
  // `revealed` turns on one render after the result, so the race layout can be measured first.
  const rootRef = useRef<HTMLDivElement>(null);
  const { revealed, animating } = useMatchEndMorph(rootRef, finished && Boolean(result));
  const summary = finished && Boolean(result) && revealed;
  const myPicture = useMyProfilePicture();
  const theirProfile = opponentProfile();
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
      <ScreenLayout title="Versus" backTo="/multiplayer" footer={screenFooter} background="faded-still" header="gameplay">
        {myResult ? (
          <ResultsPanel result={myResult} board={race.board} saveStatus="saved" hideSaveStatus compact />
        ) : (
          <p>You: no result</p>
        )}
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Versus" backTo="/multiplayer" footer={screenFooter} background="faded-still" header="gameplay">
      <div className="time-attack" ref={rootRef}>
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
            <div data-morph="chat">
              <EmoteChat emotes={emotes} sessionId={sessionId} active={chatLive} closed={finished && !chatOpen} />
            </div>
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
              <h2 className="versus-headline" data-reveal>{headline}</h2>
              {playAgain && (
                <p className={`versus-rematch is-${playAgainTone}`} role="status" data-reveal>
                  {playAgain}
                </p>
              )}
              {mine && theirs && (
                <div className="versus-compare" aria-label="Final numbers">
                  <CompareCard side="me" name="You" picture={myPicture} wpm={mine.wpm} accuracy={mine.accuracy} typed={mine.typed}
                    outcome={result.winner === null ? 'draw' : result.winner === sessionId ? 'win' : 'loss'} animate={animating} />
                  <CompareCard side="them" name={theirProfile.name} picture={theirProfile.picture} wpm={theirs.wpm} accuracy={theirs.accuracy} typed={theirs.typed}
                    outcome={result.winner === null ? 'draw' : result.winner === sessionId ? 'loss' : 'win'} animate={animating} />
                </div>
              )}
              <div className="versus-wordbank" data-reveal><WordBankBox board={race.board} /></div>
              <p className="versus-more" data-reveal>Press D for the full breakdown.</p>
            </div>
          )}
        </div>
      </div>
    </ScreenLayout>
  );
}

type CompareCardProps = {
  /** Matches the race card that grows into this box (see useMatchEndMorph). */
  side: 'me' | 'them';
  name: string;
  picture: string | null;
  wpm: number;
  accuracy: number;
  typed: number;
  /** Winner: orange. Loser: gray. Draw: both stay brown like the race cards. */
  outcome: 'win' | 'loss' | 'draw';
  /** Count the numbers up from 0 (only right when the match ends). */
  animate: boolean;
};

function CompareCard({ side, name, picture, wpm, accuracy, typed, outcome, animate }: CompareCardProps) {
  const count = { animate, delayMs: NUMBERS_DELAY_MS, durationMs: COUNT_MS };
  return (
    <div className={`versus-compare__card is-${outcome}`}>
      {/* The box's color and border live on this empty layer, so only it changes size while morphing. */}
      <span className="versus-compare__bg" data-morph={`card-${side}`} data-morph-kind="box" aria-hidden="true" />
      <h3 className="versus-compare__name">
        <span className="versus-pfp" data-morph={`pfp-${side}`}><ProfilePicture pictureId={picture} size="md" /></span>
        <span data-morph={`name-${side}`}>{name}</span>
      </h3>
      <div className="versus-compare__numbers" data-morph-fade>
        <span><strong><CountUp value={wpm} {...count} /></strong> WPM</span>
        <span><strong><CountUp value={accuracy} suffix="%" {...count} /></strong> accuracy</span>
        <span><strong><CountUp value={typed} {...count} /></strong> keystrokes</span>
      </div>
    </div>
  );
}
