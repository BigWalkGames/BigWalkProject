import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { StateMessage } from '../../components/StateMessage/StateMessage';
import { startSearch } from '../../net/quickMatch';
import { useQuickMatch } from '../../net/useQuickMatch';

/** P15: waiting screen. Both players leave it together when the second one joins. P37: styled. */
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
      <StateMessage title="Finding Match..." message="Press Esc to cancel." pulse />
    </ScreenLayout>
  );
}
