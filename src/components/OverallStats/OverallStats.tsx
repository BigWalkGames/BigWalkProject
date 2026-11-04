import './OverallStats.css';
import { useOverallStats } from '../../hooks/useOverallStats';

export function OverallStats() {
  const { stats, status } = useOverallStats();

  return (
    <section className="overall-stats" aria-label="Overall stats">
      <div className="overall-stats__tile">
        <span className="overall-stats__label">Overall WPM</span>
        <span className="overall-stats__value">{status ?? `${stats?.wpm} WPM`}</span>
      </div>
      <div className="overall-stats__tile">
        <span className="overall-stats__label">Overall Accuracy</span>
        <span className="overall-stats__value">{status ?? `${stats?.accuracy} %`}</span>
      </div>
    </section>
  );
}
