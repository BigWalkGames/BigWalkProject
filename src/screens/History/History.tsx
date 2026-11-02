import './History.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';
import { TabNav } from '../../components/TabNav/TabNav';
import { PERIOD_TABS, type HistoryPeriod } from '../../hooks/historyPeriod';

export default function History() {
  const [period, setPeriod] = useState<HistoryPeriod>('all');

  return (
    <ScreenLayout title="History">
      <div className="history">
        <div className="history__content">
          <TabNav
            tabs={PERIOD_TABS}
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
