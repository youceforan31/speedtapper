// --- Achievement Definitions ---
// Assumes 'appState' (especially appState.stats and appState.achievements) is globally accessible or passed if needed.
// Assumes 'ACHIEVEMENTS' itself is globally accessible for the 'perfectionist' check.

const ACHIEVEMENTS = {
    // --- Original 5 ---
    'taps_100': {
        titleKey: 'ach_taps_100_t', descKey: 'ach_taps_100_d', icon: '👆',
        condition: (stats) => stats.total_taps >= 100,
        progressMax: 100, progressCurrentFn: (stats) => stats.total_taps
    },
    'sp_target_hs_50': {
        titleKey: 'ach_sp_target_hs_50_t', descKey: 'ach_sp_target_hs_50_d', icon: '🎯',
        condition: (stats) => stats.single_player_high_score >= 50,
        progressMax: 50, progressCurrentFn: (stats) => stats.single_player_high_score
    },
    'sp_tap_hs_30': {
        titleKey: 'ach_sp_tap_hs_30_t', descKey: 'ach_sp_tap_hs_30_d', icon: '⏱️',
        // Checks highest score achieved in tap mode for *any* duration recorded
        condition: (stats) => stats.sp_taps_in_duration >= 30,
        progressMax: 30, progressCurrentFn: (stats) => stats.sp_taps_in_duration
    },
    'tp_win_10': {
        titleKey: 'ach_tp_win_10_t', descKey: 'ach_tp_win_10_d', icon: '⚔️',
        condition: (stats) => (stats.p1_wins + stats.p2_wins) >= 10,
        progressMax: 10, progressCurrentFn: (stats) => (stats.p1_wins + stats.p2_wins)
    },
    'play_all_modes': {
        titleKey: 'ach_play_all_modes_t', descKey: 'ach_play_all_modes_d', icon: '🗺️',
        condition: (stats) => stats.games_played_sp_tap > 0 && stats.games_played_sp_target > 0 && stats.games_played_tp_tap > 0 && stats.games_played_tp_target > 0
    },

    // --- New 15 ---
    'taps_500': {
        titleKey: 'ach_taps_500_t', descKey: 'ach_taps_500_d', icon: '👆👆',
        condition: (stats) => stats.total_taps >= 500,
        progressMax: 500, progressCurrentFn: (stats) => stats.total_taps
    },
    'taps_1000': {
        titleKey: 'ach_taps_1000_t', descKey: 'ach_taps_1000_d', icon: '🚀',
        condition: (stats) => stats.total_taps >= 1000,
        progressMax: 1000, progressCurrentFn: (stats) => stats.total_taps
    },
    'sp_target_hs_100': {
        titleKey: 'ach_sp_target_hs_100_t', descKey: 'ach_sp_target_hs_100_d', icon: '🏆',
        condition: (stats) => stats.single_player_high_score >= 100,
        progressMax: 100, progressCurrentFn: (stats) => stats.single_player_high_score
    },
     'sp_tap_hs_50': {
        titleKey: 'ach_sp_tap_hs_50_t', descKey: 'ach_sp_tap_hs_50_d', icon: '🔥',
        condition: (stats) => stats.sp_taps_in_duration >= 50,
        progressMax: 50, progressCurrentFn: (stats) => stats.sp_taps_in_duration
    },
    'tp_win_50': {
        titleKey: 'ach_tp_win_50_t', descKey: 'ach_tp_win_50_d', icon: '👑',
        condition: (stats) => (stats.p1_wins + stats.p2_wins) >= 50,
        progressMax: 50, progressCurrentFn: (stats) => (stats.p1_wins + stats.p2_wins)
    },
    'tp_perfect_win': {
        titleKey: 'ach_tp_perfect_win_t', descKey: 'ach_tp_perfect_win_d', icon: '💯',
        // Checks the result of the *last* completed two-player game
        condition: (stats, lastResult) => lastResult && !lastResult.tie && lastResult.p1Score !== undefined && lastResult.p2Score !== undefined && lastResult.scoreL === 0
    },
    'sp_target_streak_10': {
        titleKey: 'ach_sp_target_streak_10_t', descKey: 'ach_sp_target_streak_10_d', icon: '✅',
        condition: (stats) => stats.consecutive_targets_hit >= 10,
        progressMax: 10, progressCurrentFn: (stats) => stats.consecutive_targets_hit
    },
     'sp_target_streak_25': {
        titleKey: 'ach_sp_target_streak_25_t', descKey: 'ach_sp_target_streak_25_d', icon: '✨',
        condition: (stats) => stats.consecutive_targets_hit >= 25,
        progressMax: 25, progressCurrentFn: (stats) => stats.consecutive_targets_hit
        // Note: consecutive_targets_hit is reset on game start and when missing/tapping in tap mode.
    },
    'close_call_win': {
        titleKey: 'ach_close_call_win_t', descKey: 'ach_close_call_win_d', icon: '😅',
        // Checks the result of the *last* completed two-player game
        condition: (stats, lastResult) => lastResult && !lastResult.tie && lastResult.scoreW !== undefined && lastResult.scoreL !== undefined && (lastResult.scoreW - lastResult.scoreL === 1)
    },
    'play_sp_10': {
        titleKey: 'ach_play_sp_10_t', descKey: 'ach_play_sp_10_d', icon: '🚶',
        condition: (stats) => (stats.games_played_sp_tap + stats.games_played_sp_target) >= 10,
        progressMax: 10, progressCurrentFn: (stats) => (stats.games_played_sp_tap + stats.games_played_sp_target)
    },
    'play_tp_25': {
        titleKey: 'ach_play_tp_25_t', descKey: 'ach_play_tp_25_d', icon: '🧑‍🤝‍🧑',
        condition: (stats) => (stats.games_played_tp_tap + stats.games_played_tp_target) >= 25,
        progressMax: 25, progressCurrentFn: (stats) => (stats.games_played_tp_tap + stats.games_played_tp_target)
    },
    'speed_demon_30s': {
        titleKey: 'ach_speed_demon_30s_t', descKey: 'ach_speed_demon_30s_d', icon: '⚡',
        // Checks the highest score recorded specifically for the 30s duration
        condition: (stats) => stats.sp_taps_in_duration_setting === 30 && stats.sp_taps_in_duration >= 60,
        progressMax: 60, progressCurrentFn: (stats) => (stats.sp_taps_in_duration_setting === 30 ? stats.sp_taps_in_duration : 0)
    },
    'marathon_60s': {
        titleKey: 'ach_marathon_60s_t', descKey: 'ach_marathon_60s_d', icon: '🏃',
        // Requires a new stat 'played_60s_game' to be tracked in app.js
        condition: (stats) => stats.played_60s_game === true
    },
    'theme_explorer': {
        titleKey: 'ach_theme_explorer_t', descKey: 'ach_theme_explorer_d', icon: '🎨',
        // Requires new stats 'used_dark_theme' and 'used_light_theme'
        condition: (stats) => stats.used_dark_theme === true && stats.used_light_theme === true
    },
    'perfectionist': {
        titleKey: 'ach_perfectionist_t', descKey: 'ach_perfectionist_d', icon: '⭐',
        // Checks if all *other* achievements are unlocked
        condition: (stats, lastResult, currentAchievements) => {
            // Iterate through all achievement IDs defined in ACHIEVEMENTS
            for (const id in ACHIEVEMENTS) {
                // Skip checking the 'perfectionist' achievement itself
                if (id === 'perfectionist') continue;
                // If any other achievement is not found in currentAchievements or is not unlocked, return false
                if (!currentAchievements || !currentAchievements[id] || !currentAchievements[id].unlocked) {
                    return false;
                }
            }
            // If the loop completes without returning false, all other achievements are unlocked
            return true;
        }
        // Note: This condition function now expects the current achievements state as the third argument.
        // The checkAchievements function in app.js will need to be updated to pass this.
    }
};

// Make ACHIEVEMENTS globally accessible if needed