// Temporary nav helper, back button thing LOL
import { useNavigate } from 'react-router';
import { NavButton } from '../NavButton/NavButton';
import { useHotkeys } from '../../hooks/useHotkeys';
import './ScreenLayout.css';

type ScreenLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function ScreenLayout({ title, children }: ScreenLayoutProps) {
  const navigate = useNavigate();
  useHotkeys({ escape: () => navigate('/') });

  return (
    <main className="screen">
      <header className="screen__header">
        <NavButton to="/" hotkey="←">Back</NavButton>
        <h1 className="screen__title">{title}</h1>
      </header>
      <div className="screen__body">{children}</div>
    </main>
  );
}