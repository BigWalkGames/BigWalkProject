import './Account.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';
import { signOut } from '../../hooks/auth/authActions';

export default function Account() {
  const [error, setError] = useState('');

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) setError(error.message);
  };

  return (
    <ScreenLayout title="Account">
      <div className="account">
        <p>Account page goes here.</p>
        <button onClick={handleSignOut}>Sign out</button>
        {error && <p role="alert">{error}</p>}

        <div className="account__history">
          <HistoryTable />
        </div>
      </div>
    </ScreenLayout>
  );
}