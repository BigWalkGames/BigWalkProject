import './Account.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';
import { FormMessage } from '../../components/AuthForm/AuthForm';
import { useAuth } from '../../hooks/auth/useAuth';
import { signOut } from '../../hooks/auth/authActions';
import { GuestUpgrade } from './GuestUpgrade';

export default function Account() {
  const { user, isGuest } = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false); // for guests that clicked 'create account'
  const [upgrading, setUpgrading] = useState(false); // keeps the upgrade form up until it finishes
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const formOpen = showForm || upgrading;

  const openForm = () => {
    setShowForm(true);
    setConfirmSignOut(false);
    setNotice('');
  };

  const closeForm = () => {
    setShowForm(false);
    setUpgrading(false);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) setError(error.message);
  };

  const username = user?.user_metadata?.username as string | undefined;

  return (
    <ScreenLayout title="Account">
      <div className="account">
        <h1>Stats</h1>

        {formOpen ? (
          <GuestUpgrade
            onStarted={() => setUpgrading(true)}
            onCancel={closeForm}
            onFinished={(message) => {
              closeForm();
              setNotice(message);
            }}
          />
        ) : isGuest ? (
          <div className="account__create">
            <button className="auth-button" onClick={openForm}>
              Create account
            </button>
            <p className="account__create-text">
              Creating an account saves your matches and stats, so you can log in
              from any device.
            </p>
          </div>
        ) : (
          <div className="account__member">
            {username && <p className="account__username">{username}</p>}
            {user?.email && <p className="account__email">{user.email}</p>}
          </div>
        )}

        <FormMessage notice={notice} />

        {!formOpen &&
          (isGuest && confirmSignOut ? (
            <div className="account__signout-warning" role="alert">
              <p>
                Signing out ends this guest account, and its scores and history can’t
                be recovered. To log in to an existing account instead, sign out and
                choose Login.
              </p>
              <div className="account__signout-actions">
                <button className="auth-danger" onClick={() => void handleSignOut()}>
                  Sign out anyway
                </button>
                <button
                  className="auth-danger"
                  onClick={() => setConfirmSignOut(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="auth-danger"
              onClick={() =>
                isGuest ? setConfirmSignOut(true) : void handleSignOut()
              }>
              {isGuest ? 'Sign out / log in to another account' : 'Sign out'}
            </button>
          ))}
        {error && <p role="alert">{error}</p>}

        <div className="account__history">
          <HistoryTable />
        </div>
      </div>
    </ScreenLayout>
  );
}
