import './LeaderboardPreview.css';
import type { CSSProperties } from 'react';
import { MenuButton } from '../MenuButton/MenuButton';
import { ProfilePicture } from '../ProfilePicture/ProfilePicture';
import { useLeaderboard } from '../../hooks/useLeaderboard';

const TOP = 3;

/**
 * The Multiplayer menu's leaderboard panel: the overall top 3, with a header
 * button (hotkey A, handled by the screen) that opens the full Leaderboards page.
 */
export function LeaderboardPreview() {
  const { entries, status } = useLeaderboard();
  const top = entries.slice(0, TOP);

  return (
    <section className="lb-preview" aria-label="Leaderboard top 3">
      <div className="lb-preview__header">
        <MenuButton hotkey="A" to="/leaderboards">
          Leaderboards
        </MenuButton>
      </div>

      {status ? (
        <p className="lb-preview__status">{status}</p>
      ) : (
        <ol className="lb-preview__list">
          {top.map((e, i) => (
            <li
              key={`${e.rank}-${e.name}`}
              className="lb-preview__row"
              data-place={e.rank <= 3 ? e.rank : 'other'}
              style={{ '--row-i': Math.min(i, 4) } as CSSProperties}
            >
              <span className="lb-preview__rank">{e.rank}</span>
              <div className="lb-preview__body">
                <div className="lb-preview__who">
                  {/* TODO(supabase): the leaderboard RPC returns no picture id yet, so everyone has the default. */}
                  <ProfilePicture size="md" />
                  <span className="lb-preview__name">{e.name}</span>
                </div>
                <div className="lb-preview__stats">
                  <span>{e.wpm}</span><span className="lb-preview__unit">wpm</span>
                  <span>{e.accuracy}%</span><span className="lb-preview__unit">acc</span>
                  <span>{e.wins}</span><span className="lb-preview__unit">wins</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
