import './HistoryRow.css';

type HistoryRowProps = {
  date: string;        // already formatted, e.g. "09/08/26"
  wpm: number;
  accuracy: number;    // 0-100
};

export function HistoryRow({ date, wpm, accuracy }: HistoryRowProps) {
  return (
    <div className="history-row" role="row">
      <span className="history-row__date" role="cell">{date}</span>
      <span className="history-row__wpm" role="cell">{wpm} WPM</span>
      <span className="history-row__acc" role="cell">{accuracy} %</span>
    </div>
  );
}