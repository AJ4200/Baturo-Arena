'use client';

import classnames from 'classnames';
import {
  AiOutlineAppstore,
  AiOutlineGlobal,
  AiFillPlayCircle,
  AiFillSetting,
  AiOutlineHistory,
  AiOutlineLoading3Quarters,
  AiOutlineRobot,
  AiOutlineTeam,
  AiOutlineTrophy,
} from 'react-icons/ai';
import type { GameTypeCategory } from '@/types/game';

export type MenuDestination = 'game-type-select' | 'game-select' | 'leaderboard' | 'history' | 'settings';

type MenuDestinationSplashProps = {
  destination: MenuDestination;
  phase: 'enter' | 'exit';
  isWaitingForData: boolean;
  selectedCategory?: GameTypeCategory;
  gameCount?: number;
};

const DESTINATIONS = {
  'game-type-select': {
    tone: 'play',
    eyebrow: 'Enter the arena',
    title: 'Choose Your Fight',
    description: 'Pick how you want to play, then find the game that fits the moment.',
    status: 'Preparing game modes',
    icon: <AiFillPlayCircle />,
    marks: ['Online', 'Local', 'Solo'],
  },
  leaderboard: {
    tone: 'leaderboard',
    eyebrow: 'Live competition',
    title: 'Arena Standings',
    description: 'Pulling the latest scores and rivals from across Baturo Arena.',
    status: 'Syncing live rankings',
    icon: <AiOutlineTrophy />,
    marks: ['Rank', 'Record', 'Score'],
  },
  history: {
    tone: 'history',
    eyebrow: 'Local archive',
    title: 'Match History',
    description: 'Opening the wins, losses, draws, and rivalries saved on this device.',
    status: 'Opening match archive',
    icon: <AiOutlineHistory />,
    marks: ['Wins', 'Losses', 'Form'],
  },
  settings: {
    tone: 'settings',
    eyebrow: 'Tune the arena',
    title: 'Your Settings',
    description: 'Loading your sound, motion, difficulty, and local backup controls.',
    status: 'Applying preferences',
    icon: <AiFillSetting />,
    marks: ['Audio', 'Motion', 'Data'],
  },
} as const;

const CATEGORY_DESTINATIONS = {
  'online-multiplayer': {
    tone: 'catalog-team',
    eyebrow: 'Room heat selected',
    title: 'Multiplayer Games',
    description: 'Opening games built for live rooms, shared pressure, and real rivals.',
    status: 'Opening multiplayer shelf',
    icon: <AiOutlineTeam />,
    marks: ['Live Rooms', 'Rivals', 'Online'],
  },
  online: {
    tone: 'catalog-online',
    eyebrow: 'Connected lane selected',
    title: 'Online Ready',
    description: 'Opening every game with a network lane, from direct duels to arena runs.',
    status: 'Opening online shelf',
    icon: <AiOutlineGlobal />,
    marks: ['Connected', 'Matchmaking', 'Live'],
  },
  'single-player': {
    tone: 'catalog-solo',
    eyebrow: 'Practice lab selected',
    title: 'CPU And Solo',
    description: 'Opening solo challenges, CPU matches, and runs built for one player.',
    status: 'Opening solo shelf',
    icon: <AiOutlineRobot />,
    marks: ['Solo', 'CPU', 'Practice'],
  },
  all: {
    tone: 'catalog-all',
    eyebrow: 'Full catalog selected',
    title: 'Choose A Game',
    description: 'Opening the complete Baturo Arena shelf with every available way to play.',
    status: 'Opening full catalog',
    icon: <AiOutlineAppstore />,
    marks: ['All Games', 'All Modes', 'Explore'],
  },
} as const;

export function MenuDestinationSplash({
  destination,
  phase,
  isWaitingForData,
  selectedCategory = 'all',
  gameCount,
}: MenuDestinationSplashProps) {
  const content =
    destination === 'game-select'
      ? CATEGORY_DESTINATIONS[selectedCategory]
      : DESTINATIONS[destination];
  const marks =
    destination === 'game-select' && typeof gameCount === 'number'
      ? [`${gameCount} Games`, ...content.marks.slice(1)]
      : content.marks;

  return (
    <section
      className={classnames(
        'menu-destination-splash',
        `menu-destination-splash-${content.tone}`,
        phase === 'exit' && 'menu-destination-splash-exit'
      )}
    >
      <div className="menu-destination-splash-art" aria-hidden="true">
        <span className="menu-destination-splash-orbit menu-destination-splash-orbit-one" />
        <span className="menu-destination-splash-orbit menu-destination-splash-orbit-two" />
        <span className="menu-destination-splash-icon">{content.icon}</span>
      </div>

      <div className="menu-destination-splash-copy">
        <span className="menu-destination-splash-eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>

      <div className="menu-destination-splash-marks" aria-hidden="true">
        {marks.map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>

      <div className="menu-destination-splash-status" aria-live="polite">
        <AiOutlineLoading3Quarters className="loader-spin" />
        <span>
          {destination === 'game-select' || isWaitingForData ? content.status : 'Ready to open'}
        </span>
      </div>
    </section>
  );
}

export default MenuDestinationSplash;
