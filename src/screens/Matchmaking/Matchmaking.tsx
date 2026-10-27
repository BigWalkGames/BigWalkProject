import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { startSearch } from '../../net/quickMatch';
import { useQuickMatch } from '../../net/useQuickMatch';

/** P15: waiting screen. Both players leave it together when the second one joins. */
export default function Matchmaking() {
  const navigate = useNavigate();
  const { status } = useQuickMatch();

  useEffect(() => {
    void startSearch();
  }, []);

  useEffect(() => {
    if (status === 'countdown' || status === 'racing') {
      navigate('/multiplayer/versus', { replace: true });
    }
  }, [status, navigate]);

  return (
    <ScreenLayout title="Quick Match">
      <p>Finding Match...</p>
      <p>Press Esc to cancel.</p>
    </ScreenLayout>
  );
}
