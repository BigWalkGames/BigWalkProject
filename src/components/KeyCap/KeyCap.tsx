import './KeyCap.css';
import keycapUrl from '../../assets/keycap.png';
import keycapPressedUrl from '../../assets/keycappressed.png';
import longKeycapUrl from '../../assets/longkeycap.png';
import longKeycapPressedUrl from '../../assets/longkeycappressed.png';

type KeyCapProps = {
  label: string;
  size?: 'sm' | 'lg';
  pressed?: boolean; 
};

export function KeyCap({ label, size = 'lg', pressed = false }: KeyCapProps) {
  // Labels longer than 2 characters (Esc, Enter, ...) don't fit the square keycap
  const isLong = label.length > 2;
  const normalUrl = isLong ? longKeycapUrl : keycapUrl;
  const pressedUrl = isLong ? longKeycapPressedUrl : keycapPressedUrl;

  return (
    <span
      className={`keycap keycap--${size}${isLong ? ' keycap--long' : ''}${pressed ? ' is-pressed' : ''}`}
      aria-hidden="true"
    >
      <img src={normalUrl} alt="" className="keycap__img keycap__img--normal" />
      <img src={pressedUrl} alt="" className="keycap__img keycap__img--pressed" />
      <span className="keycap__label">{label}</span>
    </span>
  );
}