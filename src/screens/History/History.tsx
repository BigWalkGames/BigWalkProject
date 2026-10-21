import './History.css';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryRow } from '../../components/HistoryRow/HistoryRow';

// TEMPORARY: replace with real data later
const PLACEHOLDER = Array.from({ length: 7 }, (_, i) => ({
  id: i,
  date: '09/08/26',
  wpm: 120 - i,
  accuracy: 85 - i,
}));

export default function History() {
  return (
    <ScreenLayout title="History">
      <div className="history">
        <div className="history__panel">
          <div className="history-table" role="table" aria-label="Test history">
            <div className="history-table__head" role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Words Per Minute</span>
              <span role="columnheader">Accuracy</span>
            </div>

            <div role="rowgroup">
              {PLACEHOLDER.map((row) => (
                <HistoryRow key={row.id} date={row.date} wpm={row.wpm} accuracy={row.accuracy} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScreenLayout>
  );
}