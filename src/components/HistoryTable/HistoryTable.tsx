import './HistoryTable.css';
import { HistoryRow } from '../HistoryRow/HistoryRow';
import { useMatchHistory, type HistoryFilter } from '../../hooks/useMatchHistory';

/** `filter` picks one game mode's matches; by default all are shown. */
export function HistoryTable({ filter = 'all' }: { filter?: HistoryFilter }) {
  const { entries, status } = useMatchHistory(filter);

  return (
    <div className="history-panel">
      <div className="history-table" role="table" aria-label="Test history">
        <div className="history-table__head" role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Words Per Minute</span>
          <span role="columnheader">Accuracy</span>
        </div>

        <div role="rowgroup">
          {status ? (
            <div className="history-table__status" role="row">
              <span role="cell">{status}</span>
            </div>
          ) : (
            entries.map((row) => (
              <HistoryRow key={row.id} date={row.date} wpm={row.wpm} accuracy={row.accuracy} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}