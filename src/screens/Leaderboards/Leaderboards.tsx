import './Leaderboards.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TabNav } from '../../components/TabNav/TabNav';
import { LeaderboardRow } from '../../components/LeaderBoardRow/LeaderBoardRow';
import { PERIOD_TABS, type HistoryPeriod } from '../../hooks/historyPeriod';
import { useLeaderboard } from '../../hooks/useLeaderboard';

/** Multiplayer leaderboard: best effective WPM first, top three in gold, silver and bronze. */
export default function Leaderboards() {
  // TODO(supabase): the tabs switch, but every period shows the all-time list
  // until the leaderboard RPC takes a date range (see useLeaderboard).
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const { entries, status } = useLeaderboard();

  return (
    <ScreenLayout title="Leaderboards" backTo="/multiplayer">
      <div className="leaderboards">
        <div className="leaderboards__content">
          <TabNav
            tabs={PERIOD_TABS}
            active={period}
            onChange={(id) => setPeriod(id as HistoryPeriod)}
            label="Leaderboard period"
          />

          <div className="leaderboards__panel">
            {status ? (
              <p className="leaderboards__status">{status}</p>
            ) : (
              <ol className="leaderboards__list" aria-label="Leaderboard">
                {entries.map((e) => (
                  <LeaderboardRow
                    key={`${e.rank}-${e.name}`}
                    rank={e.rank}
                    name={e.name}
                    wpm={e.wpm}
                    accuracy={e.accuracy}
                    wins={e.wins}
                  />
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}
