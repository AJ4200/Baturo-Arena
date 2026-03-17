export const API_BASE_URL =
  process.env.NEXT_PUBLIC_TTT_API_BASE_URL || "http://localhost:4000";

export const STORAGE_KEYS = {
  playerId: "ttt_player_id",
  playerName: "ttt_player_name",
  musicMuted: "ttt_music_muted",
  musicVolume: "ttt_music_volume",
  enableAnimations: "ttt_enable_animations",
  cpuDifficulty: "ttt_cpu_difficulty",
  localBackup: "ttt_local_backup_v1",
  matchHistory: "ttt_match_history_v1",
  hideSaveTip: "ttt_hide_save_tip",
};
