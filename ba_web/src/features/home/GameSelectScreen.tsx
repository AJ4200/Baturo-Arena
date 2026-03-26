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
        </div>

        <div className="choose-game-grid">
          {games.map((game) => {
            const isSelected = selectedGame === game.id;

            return (
              <div
                key={game.id}
                className={classnames('choose-game-card', isSelected && 'choose-game-card-active')}
              >
                <button
                  className="choose-game-card-select"
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

                {isSelected ? (
                  <button className="choose-game-play-btn" type="button" onClick={onContinue}>
                    <AiOutlineCheckCircle /> Play Game
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
