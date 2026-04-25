export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BATURO_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BARUTO_API_BASE_URL ||
  process.env.NEXT_PUBLIC_TTT_API_BASE_URL ||
  'http://localhost:4000';

export const STORAGE_KEYS = {
  playerId: 'baruto_player_id',
  playerName: 'baruto_player_name',
  authToken: 'baruto_auth_token_v1',
  authTokenExpiresAt: 'baruto_auth_token_expires_at_v1',
  musicMuted: 'baruto_music_muted',
  musicVolume: 'baruto_music_volume',
  enableAnimations: 'baruto_enable_animations',
  cpuDifficulty: 'baruto_cpu_difficulty',
  preferredGame: 'baruto_preferred_game',
  localBackup: 'baruto_local_backup_v2',
  matchHistory: 'baruto_match_history_v2',
  hideSaveTip: 'baruto_hide_save_tip',
  googleAccount: 'baruto_google_account_v1',
  inviteOnly: 'baruto_invite_only_raibarus',
};
