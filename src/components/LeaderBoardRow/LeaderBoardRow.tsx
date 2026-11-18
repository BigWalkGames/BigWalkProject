import './LeaderBoardRow.css';
import { ProfilePicture } from '../ProfilePicture/ProfilePicture';

type LeaderboardRowProps = {
  rank: number;
  name: string;
  pictureId?: string | null; // profile picture id; none shows the default silhouette
  wpm: number;
  accuracy: number;     // 0-100
  wins: number;
};

export function LeaderboardRow({ rank, name, pictureId, wpm, accuracy, wins }: LeaderboardRowProps) {
  return (
    <li className="leaderboard-row" data-place={rank <= 3 ? rank : 'other'}>
      <span className="leaderboard-row__rank">{rank}</span>

      <span className="leaderboard-row__avatar">
        <ProfilePicture pictureId={pictureId} size="lg" />
      </span>

      <span className="leaderboard-row__name">{name}</span>

      <span className="leaderboard-row__stat">
        {wpm} <span className="leaderboard-row__unit">wpm</span>
      </span>

      <span className="leaderboard-row__stat">
        {accuracy}% <span className="leaderboard-row__unit">acc</span>
      </span>

      <span className="leaderboard-row__stat leaderboard-row__stat--wins">
        {wins} wins
      </span>
    </li>
  );
}