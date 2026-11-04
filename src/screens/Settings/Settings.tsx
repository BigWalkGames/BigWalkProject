import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import {
  setTypingSettings,
  useTypingSettings,
  type CaretSpeed,
} from '../../features/typing/typingSettings';
import './Settings.css';

const CARET_SPEEDS: { value: CaretSpeed; label: string }[] = [
  { value: 'off', label: 'Off (jump)' },
  { value: 'fast', label: 'Fast' },
  { value: 'medium', label: 'Medium' },
  { value: 'slow', label: 'Slow' },
];

export default function Settings() {
  const { caretSpeed, smoothLines } = useTypingSettings();

  return (
    <ScreenLayout title="Settings">
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
    </ScreenLayout>
  );
}
