import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { NavButton } from '../../components/NavButton/NavButton';
import { formatPercent } from '../../features/typing/components/format';
import { supabaseStatsSink } from '../../features/typing/stats/supabaseStatsSink';
import type { TestResult } from '../../features/typing/stats/types';
import { useHotkeys } from '../../hooks/useHotkeys';
import './Results.css';

// Keys are ignored briefly so the last letters of the test can't trigger a button.
const HOTKEY_DELAY_MS = 700;

type SaveStatus = 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveStatus, string> = {
  saving: 'Saving...',
  saved: 'Saved to your history',
  error: "Couldn't save this result",
};

export type ResultsLocationState = { result: TestResult };

export default function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as ResultsLocationState | null)?.result;

  const [hotkeysReady, setHotkeysReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHotkeysReady(true), HOTKEY_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  useHotkeys(
    {
      q: () => navigate('/solo/time-attack'),
      h: () => navigate('/'),
    },
    { enabled: hotkeysReady },
  );

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
    <main className="results">
      <h1 className="results__title">Results</h1>

      <section className="results__panel" aria-label="Your results">
        <div className="results__stat">
          <span className="results__value">{Math.round(result.wpm)}</span>
          <span className="results__label">WPM</span>
        </div>
        <div className="results__stat">
          <span className="results__value">
            {formatPercent(result.accuracy)}
          </span>
          <span className="results__label">Accuracy</span>
        </div>
      </section>

      <p className={`results__save is-${saveStatus}`} role="status">
        {SAVE_LABEL[saveStatus]}
      </p>

      <nav className="results__actions" aria-label="Next">
        <NavButton to="/solo/time-attack" hotkey="Q">
          Time Attack
        </NavButton>
        <NavButton to="/" hotkey="H">
          Home
        </NavButton>
      </nav>
    </main>
  );
}
