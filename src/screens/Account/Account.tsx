import './Account.css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { HistoryTable } from '../../components/HistoryTable/HistoryTable';
import { FormMessage } from '../../components/AuthForm/AuthForm';
import { TabNav, type Tab } from '../../components/TabNav/TabNav';
import { useAuth } from '../../hooks/auth/useAuth';
import { signOut } from '../../hooks/auth/authActions';
import { GuestUpgrade } from './GuestUpgrade';
import { AccountPrompt } from './AccountPrompt';

// To add a tab later: add it here, then add its content below.
const TABS: Tab[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'profile', label: 'Profile' },
];

export default function Account() {
  const { user, isGuest } = useAuth();
  const [tab, setTab] = useState('stats');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false); // for guests that clicked 'create account'
  const [upgrading, setUpgrading] = useState(false); // keeps the upgrade form up until it finishes
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [promptOpen, setPromptOpen] = useState(isGuest); // 'make an account?' pop-up, guests only

  const showPrompt = isGuest && promptOpen;
  const formOpen = showForm || upgrading;
  // The upgrade form lives on the Profile tab, so stay there while it is open.
  const activeTab = formOpen ? 'profile' : tab;

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
  const displayName = isGuest ? 'Guest' : (username ?? 'Player');

  return (
    <ScreenLayout title="Account">
      <div className="account">
        <header className="account__header">
          <h2 className="account__name">{displayName}</h2>
        </header>

        <TabNav
          tabs={TABS}
          active={activeTab}
          onChange={(id) => {
            if (!formOpen) setTab(id);
          }}
          label="Account sections"
          hotkeysEnabled={!showPrompt && !formOpen}
        />

        <div className="account__panel">
          {activeTab === 'profile' && (
            <>
              {isGuest ? (
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
            </>
          )}

          {activeTab === 'stats' && <HistoryTable />}
        </div>

        {formOpen && (
          <div
            className="account-prompt"
            role="dialog"
            aria-modal="true"
            aria-label="Create account"
          >
            <GuestUpgrade
              onStarted={() => setUpgrading(true)}
              onCancel={closeForm}
              onFinished={(message) => {
                closeForm();
                setNotice(message);
              }}
            />
          </div>
        )}

        {showPrompt && (
          <AccountPrompt
            onRegister={() => {
              setPromptOpen(false);
              openForm();
            }}
            onCancel={() => {
              setPromptOpen(false);
              setTab('stats');
            }}
          />
        )}
      </div>
    </ScreenLayout>
  );
}
