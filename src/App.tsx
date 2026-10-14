import { Routes, Route } from 'react-router';
import Home from './screens/Home/Home';
import Solo from './screens/Solo/Solo';
import Multiplayer from './screens/Multiplayer/Multiplayer';
import Account from './screens/Account/Account';
import Settings from './screens/Settings/Settings';
import TimeAttack from './screens/TimeAttack/TimeAttack';
import Versus from './screens/Versus/Versus';
import History from './screens/History/History';
import Leaderboards from './screens/Leaderboards/Leaderboards';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/solo" element={<Solo />} />
      <Route path="/solo/time-attack" element={<TimeAttack />} />
      <Route path="/multiplayer" element={<Multiplayer />} />
      <Route path="/multiplayer/versus" element={<Versus />} />
      <Route path="/history" element={<History />} />
      <Route path="/leaderboards" element={<Leaderboards />} />
      <Route path="/account" element={<Account />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}