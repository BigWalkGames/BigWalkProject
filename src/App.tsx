import { Routes, Route } from 'react-router';
import AuthGate from './hooks/auth/AuthGate';
import GuestLoginPage from './screens/Login/GuestLoginPage';
import Home from './screens/Home/Home';
import Solo from './screens/Solo/Solo';
import Multiplayer from './screens/Multiplayer/Multiplayer';
import Account from './screens/Account/Account';
import Settings from './screens/Settings/Settings';
import TimeAttack from './screens/TimeAttack/TimeAttack';
import Results from './screens/Results/Results';
import Versus from './screens/Versus/Versus';
import History from './screens/History/History';
import MatchHistory from './screens/MatchHistory/MatchHistory';
import Leaderboards from './screens/Leaderboards/Leaderboards';

export default function App() {
  return (
    <AuthGate fallback={<GuestLoginPage />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/solo" element={<Solo />} />
        <Route path="/solo/time-attack" element={<TimeAttack />} />
        <Route path="/solo/time-attack/results" element={<Results />} />
        <Route path="/multiplayer" element={<Multiplayer />} />
        <Route path="/multiplayer/versus" element={<Versus />} />
        <Route path="/history" element={<History />} />
        <Route path="/matchhistory" element={<MatchHistory />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/account" element={<Account />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AuthGate>
  );
}
