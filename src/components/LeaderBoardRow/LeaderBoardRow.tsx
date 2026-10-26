import './LeaderboardRow.css';

type LeaderboardRowProps = {
  rank: number;
  name: string;
  avatar?: string;      // image URL; a placeholder circle shows when missing
  wpm: number;
  accuracy: number;     // 0-100
  wins: number;
};

export function LeaderboardRow({ rank, name, avatar, wpm, accuracy, wins }: LeaderboardRowProps) {
  return (
    <li className="leaderboard-row" data-place={rank <= 3 ? rank : 'other'}>
      <span className="leaderboard-row__rank">{rank}</span>

      <span className="leaderboard-row__avatar">
        {avatar && <img src={avatar} alt="" />}
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