import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TypingTest } from '../../features/typing/components/TypingTest';

export default function TimeAttack() {
  return (
    <ScreenLayout title="Time Attack">
      <TypingTest durationMs={30_000} />
    </ScreenLayout>
  );
}
