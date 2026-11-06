import { useRef, useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TabNav, type Tab } from '../../components/TabNav/TabNav';
import {
  setTypingSettings,
  useTypingSettings,
  type CaretSpeed,
} from '../../features/typing/typingSettings';
import {
  setAudioSettings,
  useAudioSettings,
  type AudioChannel,
} from '../../features/audio/audioSettings';
import { playSound } from '../../features/audio/sound';
import './Settings.css';

const CARET_SPEEDS: { value: CaretSpeed; label: string }[] = [
  { value: 'off', label: 'Off (jump)' },
  { value: 'fast', label: 'Fast' },
  { value: 'medium', label: 'Medium' },
  { value: 'slow', label: 'Slow' },
];

const TABS: Tab[] = [
  { id: 'typing', label: 'Typing' },
  { id: 'audio', label: 'Audio' },
];

const VOLUMES: { channel: AudioChannel; label: string; note?: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'sfx', label: 'SFX' },
  { channel: 'music', label: 'Music', note: 'No music yet' },
];

/** Fewest milliseconds between sample clicks while dragging a slider. */
const PREVIEW_GAP_MS = 90;

export default function Settings() {
  const [tab, setTab] = useState('typing');

  return (
    <ScreenLayout title="Settings">
      <div className="settings">
        <TabNav tabs={TABS} active={tab} onChange={setTab} label="Settings sections" />
        {tab === 'typing' ? <TypingSettings /> : <AudioSettings />}
      </div>
    </ScreenLayout>
  );
}

function TypingSettings() {
  const { caretSpeed, smoothLines } = useTypingSettings();

  return (
    <section className="settings-section" aria-labelledby="settings-typing">
      <h2 id="settings-typing" className="settings-section__title">Typing</h2>

      <label className="settings-row">
        <span>Smooth cursor</span>
        <select
          value={caretSpeed}
          onChange={(event) => setTypingSettings({ caretSpeed: event.target.value as CaretSpeed })}
        >
          {CARET_SPEEDS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="settings-row">
        <span>Smooth line scroll</span>
        <input
          type="checkbox"
          checked={smoothLines}
          onChange={(event) => setTypingSettings({ smoothLines: event.target.checked })}
        />
      </label>
    </section>
  );
}

/** Master, SFX and Music volume, 0-100, saved like the other settings. */
function AudioSettings() {
  const levels = useAudioSettings();
  const lastPreview = useRef(0);

  // While dragging Master or SFX, a sample click plays at the new level.
  const preview = (channel: AudioChannel) => {
    if (channel === 'music') return;
    const now = performance.now();
    if (now - lastPreview.current < PREVIEW_GAP_MS) return;
    lastPreview.current = now;
    playSound('key');
  };

  return (
    <section className="settings-section" aria-labelledby="settings-audio">
      <h2 id="settings-audio" className="settings-section__title">Audio</h2>

      {VOLUMES.map(({ channel, label, note }) => (
        <label key={channel} className="settings-row settings-row--slider">
          <span>
            {label}
            {note && <span className="settings-row__note"> ({note})</span>}
          </span>
          <span className="settings-slider">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={levels[channel]}
              onChange={(event) => {
                setAudioSettings({ [channel]: Number(event.target.value) });
                preview(channel);
              }}
            />
            <output className="settings-slider__value">{levels[channel]}</output>
          </span>
        </label>
      ))}
    </section>
  );
}
