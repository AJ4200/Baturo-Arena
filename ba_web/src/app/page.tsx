'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import { IconContext } from 'react-icons';
import { AiFillGithub, AiFillLinkedin } from 'react-icons/ai';
import ArenaGame from './ArenaGame';
import { AppLoader } from '@/features/home/AppLoader';
import { GameSelectScreen } from '@/features/home/GameSelectScreen';
import { HistoryScreen } from '@/features/home/HistoryScreen';
import { LeaderboardScreen } from '@/features/home/LeaderboardScreen';
import { LobbyScreen } from '@/features/home/LobbyScreen';
import { MainMenu } from '@/features/home/MainMenu';
import { SettingsScreen } from '@/features/home/SettingsScreen';
import { useApiClient } from '@/hooks/useApiClient';
import { STORAGE_KEYS } from '@/lib/constants';
import { FALLBACK_GAMES } from '@/lib/games';
import { getRandomBrightColor } from '@/lib/random';
import type {
  CpuDifficulty,
  GameDefinition,
  GameMode,
  GameType,
  LeaderboardCategory,
  LeaderboardPayload,
  MatchHistoryEntry,
  MatchResultEvent,
  PlayerProfile,
  PublicRoom,
  RoomPayload,
  Screen,
} from '@/types/game';

type LocalBackupPayload = {
  version: 2;
  savedAt: string;
  playerName: string;
  preferredGame: GameType;
  player: {
    name: string;
    wins: number;
    losses: number;
    draws: number;
  } | null;
  isMusicMuted: boolean;
  musicVolume: number;
  enableAnimations: boolean;
  cpuDifficulty: CpuDifficulty;
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('online');
  const [selectedGame, setSelectedGame] = useState<GameType>('tic-tac-two');
  const [activeGameType, setActiveGameType] = useState<GameType>('tic-tac-two');
  const [availableGames, setAvailableGames] = useState<GameDefinition[]>(FALLBACK_GAMES);
  const [leaderboardCategory, setLeaderboardCategory] = useState<GameType | 'overall'>('overall');
  const [historyCategory, setHistoryCategory] = useState<GameType | 'all'>('all');
  const [playerName, setPlayerName] = useState('Player');
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [roomName, setRoomName] = useState('My Room');
  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardCategory[]>([]);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(70);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>('medium');
  const [matchBackgroundColor, setMatchBackgroundColor] = useState('#ffffff');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [hasLocalSave, setHasLocalSave] = useState(false);
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(null);
  const [saveIndicator, setSaveIndicator] = useState('');
  const [showSaveTip, setShowSaveTip] = useState(false);
  const [dontShowSaveTipAgain, setDontShowSaveTipAgain] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const saveIndicatorTimeoutRef = useRef<number | null>(null);

  const { activeRequests, runWithLoader, callApi } = useApiClient();

  const normalizeGameType = useCallback(
    (gameType: string | null | undefined): GameType => {
      return availableGames.some((game) => game.id === gameType)
        ? (gameType as GameType)
        : 'tic-tac-two';
    },
    [availableGames]
  );

  const getSavedAtLabel = (savedAt: string): string => {
    const parsed = new Date(savedAt);
    if (Number.isNaN(parsed.getTime())) {
      return savedAt;
    }
    return parsed.toLocaleString();
  };

  const showSaveIndicator = useCallback((text: string) => {
    if (saveIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(saveIndicatorTimeoutRef.current);
    }
    setSaveIndicator(text);
    saveIndicatorTimeoutRef.current = window.setTimeout(() => {
      setSaveIndicator('');
      saveIndicatorTimeoutRef.current = null;
    }, 1800);
  }, []);

  const parseLocalBackup = (rawValue: string | null): LocalBackupPayload | null => {
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<LocalBackupPayload>;
      if (parsed?.version !== 2 || typeof parsed.savedAt !== 'string') {
        return null;
      }
      if (
        parsed.cpuDifficulty !== 'easy' &&
        parsed.cpuDifficulty !== 'medium' &&
        parsed.cpuDifficulty !== 'hard'
      ) {
        return null;
      }
      if (
        typeof parsed.playerName !== 'string' ||
        typeof parsed.isMusicMuted !== 'boolean' ||
        typeof parsed.musicVolume !== 'number' ||
        typeof parsed.enableAnimations !== 'boolean'
      ) {
        return null;
      }

      return {
        version: 2,
        savedAt: parsed.savedAt,
        playerName: parsed.playerName,
        preferredGame: normalizeGameType(parsed.preferredGame),
        player:
          parsed.player &&
          typeof parsed.player.name === 'string' &&
          typeof parsed.player.wins === 'number' &&
          typeof parsed.player.losses === 'number' &&
          typeof parsed.player.draws === 'number'
            ? {
                name: parsed.player.name,
                wins: parsed.player.wins,
                losses: parsed.player.losses,
                draws: parsed.player.draws,
              }
            : null,
        isMusicMuted: parsed.isMusicMuted,
        musicVolume: Math.min(100, Math.max(0, parsed.musicVolume)),
        enableAnimations: parsed.enableAnimations,
        cpuDifficulty: parsed.cpuDifficulty,
      };
    } catch (_error) {
      return null;
    }
  };

  const parseMatchHistory = (rawValue: string | null): MatchHistoryEntry[] => {
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((entry): entry is MatchHistoryEntry => {
          return (
            Boolean(entry) &&
            typeof entry === 'object' &&
            typeof (entry as MatchHistoryEntry).id === 'string' &&
            typeof (entry as MatchHistoryEntry).finishedAt === 'string' &&
            ((entry as MatchHistoryEntry).mode === 'online' || (entry as MatchHistoryEntry).mode === 'cpu') &&
            ((entry as MatchHistoryEntry).outcome === 'win' ||
              (entry as MatchHistoryEntry).outcome === 'loss' ||
              (entry as MatchHistoryEntry).outcome === 'draw') &&
            typeof (entry as MatchHistoryEntry).opponent === 'string'
          );
        })
        .slice(0, 20)
        .map((entry) => ({
          ...entry,
          gameType: normalizeGameType(entry.gameType),
        }));
    } catch (_error) {
      return [];
    }
  };

  const saveLocalBackup = useCallback(
    (mode: 'auto' | 'manual') => {
      const payload: LocalBackupPayload = {
        version: 2,
        savedAt: new Date().toISOString(),
        playerName,
        preferredGame: selectedGame,
        player: player
          ? {
              name: player.name,
              wins: player.wins,
              losses: player.losses,
              draws: player.draws,
            }
          : null,
        isMusicMuted,
        musicVolume,
        enableAnimations,
        cpuDifficulty,
      };

      window.localStorage.setItem(STORAGE_KEYS.localBackup, JSON.stringify(payload));
      setHasLocalSave(true);
      setLastLocalSavedAt(payload.savedAt);
      showSaveIndicator(mode === 'auto' ? 'Auto-saved local backup' : 'Local backup saved');
    },
    [cpuDifficulty, enableAnimations, isMusicMuted, musicVolume, player, playerName, selectedGame, showSaveIndicator]
  );

  const loadLocalBackup = useCallback(() => {
    const payload = parseLocalBackup(window.localStorage.getItem(STORAGE_KEYS.localBackup));
    if (!payload) {
      setMessage('No valid local save found');
      return;
    }

    setPlayerName(payload.playerName || 'Player');
    window.localStorage.setItem(STORAGE_KEYS.playerName, payload.playerName || 'Player');

    setSelectedGame(payload.preferredGame);
    setHistoryCategory(payload.preferredGame);
    setLeaderboardCategory(payload.preferredGame);
    window.localStorage.setItem(STORAGE_KEYS.preferredGame, payload.preferredGame);

    setIsMusicMuted(payload.isMusicMuted);
    window.localStorage.setItem(STORAGE_KEYS.musicMuted, String(payload.isMusicMuted));

    setMusicVolume(payload.musicVolume);
    window.localStorage.setItem(STORAGE_KEYS.musicVolume, String(payload.musicVolume));

    setEnableAnimations(payload.enableAnimations);
    window.localStorage.setItem(STORAGE_KEYS.enableAnimations, String(payload.enableAnimations));

    setCpuDifficulty(payload.cpuDifficulty);
    window.localStorage.setItem(STORAGE_KEYS.cpuDifficulty, payload.cpuDifficulty);

    const savedPlayer = payload.player;
    if (savedPlayer) {
      setPlayer((currentValue) => {
        if (currentValue) {
          return {
            ...currentValue,
            name: savedPlayer.name || currentValue.name,
            wins: savedPlayer.wins,
            losses: savedPlayer.losses,
            draws: savedPlayer.draws,
          };
        }

        const savedPlayerId = window.localStorage.getItem(STORAGE_KEYS.playerId);
        if (!savedPlayerId) {
          return null;
        }

        return {
          playerId: savedPlayerId,
          name: savedPlayer.name,
          wins: savedPlayer.wins,
          losses: savedPlayer.losses,
          draws: savedPlayer.draws,
        };
      });
    }

    setHasLocalSave(true);
    setLastLocalSavedAt(payload.savedAt);
    showSaveIndicator('Local save loaded');
    setMessage('Loaded local save data');
  }, [normalizeGameType, showSaveIndicator]);

  const recordMatchResult = useCallback(
    (result: MatchResultEvent) => {
      const entry: MatchHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        finishedAt: new Date().toISOString(),
        mode: result.mode,
        gameType: result.gameType,
        outcome: result.outcome,
        opponent: result.opponent,
      };

      setMatchHistory((currentValue) => {
        const nextValue = [entry, ...currentValue].slice(0, 20);
        window.localStorage.setItem(STORAGE_KEYS.matchHistory, JSON.stringify(nextValue));
        return nextValue;
      });

      if (result.mode !== 'cpu' || !player) {
        return;
      }

      callApi<PlayerProfile>(
        '/api/players/result',
        {
          method: 'POST',
          body: JSON.stringify({
            playerId: player.playerId,
            gameType: result.gameType,
            outcome: result.outcome,
          }),
        },
        false
      )
        .then((updatedPlayer) => {
          setPlayer(updatedPlayer);
          refreshLeaderboard().catch(() => {
            // Ignore lightweight leaderboard refresh errors.
          });
        })
        .catch(() => {
          setMessage('Could not sync CPU score to leaderboard');
        });
    },
    [callApi, player]
  );

  const clearMatchHistory = useCallback(() => {
    setMatchHistory([]);
    window.localStorage.removeItem(STORAGE_KEYS.matchHistory);
    showSaveIndicator('Match history cleared');
  }, [showSaveIndicator]);

  const refreshGames = async () => {
    const payload = await callApi<{ games: GameDefinition[] }>('/api/games', undefined, false);
    if (payload.games.length > 0) {
      setAvailableGames(payload.games);
    }
  };

  const refreshPublicRooms = async () => {
    const payload = await callApi<{ rooms: PublicRoom[] }>('/api/rooms/public');
    setPublicRooms(payload.rooms);
  };

  const refreshLeaderboard = async () => {
    const payload = await callApi<LeaderboardPayload>('/api/players/leaderboard');
    setLeaderboard([
      { gameType: 'overall', name: 'Overall Arena', players: payload.overall },
      ...payload.byGame,
    ]);
  };

  const ensurePlayer = async () => {
    const savedPlayerId = window.localStorage.getItem(STORAGE_KEYS.playerId);
    const payload = await callApi<PlayerProfile>('/api/players/register', {
      method: 'POST',
      body: JSON.stringify({
        playerId: savedPlayerId,
        name: playerName || 'Player',
      }),
    });

    setPlayer(payload);
    setPlayerName(payload.name);
    window.localStorage.setItem(STORAGE_KEYS.playerId, payload.playerId);
    window.localStorage.setItem(STORAGE_KEYS.playerName, payload.name);
    return payload;
  };

  const beginMatch = (mode: GameMode, roomCode: string | null, gameType: GameType) => {
    setGameMode(mode);
    setActiveRoomCode(roomCode);
    setActiveGameType(gameType);
    setMatchBackgroundColor(getRandomBrightColor());
    setScreen('game');
  };

  const createRoom = async (isPublic: boolean) => {
    try {
      setIsLoading(true);
      const registeredPlayer = await ensurePlayer();

      const payload = await callApi<RoomPayload>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          playerId: registeredPlayer.playerId,
          roomName,
          isPublic,
          gameType: selectedGame,
        }),
      });

      if (payload.you) {
        setPlayer(payload.you);
      }

      beginMatch('online', payload.room.code, payload.room.gameType);
      setMessage('');
      await Promise.all([refreshPublicRooms(), refreshLeaderboard()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create room');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async (code: string) => {
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) {
      setMessage('Room code is required');
      return;
    }

    try {
      setIsLoading(true);
      const registeredPlayer = await ensurePlayer();

      const payload = await callApi<RoomPayload>('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({
          playerId: registeredPlayer.playerId,
          code: roomCode,
        }),
      });

      if (payload.you) {
        setPlayer(payload.you);
      }

      beginMatch('online', payload.room.code, payload.room.gameType);
      setSelectedGame(payload.room.gameType);
      setMessage('');
      await Promise.all([refreshPublicRooms(), refreshLeaderboard()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not join room');
    } finally {
      setIsLoading(false);
    }
  };

  const startCpuMatch = async () => {
    try {
      setIsLoading(true);
      await ensurePlayer();
      beginMatch('cpu', null, selectedGame);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start CPU match');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedName = window.localStorage.getItem(STORAGE_KEYS.playerName);
    const savedMuted = window.localStorage.getItem(STORAGE_KEYS.musicMuted);
    const savedVolume = window.localStorage.getItem(STORAGE_KEYS.musicVolume);
    const savedAnimations = window.localStorage.getItem(STORAGE_KEYS.enableAnimations);
    const savedDifficulty = window.localStorage.getItem(STORAGE_KEYS.cpuDifficulty);
    const savedPreferredGame = window.localStorage.getItem(STORAGE_KEYS.preferredGame);

    if (savedName) {
      setPlayerName(savedName);
    }
    if (savedMuted) {
      setIsMusicMuted(savedMuted === 'true');
    }
    if (savedVolume) {
      const parsedVolume = Number(savedVolume);
      if (Number.isFinite(parsedVolume)) {
        setMusicVolume(Math.min(100, Math.max(0, parsedVolume)));
      }
    }
    if (savedAnimations) {
      setEnableAnimations(savedAnimations === 'true');
    }
    if (savedDifficulty === 'easy' || savedDifficulty === 'medium' || savedDifficulty === 'hard') {
      setCpuDifficulty(savedDifficulty);
    }
    if (savedPreferredGame) {
      const normalizedPreferredGame = normalizeGameType(savedPreferredGame);
      setSelectedGame(normalizedPreferredGame);
      setLeaderboardCategory(normalizedPreferredGame);
      setHistoryCategory(normalizedPreferredGame);
    }

    refreshGames()
      .then(() => {
        const savedBackup = parseLocalBackup(window.localStorage.getItem(STORAGE_KEYS.localBackup));
        if (savedBackup) {
          setHasLocalSave(true);
          setLastLocalSavedAt(savedBackup.savedAt);
        }
        setMatchHistory(parseMatchHistory(window.localStorage.getItem(STORAGE_KEYS.matchHistory)));
      })
      .catch(() => {
        const savedBackup = parseLocalBackup(window.localStorage.getItem(STORAGE_KEYS.localBackup));
        if (savedBackup) {
          setHasLocalSave(true);
          setLastLocalSavedAt(savedBackup.savedAt);
        }
        setMatchHistory(parseMatchHistory(window.localStorage.getItem(STORAGE_KEYS.matchHistory)));
      });

    const shouldHideSaveTip = window.localStorage.getItem(STORAGE_KEYS.hideSaveTip);
    setShowSaveTip(shouldHideSaveTip !== 'true');

    ensurePlayer().catch(() => {
      // Registration can be retried from UI.
    });
    refreshPublicRooms().catch(() => {
      // Ignore initial lobby load failures.
    });
    refreshLeaderboard().catch(() => {
      // Ignore initial leaderboard load failures.
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.preferredGame, selectedGame);
  }, [selectedGame]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      saveLocalBackup('auto');
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [saveLocalBackup]);

  useEffect(() => {
    return () => {
      if (saveIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(saveIndicatorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!audioElement) {
      return;
    }
    audioElement.muted = isMusicMuted;
    audioElement.volume = musicVolume / 100;
  }, [audioElement, isMusicMuted, musicVolume]);

  const isInMatch = screen === 'game' && Boolean(player);

  const renderTopBar = () => (
    <header className="title-topbar">
      <IconContext.Provider value={{ size: '2rem' }}>
        <div className="flex items-center justify-center space-x-2">
          <motion.a
            whileHover={{ opacity: 0.5, scale: 0.9, cursor: 'pointer' }}
            transition={{ duration: 0.4 }}
            whileTap={{ scale: 1.2 }}
            href="https://github.com/AJ4200"
            target="_blank"
            rel="noreferrer"
          >
            <AiFillGithub />
          </motion.a>
          <motion.a
            whileHover={{ opacity: 0.5, scale: 0.9, cursor: 'pointer' }}
            transition={{ duration: 0.4 }}
            whileTap={{ scale: 1.2 }}
            href="https://www.linkedin.com/in/abel-majadibodu-5a0583193/"
            target="_blank"
            rel="noreferrer"
          >
            <AiFillLinkedin />
          </motion.a>
        </div>
      </IconContext.Provider>
    </header>
  );

  const renderScreen = () => {
    if (screen === 'home') {
      return (
        <MainMenu
          enableAnimations={enableAnimations}
          onPlay={() => setScreen('game-select')}
          onLeaderboard={() => {
            refreshLeaderboard().catch(() => {
              setMessage('Could not load leaderboard');
            });
            setScreen('leaderboard');
          }}
          onHistory={() => setScreen('history')}
          onSettings={() => setScreen('settings')}
        />
      );
    }

    if (screen === 'game-select') {
      return (
        <GameSelectScreen
          games={availableGames}
          selectedGame={selectedGame}
          onSelectGame={setSelectedGame}
          onBack={() => setScreen('home')}
          onContinue={() => setScreen('lobby')}
        />
      );
    }

    if (screen === 'lobby') {
      return (
        <LobbyScreen
          playerName={playerName}
          roomName={roomName}
          joinCode={joinCode}
          selectedGame={selectedGame}
          games={availableGames}
          publicRooms={publicRooms}
          message={message}
          isLoading={isLoading}
          onBack={() => setScreen('home')}
          onGameChange={setSelectedGame}
          onPlayerNameChange={setPlayerName}
          onRoomNameChange={setRoomName}
          onJoinCodeChange={setJoinCode}
          onSaveName={() => {
            ensurePlayer()
              .then((registeredPlayer) => {
                setPlayer(registeredPlayer);
                setMessage('Profile saved');
              })
              .catch((error) => {
                setMessage(error instanceof Error ? error.message : 'Could not save profile');
              });
          }}
          onCreatePublic={() => void createRoom(true)}
          onCreatePrivate={() => void createRoom(false)}
          onJoinByCode={() => void joinRoom(joinCode)}
          onRefreshRooms={() => {
            refreshPublicRooms().catch(() => {
              setMessage('Could not refresh public rooms');
            });
          }}
          onJoinRoom={(code) => void joinRoom(code)}
          onPlayCpu={() => void startCpuMatch()}
        />
      );
    }

    if (screen === 'leaderboard') {
      return (
        <LeaderboardScreen
          leaderboard={leaderboard}
          selectedCategory={leaderboardCategory}
          games={availableGames}
          onSelectCategory={setLeaderboardCategory}
          onBack={() => setScreen('home')}
          onRefresh={() => {
            refreshLeaderboard().catch(() => {
              setMessage('Could not refresh leaderboard');
            });
          }}
        />
      );
    }

    if (screen === 'history') {
      return (
        <HistoryScreen
          history={matchHistory}
          selectedGame={historyCategory}
          games={availableGames}
          onSelectGame={setHistoryCategory}
          onBack={() => setScreen('home')}
          onClear={clearMatchHistory}
        />
      );
    }

    if (screen === 'settings') {
      return (
        <SettingsScreen
          isMusicMuted={isMusicMuted}
          musicVolume={musicVolume}
          enableAnimations={enableAnimations}
          cpuDifficulty={cpuDifficulty}
          hasLocalSave={hasLocalSave}
          lastSavedAtLabel={lastLocalSavedAt ? getSavedAtLabel(lastLocalSavedAt) : null}
          onBack={() => setScreen('home')}
          onToggleMusic={() => {
            const nextValue = !isMusicMuted;
            setIsMusicMuted(nextValue);
            window.localStorage.setItem(STORAGE_KEYS.musicMuted, String(nextValue));
          }}
          onMusicVolumeChange={(volume) => {
            setMusicVolume(volume);
            window.localStorage.setItem(STORAGE_KEYS.musicVolume, String(volume));
          }}
          onToggleAnimations={() => {
            const nextValue = !enableAnimations;
            setEnableAnimations(nextValue);
            window.localStorage.setItem(STORAGE_KEYS.enableAnimations, String(nextValue));
          }}
          onCpuDifficultyChange={(difficulty) => {
            setCpuDifficulty(difficulty);
            window.localStorage.setItem(STORAGE_KEYS.cpuDifficulty, difficulty);
          }}
          onSaveNow={() => {
            saveLocalBackup('manual');
          }}
          onLoadSave={() => {
            loadLocalBackup();
          }}
        />
      );
    }

    if (screen === 'game' && player) {
      return (
        <ArenaGame
          mode={gameMode}
          roomCode={activeRoomCode}
          player={player}
          gameType={activeGameType}
          gameDefinitions={availableGames}
          isMusicMuted={isMusicMuted}
          cpuDifficulty={cpuDifficulty}
          runWithLoader={runWithLoader}
          onToggleMusic={() => {
            const nextValue = !isMusicMuted;
            setIsMusicMuted(nextValue);
            window.localStorage.setItem(STORAGE_KEYS.musicMuted, String(nextValue));
          }}
          onProfileUpdate={(updatedPlayer) => {
            setPlayer(updatedPlayer);
          }}
          onMatchComplete={recordMatchResult}
          onLeave={() => {
            setActiveRoomCode(null);
            setGameMode('online');
            setSelectedGame(activeGameType);
            setScreen('lobby');
            refreshPublicRooms().catch(() => {
              // ignore
            });
            refreshLeaderboard().catch(() => {
              // ignore
            });
          }}
        />
      );
    }

    return null;
  };

  return (
    <main
      className={classnames(isInMatch ? 'match-screen-root' : 'title-screen-root', !enableAnimations && 'motion-off')}
      style={isInMatch ? { backgroundColor: matchBackgroundColor } : undefined}
    >
      {!isInMatch ? renderTopBar() : null}
      {renderScreen()}
      <AppLoader active={activeRequests > 0} subtle={isInMatch} />
      {saveIndicator ? <div className="save-indicator">{saveIndicator}</div> : null}
      {showSaveTip ? (
        <div className="save-tip-card">
          <p>
            Arena stats can reset after redeploy. Go to Settings any time to load your local save backup for your current Baturo Arena lineup.
          </p>
          <label className="save-tip-check">
            <input type="checkbox" checked={dontShowSaveTipAgain} onChange={(event) => setDontShowSaveTipAgain(event.target.checked)} />
            Don&apos;t show again
          </label>
          <button
            className={classnames('lobby-btn', 'custome-shadow')}
            type="button"
            onClick={() => {
              if (dontShowSaveTipAgain) {
                window.localStorage.setItem(STORAGE_KEYS.hideSaveTip, 'true');
              }
              setShowSaveTip(false);
            }}
          >
            Got it
          </button>
        </div>
      ) : null}
      <audio autoPlay={true} loop={true} muted={isMusicMuted} ref={setAudioElement} src="Loli.mp3" />
      {!isInMatch ? <span className="fixed bottom-1 text-sm">Project By AJ4200 c 2023</span> : null}
    </main>
  );
}
