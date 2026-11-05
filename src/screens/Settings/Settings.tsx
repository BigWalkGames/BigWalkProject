import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import {
  setTypingSettings,
  useTypingSettings,
  type CaretSpeed,
} from '../../features/typing/typingSettings';
import { EMOTE_LIBRARY, EMOTE_SLOTS, type EmoteId } from '../../features/versus/emotes';
import { resetEmoteSlots, setEmoteSlot, useEmoteSlots } from '../../features/versus/emoteSettings';
import './Settings.css';

const CARET_SPEEDS: { value: CaretSpeed; label: string }[] = [
  { value: 'off', label: 'Off (jump)' },
  { value: 'fast', label: 'Fast' },
  { value: 'medium', label: 'Medium' },
  { value: 'slow', label: 'Slow' },
];

export default function Settings() {
  const { caretSpeed, smoothLines } = useTypingSettings();
  const emoteSlots = useEmoteSlots();

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

      <section className="settings-section" aria-labelledby="settings-emotes">
        <h2 id="settings-emotes" className="settings-section__title">Match emotes</h2>
        <p className="settings-note">Pick what each arrow key says during a Quick Match or Custom Game.</p>

        {EMOTE_SLOTS.map(({ slot, arrow, name }) => (
          <label key={slot} className="settings-row">
            <span>{arrow} {name} arrow</span>
            <select
              value={emoteSlots[slot]}
              onChange={(event) => setEmoteSlot(slot, event.target.value as EmoteId)}
            >
              {EMOTE_LIBRARY.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
        ))}

        <button type="button" className="settings-button" onClick={resetEmoteSlots}>
          Reset emotes
        </button>
      </section>
    </ScreenLayout>
  );
}
