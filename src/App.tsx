import { Routes, Route } from 'react-router';
import AuthGate from './hooks/auth/AuthGate';
import GuestLoginPage from './screens/Login/GuestLoginPage';
import Home from './screens/Home/Home';
import Solo from './screens/Solo/Solo';
import Multiplayer from './screens/Multiplayer/Multiplayer';
import Account from './screens/Account/Account';
import Settings from './screens/Settings/Settings';
import TimeAttack from './screens/TimeAttack/TimeAttack';
import Matchmaking from './screens/Matchmaking/Matchmaking';
import Versus from './screens/Versus/Versus';
import CustomGame from './screens/CustomGame/CustomGame';
import JoinRoom from './screens/CustomGame/JoinRoom';
import RoomLobby from './screens/CustomGame/RoomLobby';
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
        <Route path="/multiplayer" element={<Multiplayer />} />
        <Route path="/multiplayer/matchmaking" element={<Matchmaking />} />
        <Route path="/multiplayer/custom" element={<CustomGame />} />
        <Route path="/multiplayer/custom/create" element={<RoomLobby create />} />
        <Route path="/multiplayer/custom/join" element={<JoinRoom />} />
        <Route path="/multiplayer/custom/lobby" element={<RoomLobby />} />
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
