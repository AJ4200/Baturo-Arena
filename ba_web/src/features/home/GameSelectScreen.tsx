import classnames from 'classnames';
import { AiOutlineArrowLeft, AiOutlineCheckCircle, AiOutlineTeam } from 'react-icons/ai';
import type { GameDefinition, GameType } from '@/types/game';

type GameSelectScreenProps = {
  games: GameDefinition[];
  selectedGame: GameType;
  onSelectGame: (gameType: GameType) => void;
  onBack: () => void;
  onContinue: () => void;
};

const THUMBNAIL_LABELS: Record<GameType, string> = {
  'tic-tac-two': 'X / O',
  'connect-all-four': '4 IN A ROW',
  'orbital-flip': 'ORBIT',
  'corner-clash': 'CORNERS',
  '2048': 'MERGE',
  'sudoku': '9 x 9',
  'minesweeper': 'MINES',
  'memory-match': 'PAIRS',
};

export function GameSelectScreen({
  games,
  selectedGame,
  onSelectGame,
  onBack,
  onContinue,
}: GameSelectScreenProps) {
  const selectedDefinition = games.find((game) => game.id === selectedGame) || games[0];

  return (
    <section className="title-screen-content">
      <h1>
        <span>Choose</span>
        <span>-</span>
        <span>Game</span>
      </h1>

      <div className="lobby-card mt-8">
        <div className="lobby-row">
          <button className="lobby-back" type="button" onClick={onBack}>
            <AiOutlineArrowLeft /> Back
          </button>
          <button className={classnames('lobby-btn', 'custome-shadow')} type="button" onClick={onContinue}>
            <AiOutlineCheckCircle /> Continue with {selectedDefinition?.name}
          </button>
        </div>

        <div className="choose-game-grid">
          {games.map((game) => (
            <button
              key={game.id}
              className={classnames('choose-game-card', selectedGame === game.id && 'choose-game-card-active')}
              type="button"
              onClick={() => onSelectGame(game.id)}
            >
              <div className={classnames('choose-game-thumb', `choose-game-thumb-${game.id}`)}>
                <span>{THUMBNAIL_LABELS[game.id]}</span>
              </div>
              <strong>{game.name}</strong>
              <span>{game.description}</span>
              <small>
                <AiOutlineTeam /> {game.minPlayers}-{game.maxPlayers} players
              </small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
