'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import { IconContext } from 'react-icons';
import { AiFillGithub, AiFillLinkedin } from 'react-icons/ai';
import ArenaGame from './ArenaGame';
import { AppLoader } from '@/features/home/AppLoader';
import { GameSelectScreen } from '@/features/home/GameSelectScreen';
import { GameTypeSelectScreen } from '@/features/home/GameTypeSelectScreen';
import { HistoryScreen } from '@/features/home/HistoryScreen';
import { LeaderboardScreen } from '@/features/home/LeaderboardScreen';
import { LobbyScreen } from '@/features/home/LobbyScreen';
import { MainMenu } from '@/features/home/MainMenu';
import { MusicDock, type MusicTrack } from '@/features/home/MusicDock';
import { GoogleNoticeDock, type NoticeTone } from '@/features/home/GoogleNoticeDock';
import { ProfileDock, type GoogleAccount } from '@/features/home/ProfileDock';
import { SettingsScreen } from '@/features/home/SettingsScreen';
import { useApiClient } from '@/hooks/useApiClient';
import { STORAGE_KEYS } from '@/lib/constants';
import { FALLBACK_GAMES } from '@/lib/games';
import { getOfflineSeats } from '@/lib/offline';
import { getRandomBrightColor } from '@/lib/random';
import type {
  CpuDifficulty,
  GameDefinition,
  GameMode,
  GameType,
  GameTypeCategory,
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

type GoogleCredentialResponse = {
  credential?: string;
};

type GooglePromptNotification = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
};

type GoogleIdInitializeConfig = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  use_fedcm_for_prompt?: boolean;
};

type GoogleOauthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type AuthSessionPayload = {
  player: PlayerProfile;
  account: GoogleAccount | null;
  expiresAt: string;
};

type GoogleSignInPayload = AuthSessionPayload & {
  authToken: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: GoogleIdInitializeConfig) => void;
          prompt: (listener?: (notification: GooglePromptNotification) => void) => void;
          cancel: () => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleOauthTokenResponse) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const normalizeHexColor = (hexColor: string): string => {
  const cleaned = String(hexColor || '').trim().replace('#', '');
  if (cleaned.length === 3) {
    return cleaned
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase();
  }

  if (cleaned.length === 6) {
    return cleaned.toLowerCase();
  }

  return 'ffffff';
};

const hexToRgb = (hexColor: string): [number, number, number] => {
  const normalized = normalizeHexColor(hexColor);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return [red, green, blue];
};

const blendRgb = (
  rgb: [number, number, number],
  target: [number, number, number],
  amount: number
): [number, number, number] => {
  return [
    clampChannel(rgb[0] + (target[0] - rgb[0]) * amount),
    clampChannel(rgb[1] + (target[1] - rgb[1]) * amount),
    clampChannel(rgb[2] + (target[2] - rgb[2]) * amount),
  ];
};

const rgbString = ([red, green, blue]: [number, number, number]): string =>
  `${red}, ${green}, ${blue}`;

const createMatchThemeStyle = (backgroundHex: string): React.CSSProperties => {
  const baseRgb = hexToRgb(backgroundHex);
  const darkRgb = blendRgb(baseRgb, [0, 0, 0], 0.56);
  const deepRgb = blendRgb(baseRgb, [0, 0, 0], 0.34);
  const lightRgb = blendRgb(baseRgb, [255, 255, 255], 0.72);
  const softLightRgb = blendRgb(baseRgb, [255, 255, 255], 0.48);
  const style: React.CSSProperties = {
    backgroundColor: backgroundHex,
  };
  const cssVars = style as React.CSSProperties & Record<string, string>;
  cssVars['--match-base-rgb'] = rgbString(baseRgb);
  cssVars['--match-dark-rgb'] = rgbString(darkRgb);
  cssVars['--match-deep-rgb'] = rgbString(deepRgb);
  cssVars['--match-light-rgb'] = rgbString(lightRgb);
  cssVars['--match-soft-light-rgb'] = rgbString(softLightRgb);
  cssVars['--match-tint-soft'] = `rgba(${rgbString(baseRgb)}, 0.2)`;
  cssVars['--match-tint-medium'] = `rgba(${rgbString(baseRgb)}, 0.38)`;
  cssVars['--match-tint-strong'] = `rgba(${rgbString(baseRgb)}, 0.56)`;
  cssVars['--match-surface'] = `rgba(${rgbString(lightRgb)}, 0.9)`;
  cssVars['--match-surface-soft'] = `rgba(${rgbString(softLightRgb)}, 0.82)`;
  cssVars['--match-outline'] = `rgba(${rgbString(darkRgb)}, 0.55)`;
  cssVars['--match-text'] = `rgb(${rgbString(blendRgb(darkRgb, [0, 0, 0], 0.18))})`;

  return style;
};

const APP_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'arabina',
    title: 'Arabina',
    artist: 'Jade Epoh',
    src: '/music/Arabina.mp3',
    artSrc: '/music/art/Arabina.jpg',
  },
  {
    id: 'by',
    title: 'By',
    artist: 'Jade Epoh',
    src: '/music/By.mp3',
    artSrc: '/music/art/By.jpg',
  },
  {
    id: 'jello',
    title: 'Jello',
    artist: 'Jade Epoh',
    src: '/music/Jello.mp3',
  },
  {
    id: 'loli',
    title: 'Loli',
    artist: 'Jade Epoh',
    src: '/music/Loli.mp3',
    artSrc: '/music/art/loli-cover.svg',
  },
  {
    id: 'nostaligic-actsii-remastered',
    title: 'Nostaligic ActsII Remastered',
    artist: 'Jade Epoh & Capcidius',
    src: '/music/Nostaligic%20ActsII_Remastered.mp3',
    artSrc: '/music/art/Nostalgic%20Acts.jpg',
  },
  {
    id: 'untitled-08',
    title: 'Untitled 08',
    artist: 'Jade Epoh',
    src: '/music/untitled_08.mp3',
    artSrc: '/music/art/Untitled_08.jpg',
  },
];

const GOOGLE_ONLINE_NOTICE_MESSAGE =
  'Sign in with Google to access online multiplayer. CPU and local play do not need an account.';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('online');
  const [selectedGame, setSelectedGame] = useState<GameType>('tic-tac-two');
  const [activeGameType, setActiveGameType] = useState<GameType>('tic-tac-two');
  const [selectedGameCategory, setSelectedGameCategory] = useState<GameTypeCategory>('all');
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
  const [offlineParticipantCount, setOfflineParticipantCount] = useState(2);
  const [offlineParticipantNames, setOfflineParticipantNames] = useState<string[]>([
    'Player',
    'Player 2',
    'Player 3',
    'Player 4',
  ]);
  const [matchBackgroundColor, setMatchBackgroundColor] = useState('#ffffff');
  const [hasLocalSave, setHasLocalSave] = useState(false);
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(null);
  const [saveIndicator, setSaveIndicator] = useState('');
  const [showSaveTip, setShowSaveTip] = useState(false);
  const [dontShowSaveTipAgain, setDontShowSaveTipAgain] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount | null>(null);
  const [isProfileDockOpen, setIsProfileDockOpen] = useState(false);
  const [isNoticeDockOpen, setIsNoticeDockOpen] = useState(false);
  const [isGoogleSignInLoading, setIsGoogleSignInLoading] = useState(false);
  const isGoogleSignInInFlightRef = useRef(false);
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

  const clearStoredAuthSession = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEYS.authToken);
    window.localStorage.removeItem(STORAGE_KEYS.authTokenExpiresAt);
  }, []);

  const saveAuthToken = useCallback((token: string, expiresAt: string) => {
    window.localStorage.setItem(STORAGE_KEYS.authToken, token);
    window.localStorage.setItem(STORAGE_KEYS.authTokenExpiresAt, expiresAt);
  }, []);

  const getValidAuthToken = useCallback((): string | null => {
    const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
    if (!token) {
      return null;
    }

    const expiresAt = window.localStorage.getItem(STORAGE_KEYS.authTokenExpiresAt);
    if (!expiresAt) {
      clearStoredAuthSession();
      return null;
    }

    const expiresAtMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      clearStoredAuthSession();
      return null;
    }

    return token;
  }, [clearStoredAuthSession]);

  const saveGoogleAccount = useCallback((account: GoogleAccount | null) => {
    setGoogleAccount(account);
    if (!account) {
      window.localStorage.removeItem(STORAGE_KEYS.googleAccount);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.googleAccount, JSON.stringify(account));
  }, []);

  const applyAuthenticatedSession = useCallback(
    (payload: AuthSessionPayload) => {
      const fallbackAccount =
        !payload.account && payload.player?.playerId?.startsWith('google:')
          ? {
              sub: payload.player.playerId.replace(/^google:/, ''),
              name: payload.player.name,
            }
          : null;

      saveGoogleAccount(payload.account || fallbackAccount);
      setPlayer(payload.player);
      setPlayerName(payload.player.name);
      window.localStorage.setItem(STORAGE_KEYS.playerId, payload.player.playerId);
      window.localStorage.setItem(STORAGE_KEYS.playerName, payload.player.name);
      window.localStorage.setItem(STORAGE_KEYS.authTokenExpiresAt, payload.expiresAt);
    },
    [saveGoogleAccount]
  );

  const syncAuthenticatedPlayerRecord = useCallback(
    async (playerId: string, name: string): Promise<PlayerProfile> => {
      const payload = await callApi<PlayerProfile>(
        '/api/players/register',
        {
          method: 'POST',
          body: JSON.stringify({
            playerId,
            name,
          }),
        },
        false
      );

      setPlayer(payload);
      setPlayerName(payload.name);
      window.localStorage.setItem(STORAGE_KEYS.playerId, payload.playerId);
      window.localStorage.setItem(STORAGE_KEYS.playerName, payload.name);
      return payload;
    },
    [callApi]
  );

  const startGoogleSignIn = useCallback(() => {
    if (isGoogleSignInInFlightRef.current || isGoogleSignInLoading) {
      return;
    }

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const useFedCmForPrompt = process.env.NEXT_PUBLIC_GOOGLE_USE_FEDCM === 'true';
    if (!googleClientId) {
      setMessage('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend env');
      return;
    }

    if (!window.google?.accounts?.id) {
      setMessage('Google Sign-In script is not ready yet. Try again in a second.');
      return;
    }

    setIsGoogleSignInLoading(true);
    const resetGoogleSignInState = () => {
      isGoogleSignInInFlightRef.current = false;
      setIsGoogleSignInLoading(false);
    };

    const finishSignIn = (payload: GoogleSignInPayload) => {
      saveAuthToken(payload.authToken, payload.expiresAt);
      applyAuthenticatedSession(payload);
      setIsProfileDockOpen(true);

      syncAuthenticatedPlayerRecord(payload.player.playerId, payload.player.name)
        .then(() => {
          setMessage('Google account connected and synced');
        })
        .catch(() => {
          setMessage('Google account connected, but profile sync is delayed. Try again in a second.');
        });
    };

    const failSignIn = (error: unknown) => {
      clearStoredAuthSession();
      saveGoogleAccount(null);
      setMessage(error instanceof Error ? error.message : 'Google sign-in failed');
    };

    const signInWithAccessTokenFallback = () => {
      const tokenClientFactory = window.google?.accounts?.oauth2?.initTokenClient;
      if (!tokenClientFactory) {
        setMessage(
          'Google sign-in fallback is unavailable in this browser. Check Google Cloud OAuth origins and disable blockers for accounts.google.com.'
        );
        resetGoogleSignInState();
        return;
      }

      const tokenClient = tokenClientFactory({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: (tokenResponse: GoogleOauthTokenResponse) => {
          if (!tokenResponse?.access_token) {
            const details = tokenResponse?.error_description || tokenResponse?.error || 'token unavailable';
            setMessage(`Google OAuth fallback failed (${details}).`);
            resetGoogleSignInState();
            return;
          }

          setIsLoading(true);
          callApi<GoogleSignInPayload>('/api/auth/google/token', {
            method: 'POST',
            body: JSON.stringify({ accessToken: tokenResponse.access_token }),
          })
            .then((payload) => {
              finishSignIn(payload);
            })
            .catch((error) => {
              failSignIn(error);
            })
            .finally(() => {
              setIsLoading(false);
              resetGoogleSignInState();
            });
        },
      });

      try {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Google OAuth fallback could not start.');
        resetGoogleSignInState();
      }
    };

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        use_fedcm_for_prompt: useFedCmForPrompt,
        callback: (response: GoogleCredentialResponse) => {
          if (isGoogleSignInInFlightRef.current) {
            return;
          }

          if (!response.credential) {
            setMessage('Google sign-in did not return credentials');
            resetGoogleSignInState();
            return;
          }

          isGoogleSignInInFlightRef.current = true;
          setIsLoading(true);
          callApi<GoogleSignInPayload>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: response.credential }),
          })
            .then((payload) => {
              finishSignIn(payload);
            })
            .catch((error) => {
              failSignIn(error);
            })
            .finally(() => {
              setIsLoading(false);
              resetGoogleSignInState();
            });
        },
      });

      window.google.accounts.id.prompt((notification) => {
        const isNotDisplayed = Boolean(notification?.isNotDisplayed && notification.isNotDisplayed());
        const isSkipped = Boolean(notification?.isSkippedMoment && notification.isSkippedMoment());
        const isDismissed = Boolean(notification?.isDismissedMoment && notification.isDismissedMoment());

        if (!isNotDisplayed && !isSkipped && !isDismissed) {
          return;
        }

        const reason =
          (notification?.getNotDisplayedReason && notification.getNotDisplayedReason()) ||
          (notification?.getSkippedReason && notification.getSkippedReason()) ||
          (notification?.getDismissedReason && notification.getDismissedReason()) ||
          'unknown';

        if (isGoogleSignInInFlightRef.current) {
          return;
        }

        // eslint-disable-next-line no-console
        console.warn('Google sign-in prompt was not completed', { reason, isNotDisplayed, isSkipped, isDismissed });
        const normalizedReason = String(reason).toLowerCase();
        const shouldUseFallback =
          normalizedReason.includes('fedcm') ||
          normalizedReason.includes('network') ||
          normalizedReason.includes('opt_out_or_no_session') ||
          normalizedReason.includes('unknown_reason');

        if (shouldUseFallback) {
          isGoogleSignInInFlightRef.current = true;
          signInWithAccessTokenFallback();
          return;
        }

        setMessage(
          `Google sign-in could not complete (${reason}). Add ${window.location.origin} to Authorized JavaScript origins in Google Cloud, disable blockers for accounts.google.com, and retry.`
        );
        resetGoogleSignInState();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google sign-in could not start.');
      resetGoogleSignInState();
    }
  }, [
    applyAuthenticatedSession,
    callApi,
    clearStoredAuthSession,
    isGoogleSignInLoading,
    saveAuthToken,
    saveGoogleAccount,
    syncAuthenticatedPlayerRecord,
  ]);

  const signOutGoogle = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.cancel();
    }

    const wasGooglePlayer = Boolean(player?.playerId && player.playerId.startsWith('google:'));

    callApi<{ ok: boolean }>(
      '/api/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      false
    )
      .catch(() => {
        // Ignore logout network errors; local sign-out still applies.
      })
      .finally(() => {
        clearStoredAuthSession();
        saveGoogleAccount(null);
        if (wasGooglePlayer) {
          setPlayer(null);
          window.localStorage.removeItem(STORAGE_KEYS.playerId);
          if (screen === 'game') {
            setActiveRoomCode(null);
            setGameMode('online');
            setScreen('lobby');
          }
        }
        setMessage('Signed out from Google account');
      });
  }, [callApi, clearStoredAuthSession, player, saveGoogleAccount, screen]);

  const requireGoogleAccountForOnline = useCallback((): GoogleAccount | null => {
    const authToken = getValidAuthToken();

    if (googleAccount && authToken) {
      return googleAccount;
    }

    if (googleAccount && !authToken) {
      saveGoogleAccount(null);
      if (player?.playerId && player.playerId.startsWith('google:')) {
        setPlayer(null);
        window.localStorage.removeItem(STORAGE_KEYS.playerId);
      }
    }

    setMessage(GOOGLE_ONLINE_NOTICE_MESSAGE);
    setIsProfileDockOpen(true);
    return null;
  }, [getValidAuthToken, googleAccount, player, saveGoogleAccount]);

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
            ((entry as MatchHistoryEntry).mode === 'online' ||
              (entry as MatchHistoryEntry).mode === 'cpu' ||
              (entry as MatchHistoryEntry).mode === 'offline') &&
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

  const findGameDefinition = useCallback(
    (gameType: GameType): GameDefinition => {
      return (
        availableGames.find((game) => game.id === gameType) ||
        FALLBACK_GAMES.find((game) => game.id === gameType) ||
        FALLBACK_GAMES[0]
      );
    },
    [availableGames]
  );

  const getGamesByCategory = useCallback(
    (category: GameTypeCategory): GameDefinition[] => {
      return availableGames.filter((game) => {
        if (category === 'online-multiplayer') {
          return game.supportsOnline && game.minPlayers >= 2;
        }
        if (category === 'online') {
          return game.supportsOnline;
        }
        if (category === 'single-player') {
          return !game.supportsOnline || game.maxPlayers === 1;
        }
        return true;
      });
    },
    [availableGames]
  );

  const getSupportedModesForGame = useCallback(
    (gameType: GameType): GameMode[] => {
      const definition = findGameDefinition(gameType);
      const modes: GameMode[] = [];
      if (definition.supportsCpu) {
        modes.push('cpu');
      }
      if (definition.supportsOnline) {
        modes.push('online');
      }
      if (definition.maxPlayers > 1) {
        modes.push('offline');
      }
      return modes;
    },
    [findGameDefinition]
  );

  const getPreferredModeForGame = useCallback(
    (gameType: GameType, preferredMode?: GameMode): GameMode => {
      const supportedModes = getSupportedModesForGame(gameType);
      if (supportedModes.length === 0) {
        return 'cpu';
      }
      if (preferredMode && supportedModes.includes(preferredMode)) {
        return preferredMode;
      }
      if (supportedModes.includes('online')) {
        return 'online';
      }
      if (supportedModes.includes('offline')) {
        return 'offline';
      }
      return supportedModes[0];
    },
    [getSupportedModesForGame]
  );

  const filteredGames = useMemo(
    () => getGamesByCategory(selectedGameCategory),
    [getGamesByCategory, selectedGameCategory]
  );

  const ensurePlayer = async (identity?: { playerId: string; name: string }) => {
    const savedPlayerId = identity?.playerId || window.localStorage.getItem(STORAGE_KEYS.playerId);
    const payload = await callApi<PlayerProfile>('/api/players/register', {
      method: 'POST',
      body: JSON.stringify({
        playerId: savedPlayerId,
        name: identity?.name || playerName || 'Player',
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

  const getOfflineParticipantCountRange = useCallback(
    (gameType: GameType) => {
      const definition = findGameDefinition(gameType);
      const max = Math.max(2, Math.min(4, definition.maxPlayers));
      const min = Math.max(2, Math.min(max, definition.minPlayers));
      return { min, max };
    },
    [findGameDefinition]
  );

  const clampOfflineParticipantCount = useCallback(
    (gameType: GameType, desiredCount: number) => {
      const { min, max } = getOfflineParticipantCountRange(gameType);
      return Math.min(max, Math.max(min, desiredCount));
    },
    [getOfflineParticipantCountRange]
  );

  const resolveOfflineParticipantNames = useCallback(
    (gameType: GameType, count: number): string[] => {
      const seats = getOfflineSeats(gameType, count);
      return seats.map((seat, index) => {
        const nextValue = String(offlineParticipantNames[index] || '').trim();
        if (nextValue.length > 0) {
          return nextValue;
        }
        return index === 0 ? playerName || 'Player' : `Player ${index + 1}`;
      });
    },
    [offlineParticipantNames, playerName]
  );

  const startOfflineMatch = async () => {
    const selectedDefinition = findGameDefinition(selectedGame);
    if (selectedDefinition.maxPlayers <= 1) {
      setMessage(`${selectedDefinition.name} is single-player only`);
      return;
    }

    try {
      setIsLoading(true);
      await ensurePlayer();
      const nextCount = clampOfflineParticipantCount(selectedGame, offlineParticipantCount);
      const nextNames = resolveOfflineParticipantNames(selectedGame, nextCount);
      setOfflineParticipantCount(nextCount);
      setOfflineParticipantNames((currentValue) => {
        const merged = [...currentValue];
        nextNames.forEach((name, index) => {
          merged[index] = name;
        });
        return merged;
      });
      beginMatch('offline', null, selectedGame);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start local match');
    } finally {
      setIsLoading(false);
    }
  };

  const createRoom = async (isPublic: boolean) => {
    const selectedDefinition = findGameDefinition(selectedGame);
    if (!selectedDefinition.supportsOnline) {
      setMessage(`${selectedDefinition.name} is single-player only`);
      return;
    }

    try {
      setIsLoading(true);
      const onlineAccount = requireGoogleAccountForOnline();
      if (!onlineAccount) {
        return;
      }

      const payload = await callApi<RoomPayload>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
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
      const onlineAccount = requireGoogleAccountForOnline();
      if (!onlineAccount) {
        return;
      }

      const payload = await callApi<RoomPayload>('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({
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
    const selectedDefinition = findGameDefinition(selectedGame);
    if (!selectedDefinition.supportsCpu) {
      setMessage(`${selectedDefinition.name} is not available in CPU mode`);
      return;
    }

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
    const savedGoogleAccount = window.localStorage.getItem(STORAGE_KEYS.googleAccount);
    const validAuthToken = getValidAuthToken();

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
    if (savedGoogleAccount && validAuthToken) {
      try {
        const parsedGoogle = JSON.parse(savedGoogleAccount) as GoogleAccount;
        if (parsedGoogle?.sub && parsedGoogle?.name) {
          setGoogleAccount(parsedGoogle);
          setPlayerName(parsedGoogle.name);
        }
      } catch (_error) {
        // ignore malformed saved account
      }
    } else if (savedGoogleAccount && !validAuthToken) {
      window.localStorage.removeItem(STORAGE_KEYS.googleAccount);
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

    if (validAuthToken) {
      callApi<AuthSessionPayload>('/api/auth/session', undefined, false)
        .then((payload) => {
          applyAuthenticatedSession(payload);
        })
        .catch(() => {
          clearStoredAuthSession();
          saveGoogleAccount(null);
          const storedPlayerId = window.localStorage.getItem(STORAGE_KEYS.playerId);
          if (storedPlayerId && storedPlayerId.startsWith('google:')) {
            window.localStorage.removeItem(STORAGE_KEYS.playerId);
            setPlayer(null);
          }
        });
    }

    const shouldHideSaveTip = window.localStorage.getItem(STORAGE_KEYS.hideSaveTip);
    setShowSaveTip(shouldHideSaveTip !== 'true');

    refreshPublicRooms().catch(() => {
      // Ignore initial lobby load failures.
    });
    refreshLeaderboard().catch(() => {
      // Ignore initial leaderboard load failures.
    });
  }, []);

  useEffect(() => {
    if (document.querySelector('script[data-google-identity]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.preferredGame, selectedGame);
  }, [selectedGame]);

  useEffect(() => {
    const preferredMode = getPreferredModeForGame(selectedGame, gameMode);
    if (preferredMode !== gameMode) {
      setGameMode(preferredMode);
    }

    const clampedCount = clampOfflineParticipantCount(selectedGame, offlineParticipantCount);
    if (clampedCount !== offlineParticipantCount) {
      setOfflineParticipantCount(clampedCount);
    }

    const seats = getOfflineSeats(selectedGame, clampedCount);
    setOfflineParticipantNames((currentValue) => {
      const nextValue = [...currentValue];
      let hasChanged = false;
      seats.forEach((seat, index) => {
        if (index === 0) {
          const nextName = playerName || 'Player';
          if (nextValue[index] !== nextName) {
            nextValue[index] = nextName;
            hasChanged = true;
          }
          return;
        }
        const existingValue = String(nextValue[index] || '').trim();
        if (!existingValue) {
          nextValue[index] = `Player ${seat.index + 1}`;
          hasChanged = true;
        }
      });
      return hasChanged ? nextValue : currentValue;
    });
  }, [
    clampOfflineParticipantCount,
    gameMode,
    getPreferredModeForGame,
    offlineParticipantCount,
    playerName,
    selectedGame,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      saveLocalBackup('auto');
    }, 1 * 60 * 1000);

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
    setIsNoticeDockOpen(Boolean(message));
  }, [message]);

  const noticeTone = useMemo<NoticeTone>(() => {
    const normalizedMessage = message.trim().toLowerCase();
    if (!normalizedMessage) {
      return 'info';
    }

    if (normalizedMessage === GOOGLE_ONLINE_NOTICE_MESSAGE.toLowerCase()) {
      return 'warning';
    }

    const errorPattern =
      /could not|failed|fail|error|missing|required|invalid|unavailable|not ready|disabled|no valid|delayed/;
    const warningPattern = /tip|notice|retry|recommended|only|first/;
    const successPattern = /saved|loaded|connected|signed out|reset|synced|joined|created|started|ready/;

    if (errorPattern.test(normalizedMessage)) {
      return 'error';
    }
    if (successPattern.test(normalizedMessage)) {
      return 'success';
    }
    if (warningPattern.test(normalizedMessage)) {
      return 'warning';
    }

    return 'info';
  }, [message]);

  const noticeTitle = useMemo(() => {
    if (noticeTone === 'error') {
      return 'Error';
    }
    if (noticeTone === 'success') {
      return 'Success';
    }
    if (noticeTone === 'warning') {
      return 'Notice';
    }
    return 'Update';
  }, [noticeTone]);

  const applyCpuDifficulty = useCallback((difficulty: CpuDifficulty) => {
    setCpuDifficulty(difficulty);
    window.localStorage.setItem(STORAGE_KEYS.cpuDifficulty, difficulty);
  }, []);

  const applyPlayMode = useCallback(
    (mode: GameMode) => {
      const preferred = getPreferredModeForGame(selectedGame, mode);
      setGameMode(preferred);
    },
    [getPreferredModeForGame, selectedGame]
  );

  const applyOfflineParticipantCount = useCallback(
    (count: number) => {
      setOfflineParticipantCount(clampOfflineParticipantCount(selectedGame, count));
    },
    [clampOfflineParticipantCount, selectedGame]
  );

  const applyOfflineParticipantName = useCallback((index: number, value: string) => {
    setOfflineParticipantNames((currentValue) => {
      const nextValue = [...currentValue];
      nextValue[index] = value;
      return nextValue;
    });
  }, []);

  const isInMatch = screen === 'game' && Boolean(player);
  const matchThemeStyle = isInMatch ? createMatchThemeStyle(matchBackgroundColor) : undefined;

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
          onPlay={() => setScreen('game-type-select')}
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

    if (screen === 'game-type-select') {
      return (
        <GameTypeSelectScreen
          games={availableGames}
          selectedCategory={selectedGameCategory}
          onSelectCategory={(category) => {
            const filtered = getGamesByCategory(category);
            if (filtered.length > 0 && !filtered.some((game) => game.id === selectedGame)) {
              setSelectedGame(filtered[0].id);
            }
            setSelectedGameCategory(category);
          }}
          onBack={() => setScreen('home')}
          onContinue={() => {
            const filtered = getGamesByCategory(selectedGameCategory);
            if (filtered.length === 0) {
              setMessage('No games are available for that category yet.');
              return;
            }
            if (!filtered.some((game) => game.id === selectedGame)) {
              setSelectedGame(filtered[0].id);
            }
            setScreen('game-select');
          }}
        />
      );
    }

    if (screen === 'game-select') {
      return (
        <GameSelectScreen
          games={filteredGames}
          selectedGame={selectedGame}
          onSelectGame={setSelectedGame}
          onBack={() => setScreen('game-type-select')}
          onContinue={() => {
            const selectedDefinition = findGameDefinition(selectedGame);
            setGameMode(getPreferredModeForGame(selectedGame, gameMode));
            setScreen(selectedDefinition.supportsOnline ? 'lobby' : 'single-player-lobby');
          }}
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
          playMode={gameMode}
          cpuDifficulty={cpuDifficulty}
          offlinePlayerCount={offlineParticipantCount}
          offlinePlayerNames={offlineParticipantNames}
          games={availableGames}
          publicRooms={publicRooms}
          playerProfile={player}
          googleAccount={googleAccount}
          isLoading={isLoading}
          onBack={() => setScreen('game-select')}
          onGameChange={setSelectedGame}
          onPlayModeChange={applyPlayMode}
          onCpuDifficultyChange={applyCpuDifficulty}
          onOfflinePlayerCountChange={applyOfflineParticipantCount}
          onOfflinePlayerNameChange={applyOfflineParticipantName}
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
          onPlayOffline={() => void startOfflineMatch()}
        />
      );
    }

    if (screen === 'single-player-lobby') {
      return (
        <LobbyScreen
          playerName={playerName}
          roomName={roomName}
          joinCode={joinCode}
          selectedGame={selectedGame}
          playMode={gameMode}
          cpuDifficulty={cpuDifficulty}
          offlinePlayerCount={offlineParticipantCount}
          offlinePlayerNames={offlineParticipantNames}
          games={availableGames}
          publicRooms={publicRooms}
          playerProfile={player}
          googleAccount={googleAccount}
          isLoading={isLoading}
          isSinglePlayerMode={true}
          onBack={() => setScreen('game-select')}
          onGameChange={setSelectedGame}
          onPlayModeChange={applyPlayMode}
          onCpuDifficultyChange={applyCpuDifficulty}
          onOfflinePlayerCountChange={applyOfflineParticipantCount}
          onOfflinePlayerNameChange={applyOfflineParticipantName}
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
          onPlayCpu={() => void startCpuMatch()}
          onPlayOffline={() => void startOfflineMatch()}
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
          onCpuDifficultyChange={applyCpuDifficulty}
          onSaveNow={() => {
            saveLocalBackup('manual');
          }}
          onLoadSave={() => {
            loadLocalBackup();
          }}
          onResetPreferences={() => {
            setIsMusicMuted(false);
            setMusicVolume(70);
            setEnableAnimations(true);
            applyCpuDifficulty('medium');
            window.localStorage.setItem(STORAGE_KEYS.musicMuted, 'false');
            window.localStorage.setItem(STORAGE_KEYS.musicVolume, '70');
            window.localStorage.setItem(STORAGE_KEYS.enableAnimations, 'true');
            showSaveIndicator('Preferences reset');
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
          enableAnimations={enableAnimations}
          cpuDifficulty={cpuDifficulty}
          runWithLoader={runWithLoader}
          onToggleMusic={() => {
            const nextValue = !isMusicMuted;
            setIsMusicMuted(nextValue);
            window.localStorage.setItem(STORAGE_KEYS.musicMuted, String(nextValue));
          }}
          onToggleAnimations={() => {
            const nextValue = !enableAnimations;
            setEnableAnimations(nextValue);
            window.localStorage.setItem(STORAGE_KEYS.enableAnimations, String(nextValue));
          }}
          onProfileUpdate={(updatedPlayer) => {
            setPlayer(updatedPlayer);
          }}
          onMatchComplete={recordMatchResult}
          onLeave={() => {
            setActiveRoomCode(null);
            setGameMode(getPreferredModeForGame(activeGameType, gameMode));
            setSelectedGame(activeGameType);
            const activeDefinition = findGameDefinition(activeGameType);
            setScreen(activeDefinition.supportsOnline ? 'lobby' : 'single-player-lobby');
            refreshPublicRooms().catch(() => {
              // ignore
            });
            refreshLeaderboard().catch(() => {
              // ignore
            });
          }}
          offlineParticipantNames={resolveOfflineParticipantNames(activeGameType, offlineParticipantCount)}
          offlineParticipantCount={clampOfflineParticipantCount(activeGameType, offlineParticipantCount)}
        />
      );
    }

    return null;
  };

  return (
    <main
      className={classnames(isInMatch ? 'match-screen-root' : 'title-screen-root', !enableAnimations && 'motion-off')}
      style={matchThemeStyle}
    >
      {!isInMatch ? renderTopBar() : null}
      {renderScreen()}
      <AppLoader active={activeRequests > 0} subtle={isInMatch} />
      {saveIndicator ? <div className="save-indicator">{saveIndicator}</div> : null}
      {showSaveTip ? (
        <div className="save-tip-card">
          <p>
            Backups are local-only right now. Use Settings to save or load this device backup for your Baturo Arena lineup.
          </p>
          <label className="save-tip-check custome-shadow-invert">
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
      <div className="dock-launchers">
        <ProfileDock
          isOpen={isProfileDockOpen}
          account={googleAccount}
          playerProfile={player}
          playerName={playerName}
          isSigningIn={isGoogleSignInLoading}
          onToggleOpen={() => setIsProfileDockOpen((currentValue) => !currentValue)}
          onSignIn={startGoogleSignIn}
          onSignOut={signOutGoogle}
          onPlayerNameChange={setPlayerName}
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
        />
        {message ? (
          <GoogleNoticeDock
            isOpen={isNoticeDockOpen}
            title={noticeTitle}
            tone={noticeTone}
            message={message}
            onToggleOpen={() => setIsNoticeDockOpen((currentValue) => !currentValue)}
            onDismiss={() => {
              setIsNoticeDockOpen(false);
              setMessage('');
            }}
          />
        ) : null}
        <MusicDock
          tracks={APP_MUSIC_TRACKS}
          isMuted={isMusicMuted}
          volume={musicVolume}
          showLauncher={!isProfileDockOpen}
          onToggleMute={() => {
            const nextValue = !isMusicMuted;
            setIsMusicMuted(nextValue);
            window.localStorage.setItem(STORAGE_KEYS.musicMuted, String(nextValue));
          }}
          onVolumeChange={(volume) => {
            setMusicVolume(volume);
            window.localStorage.setItem(STORAGE_KEYS.musicVolume, String(volume));
          }}
        />
      </div>
      {!isInMatch ? <span className="fixed bottom-1 text-sm">Project By AJ4200 c 2023</span> : null}
    </main>
  );
}
