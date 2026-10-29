import '../../components/HistoryTable/HistoryTable.css';
import '../../components/HistoryRow/HistoryRow.css';
import './MatchHistory.css';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { useMultiplayerHistory } from '../../hooks/useMultiplayerHistory';

/** Quick Match and Custom Game results, newest first. Same look as the Time Attack history. */
export default function MatchHistory() {
  const { entries, status } = useMultiplayerHistory();

  return (
    <ScreenLayout title="Match History" backTo="/multiplayer">
      <div className="match-history">
        <div className="history-panel">
          <div className="history-table match-history__table" role="table" aria-label="Match history">
            <div className="history-table__head" role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Mode</span>
              <span role="columnheader">Opponent</span>
              <span role="columnheader">Result</span>
              <span role="columnheader">You</span>
              <span role="columnheader">Them</span>
            </div>

            <div role="rowgroup">
              {status ? (
                <div className="history-table__status" role="row">
                  <span role="cell">{status}</span>
                </div>
              ) : (
                entries.map((row) => (
                  <div key={row.id} className="history-row" role="row">
                    <span role="cell">{row.date}</span>
                    <span role="cell">{row.mode}</span>
                    <span className="match-history__opponent" role="cell">{row.opponent}</span>
                    <span role="cell">{row.outcome}</span>
                    <span role="cell">{row.wpm} WPM · {row.accuracy}%</span>
                    <span role="cell">{row.opponentWpm} WPM · {row.opponentAccuracy}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}
