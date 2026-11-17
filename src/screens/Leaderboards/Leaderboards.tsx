import './Leaderboards.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TabNav } from '../../components/TabNav/TabNav';
import { LeaderboardRow } from '../../components/LeaderBoardRow/LeaderBoardRow';
import { PERIOD_TABS, type HistoryPeriod } from '../../hooks/historyPeriod';
import { filterLeaderboard, useLeaderboard } from '../../hooks/useLeaderboard';

/** Multiplayer leaderboard: best effective WPM first, top three in gold, silver and bronze. */
export default function Leaderboards() {
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const { entries: all, status: loadStatus } = useLeaderboard();
  // Day / Week / Month / Year: players whose latest match is in that period.
  const entries = filterLeaderboard(all, period);
  const status = loadStatus ?? (entries.length === 0 ? 'No players in this period.' : null);

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
