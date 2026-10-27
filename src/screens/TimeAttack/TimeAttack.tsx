import './TimeAttack.css';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TypingTest } from '../../features/typing/components/TypingTest';
import type { TestResult } from '../../features/typing/stats/types';
import type { ResultsLocationState } from '../Results/Results';

export default function TimeAttack() {
  const navigate = useNavigate();

  const showResults = useCallback(
    (result: TestResult) => {
      const state: ResultsLocationState = { result };
      navigate('/solo/time-attack/results', { state, replace: true });
    },
    [navigate],
  );

  return (
    <ScreenLayout title="Time Attack" backTo="/solo">
      <div className="time-attack">
        <TypingTest durationMs={30_000} onFinish={showResults} />
      </div>
    </ScreenLayout>
  );
}
