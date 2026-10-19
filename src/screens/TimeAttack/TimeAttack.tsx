import './TimeAttack.css';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TypingTest } from '../../features/typing/components/TypingTest';

export default function TimeAttack() {
  return (
    <ScreenLayout title="Time Attack" backTo="/solo">
      <div className="time-attack">
        <TypingTest durationMs={30_000} />
      </div>
    </ScreenLayout>
  );
}