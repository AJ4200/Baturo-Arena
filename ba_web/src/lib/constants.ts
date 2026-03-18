export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BARUTO_API_BASE_URL ||
  process.env.NEXT_PUBLIC_TTT_API_BASE_URL ||
  "http://localhost:4000";

export const STORAGE_KEYS = {
  playerId: "baruto_player_id",
  playerName: "baruto_player_name",
  musicMuted: "baruto_music_muted",
  musicVolume: "baruto_music_volume",
  enableAnimations: "baruto_enable_animations",
  cpuDifficulty: "baruto_cpu_difficulty",
  localBackup: "baruto_local_backup_v1",
  matchHistory: "baruto_match_history_v1",
  hideSaveTip: "baruto_hide_save_tip",
};
