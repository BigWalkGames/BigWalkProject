import { useHotkeys } from '../../hooks/useHotkeys';
import { useKeysDown } from '../../hooks/useKeysDown';
import { KeyCap } from '../KeyCap/KeyCap';
import './TabNav.css';

export type Tab = { id: string; label: string };

type TabNavProps = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  label?: string; // accessible name for the tab bar
  hotkeysEnabled?: boolean; // turn Q / E off while a pop-up is open
};

/** Q / E keycaps flip between the tabs; the tabs are also clickable. */
export function TabNav({ tabs, active, onChange, label = 'Sections', hotkeysEnabled = true }: TabNavProps) {
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));

  const go = (offset: number) => {
    const next = tabs[index + offset];
    if (next) onChange(next.id);
  };

  useHotkeys({ q: () => go(-1), e: () => go(1) }, { enabled: hotkeysEnabled });
  const keysDown = useKeysDown(['q', 'e']);

  return (
    <nav className="tab-nav" aria-label={label}>
      <span className="tab-nav__keys" aria-hidden="true">
        <KeyCap label="Q" size="sm" pressed={keysDown.has('q')} />
        <KeyCap label="E" size="sm" pressed={keysDown.has('e')} />
      </span>

      <div className="tab-nav__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={`tab-nav__tab${tab.id === active ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
