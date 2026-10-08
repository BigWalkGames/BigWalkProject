import { Routes, Route } from 'react-router';
import Home from './screens/Home/Home';
import Solo from './screens/Solo/Solo';
import Multiplayer from './screens/Multiplayer/Multiplayer';
import Account from './screens/Account/Account';
import Settings from './screens/Settings/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/solo" element={<Solo />} />
      <Route path="/multiplayer" element={<Multiplayer />} />
      <Route path="/account" element={<Account />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}