import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import AuthProvider from './hooks/auth/AuthProvider';
import { startAudio } from './features/audio/sound';
import { applyFontSettings } from './features/fonts/fontSettings';

// Loads the sound effects and turns audio on at the first key press or click.
startAudio();

// Loads the player's menu and typing fonts and points the CSS font variables at them.
void applyFontSettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
