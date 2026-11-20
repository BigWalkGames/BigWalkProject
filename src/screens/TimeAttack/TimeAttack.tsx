import './TimeAttack.css';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TypingTest } from '../../features/typing/components/TypingTest';
import type { Board } from '../../features/typing/models/Board';
import type { TestResult } from '../../features/typing/stats/types';
import type { ResultsLocationState } from '../Results/Results';
import { useTimeAttackLength } from '../../features/typing/timeAttackLength';

export default function TimeAttack() {
  const navigate = useNavigate();
  // Picked on the Solo menu (P48): 15, 30 or 60 seconds.
  const lengthSeconds = useTimeAttackLength();

  const showResults = useCallback(
    (result: TestResult, board: Board) => {
      const state: ResultsLocationState = { result, board, lengthSeconds };
      navigate('/solo/time-attack/results', { state, replace: true });
    },
    [navigate, lengthSeconds],
  );

  return (
    <ScreenLayout title="Time Attack" backTo="/solo" background="faded-still" header="gameplay">
      <div className="time-attack">
        <TypingTest durationMs={lengthSeconds * 1000} headerHud onFinish={showResults} />
      </div>
    </ScreenLayout>
  );
}
