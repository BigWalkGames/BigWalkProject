import '../TimeAttack/TimeAttack.css';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TypingTest } from '../../features/typing/components/TypingTest';
import { GAME_MODES } from '../../features/typing/gameModes';
import type { Board } from '../../features/typing/models/Board';
import type { TestResult } from '../../features/typing/stats/types';
import type { ResultsLocationState } from '../Results/Results';

/**
 * Plays exactly like Time Attack; only WPM differs: the original formula
 * (correct letters / 5 per minute) with no penalty for mistakes.
 * Reuses Time Attack's layout and styles.
 */
export default function Classic() {
  const navigate = useNavigate();

  const showResults = useCallback(
    (result: TestResult, board: Board) => {
      const state: ResultsLocationState = { result, board };
      navigate(GAME_MODES.classic.resultsRoute, { state, replace: true });
    },
    [navigate],
  );

  return (
    <ScreenLayout title={GAME_MODES.classic.label} backTo="/solo">
      <div className="time-attack">
        <TypingTest durationMs={30_000} mode="classic" onFinish={showResults} />
      </div>
    </ScreenLayout>
  );
}
