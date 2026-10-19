import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { signOut } from '../../hooks/auth/authActions';

export default function Account() {
  const [error, setError] = useState('');

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) setError(error.message);
  };

  return (
    <ScreenLayout title="Account">
      <p>Account page goes here.</p>
      <button onClick={handleSignOut}>Sign out</button>
      {error && <p role="alert">{error}</p>}
    </ScreenLayout>
  );
}
