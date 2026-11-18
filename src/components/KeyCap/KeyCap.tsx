import '../../features/skins/skinnedKey.css';
import './KeyCap.css';

type KeyCapProps = {
  label: string;
  size?: 'sm' | 'lg';
  pressed?: boolean; 
};

export function KeyCap({ label, size = 'lg', pressed = false }: KeyCapProps) {
  // Labels longer than 2 characters (Esc, Enter, ...) don't fit the square keycap
  const isLong = label.length > 2;

  return (
    <span
      className={`keycap skinned-key keycap--${size}${isLong ? ' keycap--long' : ''}${pressed ? ' is-pressed' : ''}`}
      aria-hidden="true"
    >
      <span className="keycap__label">{label}</span>
    </span>
  );
}