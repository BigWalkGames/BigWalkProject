import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { ResultsPanel, type SaveStatus } from '../../features/typing/components/ResultsPanel';
import type { Board } from '../../features/typing/models/Board';
import { supabaseStatsSink } from '../../features/typing/stats/supabaseStatsSink';
import type { TestResult } from '../../features/typing/stats/types';

/** `board` is optional: without it the Word Bank box is hidden. */
export type ResultsLocationState = { result: TestResult; board?: Board };

export default function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ResultsLocationState | null;
  const result = state?.result;

  // save the result and track whether it worked.
  const [save, setSave] = useState<{
    result: TestResult;
    status: SaveStatus;
  } | null>(null);

  useEffect(() => {
    if (!result) return;
    supabaseStatsSink.saveResult(result).then(
      () => setSave({ result, status: 'saved' }),
      (error: unknown) => {
        console.error('[stats] failed to save result', error);
        setSave({ result, status: 'error' });
      },
    );
  }, [result]);

  const saveStatus: SaveStatus =
    save && save?.result === result ? save.status : 'saving';

  // Opened directly (no test was just played): send them to take one.
  if (!result) return <Navigate to="/solo/time-attack" replace />;

  return (
    <ScreenLayout title="Results" showBack={false}>
      <ResultsPanel
        result={result}
        board={state?.board}
        saveStatus={saveStatus}
        onRestart={() => navigate('/solo/time-attack', { replace: true })}
        onMenu={() => navigate('/solo')}
      />
    </ScreenLayout>
  );
}
