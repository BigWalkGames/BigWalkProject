import './TimeAttack.css';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TypingTest } from '../../features/typing/components/TypingTest';

export default function TimeAttack() {
  const navigate = useNavigate();
  // The results screen has its own Menu / Restart bar, so hide Back there.
  const [showingResults, setShowingResults] = useState(false);

  return (
    <ScreenLayout title="Time Attack" backTo="/solo" showBack={!showingResults}>
      <div className="time-attack">
        <TypingTest
          durationMs={30_000}
          onMenu={() => navigate('/solo')}
          onFinishedChange={setShowingResults}
        />
      </div>
    </ScreenLayout>
  );
}
