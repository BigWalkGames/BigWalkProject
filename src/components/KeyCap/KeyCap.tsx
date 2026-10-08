import './KeyCap.css';
import keycapUrl from '../../assets/keycap.png';
import keycapPressedUrl from '../../assets/keycappressed.png';

type KeyCapProps = {
  label: string;
  size?: 'sm' | 'lg';
  pressed?: boolean; 
};

export function KeyCap({ label, size = 'lg', pressed = false }: KeyCapProps) {
  return (
    <span
      className={`keycap keycap--${size}${pressed ? ' is-pressed' : ''}`}
      aria-hidden="true"
    >
      <img src={keycapUrl} alt="" className="keycap__img keycap__img--normal" />
      <img src={keycapPressedUrl} alt="" className="keycap__img keycap__img--pressed" />
      <span className="keycap__label">{label}</span>
    </span>
  );
}