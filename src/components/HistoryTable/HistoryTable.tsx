import './HistoryTable.css';
import { HistoryRow } from '../HistoryRow/HistoryRow';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import type { HistoryPeriod } from '../../hooks/historyPeriod';

type HistoryTableProps = {
  period?: HistoryPeriod; // default: full history
};

export function HistoryTable({ period = 'all' }: HistoryTableProps) {
  const { entries, status } = useMatchHistory(period);

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