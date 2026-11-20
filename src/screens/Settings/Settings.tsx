import { useRef, useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout/ScreenLayout';
import { TabNav, type Tab } from '../../components/TabNav/TabNav';
import {
  setTypingSettings,
  useTypingSettings,
  type CaretSpeed,
} from '../../features/typing/typingSettings';
import { EMOTE_LIBRARY, EMOTE_SLOTS, type EmoteId } from '../../features/versus/emotes';
import { resetEmoteSlots, setEmoteSlot, useEmoteSlots } from '../../features/versus/emoteSettings';
import {
  setAudioSettings,
  useAudioSettings,
  type AudioChannel,
} from '../../features/audio/audioSettings';
import { playSound } from '../../features/audio/sound';
import { FONTS } from '../../features/fonts/fonts';
import { setFontSettings, useFontSettings, type FontSettings } from '../../features/fonts/fontSettings';
import {
  setAccessibilitySettings,
  useAccessibilitySettings,
  useSystemPrefersReducedMotion,
} from '../../features/accessibility/accessibilitySettings';
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
  { id: 'emotes', label: 'Emotes' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'accessibility', label: 'Accessibility' },
];

const FONT_PICKERS: { key: keyof FontSettings; label: string }[] = [
  { key: 'menu', label: 'Menu Font' },
  { key: 'typing', label: 'Typing Font' },
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
        {tab === 'typing' && <TypingSettings />}
        {tab === 'audio' && <AudioSettings />}
        {tab === 'emotes' && <EmoteSettings />}
        {tab === 'gameplay' && <GameplaySettings />}
        {tab === 'accessibility' && <AccessibilitySettings />}
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
              style={{ '--fill': `${levels[channel]}%` } as React.CSSProperties}
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

/** What each arrow key sends as an emote during a match. */
function EmoteSettings() {
  const emoteSlots = useEmoteSlots();

  return (
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
  );
}

/** Fonts for menus and for the words being typed (list in features/fonts/fonts.ts). */
function GameplaySettings() {
  const fonts = useFontSettings();

  return (
    <section className="settings-section" aria-labelledby="settings-gameplay">
      <h2 id="settings-gameplay" className="settings-section__title">Gameplay</h2>

      {FONT_PICKERS.map(({ key, label }) => (
        <label key={key} className="settings-row">
          <span>{label}</span>
          <select
            value={fonts[key]}
            onChange={(event) => setFontSettings({ [key]: event.target.value })}
          >
            {FONTS.map(({ name }) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      ))}
    </section>
  );
}

/** Colorblind Mode and Motion Reduction (P45). */
function AccessibilitySettings() {
  const { colorblind, reduceMotion } = useAccessibilitySettings();
  const systemReducesMotion = useSystemPrefersReducedMotion();

  return (
    <section className="settings-section" aria-labelledby="settings-accessibility">
      <h2 id="settings-accessibility" className="settings-section__title">Accessibility</h2>

      <label className="settings-row">
        <span>
          Colorblind Mode
          <span className="settings-row__note"> (blue / orange for correct and missed keys)</span>
        </span>
        <input
          type="checkbox"
          checked={colorblind}
          onChange={(event) => setAccessibilitySettings({ colorblind: event.target.checked })}
        />
      </label>

      <label className="settings-row">
        <span>
          Motion Reduction
          <span className="settings-row__note"> (turns off non-essential animations)</span>
        </span>
        <input
          type="checkbox"
          checked={reduceMotion}
          onChange={(event) => setAccessibilitySettings({ reduceMotion: event.target.checked })}
        />
      </label>

      {systemReducesMotion && !reduceMotion && (
        <p className="settings-note">Your device asks for reduced motion, so animations are already off.</p>
      )}
    </section>
  );
}
