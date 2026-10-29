import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { ResultsPanel, type SaveStatus } from '../../features/typing/components/ResultsPanel';
import { DEFAULT_GAME_MODE, GAME_MODES } from '../../features/typing/gameModes';
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

  // Restart goes back to the mode that was played. Opened directly (no test
  // was just played): send them to take one in the mode this URL belongs to.
  const mode =
    result?.mode ??
    (location.pathname === GAME_MODES.classic.resultsRoute ? 'classic' : DEFAULT_GAME_MODE);
  const playRoute = GAME_MODES[mode].route;

  if (!result) return <Navigate to={playRoute} replace />;

  return (
    <ScreenLayout title="Results" showBack={false}>
      <ResultsPanel
        result={result}
        board={state?.board}
        saveStatus={saveStatus}
        onRestart={() => navigate(playRoute, { replace: true })}
        onMenu={() => navigate('/solo')}
      />
    </ScreenLayout>
  );
}
