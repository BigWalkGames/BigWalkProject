import './History.css';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';

export default function History() {
  return (
    <ScreenLayout title="History">
      <div className="history">
        <HistoryTable />
      </div>
    </ScreenLayout>
  );
}