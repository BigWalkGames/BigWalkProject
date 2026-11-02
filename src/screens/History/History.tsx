import './History.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';
import { TabNav, type Tab } from '../../components/TabNav/TabNav';
import type { HistoryPeriod } from '../../hooks/useMatchHistory';

const PERIODS: Tab[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export default function History() {
  const [period, setPeriod] = useState<HistoryPeriod>('all');

  return (
    <ScreenLayout title="History">
      <div className="history">
        <div className="history__content">
          <TabNav
            tabs={PERIODS}
            active={period}
            onChange={(id) => setPeriod(id as HistoryPeriod)}
            label="History period"
          />
          <HistoryTable period={period} />
        </div>
      </div>
    </ScreenLayout>
  );
}
