import './History.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';
import type { HistoryFilter } from '../../hooks/useMatchHistory';
import {
  GAME_MODES,
  HISTORY_MODE_FILTER_ENABLED,
  type GameMode,
} from '../../features/typing/gameModes';

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(GAME_MODES) as GameMode[]).map((mode) => ({
    value: mode,
    label: GAME_MODES[mode].label,
  })),
];

export default function History() {
  const [filter, setFilter] = useState<HistoryFilter>('all');

  return (
    <ScreenLayout title="History">
      <div className="history">
        {/* Hidden until Supabase saves the mode; see HISTORY_MODE_FILTER_ENABLED. */}
        {HISTORY_MODE_FILTER_ENABLED && (
          <div className="history__filter" role="group" aria-label="Game mode">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="history__filter-btn"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <HistoryTable filter={filter} />
      </div>
    </ScreenLayout>
  );
}
