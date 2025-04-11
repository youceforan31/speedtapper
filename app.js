// --- Constants and State ---
const DEFAULT_GAME_DURATION = 30;
const ANIMATION_DURATION_MS = 50; // Used for transitions mainly now
const VIBRATION_DURATION_MS = 50; // Shorter vibration
const BUTTON_PRESS_SCALE = 0.97; // Primarily visual via CSS :active
const LOCAL_STORAGE_KEY = 'speedTapperUltraPlus_v1'; // New key for separate storage
const MAX_LOG_ENTRIES = 50;
const TARGET_SIZE_SP = 90; // Base size for Single Player targets
const TARGET_SIZE_TP = 70; // Base size for Two Player targets
const ACHIEVEMENT_SAVE_INTERVAL = 5000; // How often to potentially save state if achievements change

let appState = {
    currentScreen: 'menu',
    currentPlayerMode: 'single', // 'single' or 'two'
    currentGameMode: 'tap', // 'tap' or 'target'
    settings: {
        soundEnabled: true,
        musicEnabled: false, // Default music off
        vibrationEnabled: true,
        gameDuration: DEFAULT_GAME_DURATION,
        difficulty: 'medium', // 'easy', 'medium', 'hard' for target mode
        theme: 'dark', // 'dark' or 'light'
        language: 'english' // 'english' or 'arabic'
    },
    stats: {
        p1_wins: 0,
        p2_wins: 0,
        total_taps: 0, // Combined taps and target hits
        single_player_high_score: 0, // Target mode high score
        sp_taps_in_duration: 0,      // Tap mode high score for the duration below
        sp_taps_in_duration_setting: DEFAULT_GAME_DURATION,
        consecutive_targets_hit: 0,  // Tracks consecutive hits in target mode within a single game
        games_played_sp_tap: 0,
        games_played_sp_target: 0,
        games_played_tp_tap: 0,
        games_played_tp_target: 0,
        // --- New Stats for Achievements ---
        played_60s_game: false,     // Has a 60s game been completed?
        used_dark_theme: false,     // Has dark theme been applied?
        used_light_theme: false     // Has light theme been applied?
        // ----------------------------------
    },
    achievements: {}, // Stores unlocked status, e.g., { 'taps_100': { unlocked: true, notified: true, progress: 100 } }
    gameLog: [], // Array of game result objects
    soundManager: {
        sounds: {}, // Cache for loaded Audio objects
        enabled: true,
        audioContext: null, // Web Audio API context
        backgroundMusic: null // Reference to the <audio> element
    },
    activePopups: [], // Stack of currently visible popup IDs
    lastGameResult: { // Store details of the last completed game for sharing/achievements
        winner: '', loser: '', scoreW: 0, scoreL: 0, p1Score: undefined, p2Score: undefined, spScore: undefined, tie: false, duration: DEFAULT_GAME_DURATION, mode: 'tap' // Added duration/mode here
    }
};
// --- DOM References ---
// Ensure these are assigned after the DOM is loaded (handled in initializeApp)
let bodyElement;
let backgroundMusicElement;
let screens = {};
let popups = {};
let menuButtons = {};
let settingsControls = {};
let menuStatsLabel;
let singlePlayerElements = {};
let twoPlayerElements = {};
let logElements = {};
let achievementElements = {};
let consolidatedPopupElements = {}; // References to elements within popups
// --- Core Functions ---

/**
 * Gets localized text based on the current language setting.
 * @param {string} key - The translation key.
 * @param {...any} args - Values to replace placeholders '{}' in the text.
 * @returns {string} The localized text.
 */
function getLocalizedText(key, ...args) {
    const lang = appState.settings.language || 'english';
    // Assumes 'translations' object is globally available from translations.js
    let textData = translations[key];

    if (!textData) {
        console.warn(`Missing translation for key: ${key}`);
        return `[${key}]`; // Return key as fallback
    }

    let text = textData[lang];
    if (!text) {
        // Fallback to English if current language translation is missing
        text = textData['english'];
        if (!text) return `[${key}]`; // Return key if English is also missing
    }

    // Replace placeholders sequentially
    args.forEach(arg => {
        text = text.replace('{}', arg !== null && arg !== undefined ? arg : '');
    });

    return text;
}

/**
 * Updates all UI elements with the data-i18n attribute to the current language.
 */
function updateAllTexts() {
    const lang = appState.settings.language;
    document.documentElement.lang = lang === 'arabic' ? 'ar' : 'en';
    document.documentElement.dir = lang === 'arabic' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const formatKey = element.getAttribute('data-i18n-format'); // For dynamic text like settings
        let text = '';

        if (formatKey) {
            // Handle formatted strings (like settings toggles or high scores)
             if (!translations[key]) {
                 console.warn(`Missing translation format key: ${key}`);
                 text = `[${key}]`;
             } else {
                 let currentValue = '...'; // Default placeholder
                 try {
                     // Determine the value based on the key
                     const formatValues = {
                         Sound: appState.settings.soundEnabled,
                         Music: appState.settings.musicEnabled,
                         Vibration: appState.settings.vibrationEnabled
                     };
                     const settingKey = key.split('_')[0]; // e.g., 'sound' from 'sound_toggle'

                     if (key === 'game_duration_label') {
                         currentValue = appState.settings.gameDuration;
                     } else if (key === 'language_toggle') {
                         currentValue = getLocalizedText(appState.settings.language); // e.g., "English" or "العربية"
                     } else if (formatValues.hasOwnProperty(settingKey)) {
                         currentValue = getLocalizedText(formatValues[settingKey] ? 'on' : 'off');
                     } else if (key === 'single_player_high_score_short') {
                        // For target mode HS display in SP game screen
                         currentValue = appState.stats.single_player_high_score;
                         text = getLocalizedText(key, currentValue); // Only one arg needed
                     } else if (key === 'single_player_high_score_tap') {
                        // For tap mode HS display in SP game screen
                        // Show the saved score for the currently selected duration, or '-' if none saved for this duration
                         currentValue = (appState.settings.gameDuration === appState.stats.sp_taps_in_duration_setting)
                                         ? appState.stats.sp_taps_in_duration : '-';
                         text = getLocalizedText(key, appState.settings.gameDuration, currentValue); // Two args needed
                     } else {
                        // Default case if no specific handling matches
                         text = getLocalizedText(key, '...');
                     }

                     // If text wasn't set specifically above, format it now
                     if (!text) {
                        text = getLocalizedText(key, currentValue);
                     }

                 } catch (e) {
                     console.error(`Error formatting text for key ${key}:`, e);
                     text = getLocalizedText(key, '...');
                 }
             }
        } else {
            // Simple text replacement
            text = getLocalizedText(key);
        }

        // Apply the text to the correct property based on element type
        if (element.tagName === 'INPUT' && element.placeholder) {
            element.placeholder = text;
        } else if (element.tagName === 'BUTTON' || element.classList.contains('custom-label') || element.classList.contains('game-button-label') || element.classList.contains('popup-title') || element.classList.contains('popup-body') || element.tagName === 'OPTION') {
            element.textContent = text;
        }
        // Could add more conditions for other element types if needed

        // Apply/remove Arabic font class
        const elementsToStyle = [element, ...element.querySelectorAll('.base-button, .custom-label, .popup-title, .popup-body, .game-button-label, .setting-select, option')];
        if (lang === 'arabic') {
            elementsToStyle.forEach(el => el.classList.add('arabic-font'));
        } else {
            elementsToStyle.forEach(el => el.classList.remove('arabic-font'));
        }
    });

    // Update elements that might not have data-i18n but need refreshing
    updateSettingsUI(); // Refresh settings display including slider label text
    updateMenuStats(); // Refresh stats on menu
    updateInstructionsPopupText(); // Refresh instructions text
    // Refresh specific screens if they are currently visible
    if (appState.currentScreen === 'log') updateLogScreen();
    if (appState.currentScreen === 'achievements') updateAchievementsScreen();
    // Update select dropdown arrow color (if implemented with JS)
    // updateSelectArrowColor();
}

/**
 * Updates the text content of the instructions popup.
 */
function updateInstructionsPopupText() {
    // Ensure elements exist before trying to update
    if (!consolidatedPopupElements.instructionsText || !consolidatedPopupElements.developerInfo) return;
    consolidatedPopupElements.instructionsText.textContent = getLocalizedText('game_instructions');
    const devInfoText = getLocalizedText('developer_info');
    const instaLink = 'https://www.instagram.com/youcef_0310?igsh=MW1oanlzbjFud2htNA=='; // Make sure this link is correct
    // Safely inject the link using innerHTML
    consolidatedPopupElements.developerInfo.innerHTML = devInfoText.replace('@youcef_0310', `<a href="${instaLink}" target="_blank" rel="noopener noreferrer" style="color: var(--accent1);">@youcef_0310</a>`);
}

/**
 * Initializes the Web Audio API context on first user interaction.
 */
function initAudioContext() {
    if (!appState.soundManager.audioContext) {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                appState.soundManager.audioContext = new AudioContext();

                // Attempt to resume context if suspended (often needed after page load)
                const resumeAudio = () => {
                    if (appState.soundManager.audioContext.state === 'suspended') {
                        appState.soundManager.audioContext.resume().catch(e => console.error("Failed to resume AudioContext:", e));
                    }
                    // Also try to start background music if it should be playing
                    if (appState.soundManager.backgroundMusic && appState.settings.musicEnabled && appState.soundManager.backgroundMusic.paused) {
                        try {
                            appState.soundManager.backgroundMusic.play().catch(e => console.error("Background music play failed on interaction:", e));
                        } catch (e) {
                            console.error("Error attempting to play background music:", e);
                        }
                    }
                    // Remove listeners after first interaction
                    document.body.removeEventListener('click', resumeAudio);
                    document.body.removeEventListener('touchstart', resumeAudio);
                };
                // Add listeners for the first user interaction
                document.body.addEventListener('click', resumeAudio, { once: true });
                document.body.addEventListener('touchstart', resumeAudio, { once: true });

            } else {
                console.warn("Web Audio API not supported by this browser.");
                appState.settings.soundEnabled = false; // Disable sound if API not supported
                appState.settings.musicEnabled = false;
            }
        } catch (e) {
            console.error("Error creating AudioContext:", e);
            appState.settings.soundEnabled = false;
            appState.settings.musicEnabled = false;
        }
    } else if (appState.soundManager.audioContext.state === 'suspended') {
        // If context exists but is suspended, try resuming
         appState.soundManager.audioContext.resume().catch(e => console.error("Failed to resume existing AudioContext:", e));
    }
}


/**
 * Loads a sound effect.
 * @param {string} soundName - The name of the sound file (without extension).
 * @returns {Promise<HTMLAudioElement>} A promise that resolves with the loaded Audio element.
 */
function loadSound(soundName) {
    return new Promise((resolve, reject) => {
        // Return cached sound if already loaded
        if (appState.soundManager.sounds[soundName]) {
            resolve(appState.soundManager.sounds[soundName]);
            return;
        }

        // Assuming sounds are in a 'sounds' folder relative to index.html
        const soundPath = `sounds/${soundName}.wav`; // Or .mp3, ensure format consistency
        try {
            const audio = new Audio();
            audio.src = soundPath;
            // Use 'canplaythrough' to ensure the sound is sufficiently buffered
            audio.addEventListener('canplaythrough', () => {
                appState.soundManager.sounds[soundName] = audio; // Cache the sound
                resolve(audio);
            }, { once: true });
            audio.addEventListener('error', (e) => {
                console.error(`Error loading sound: ${soundName}`, e);
                reject(new Error(`Failed to load sound: ${soundName}`));
            }, { once: true });
            audio.load(); // Start loading the audio file
        } catch (e) {
            console.error(`Exception loading sound ${soundName}:`, e);
            reject(e);
        }
    });
}


/**
 * Plays a loaded sound effect if sound is enabled.
 * @param {string} soundName - The name of the sound to play.
 */
async function playSound(soundName) {
    // Try to initialize audio context if needed (e.g., on first interaction)
    initAudioContext();

    if (!appState.soundManager.enabled || !appState.settings.soundEnabled || !appState.soundManager.audioContext) return;

    // Ensure the audio context is running
    if (appState.soundManager.audioContext.state !== 'running') {
       await appState.soundManager.audioContext.resume().catch(e => {
           console.error("Could not resume audio context to play sound.", e);
           return; // Don't try to play if resume failed
       });
       // Check state again after attempting resume
       if (appState.soundManager.audioContext.state !== 'running') return;
    }


    try {
        let sound = appState.soundManager.sounds[soundName];
        // If sound not cached, try loading it now
        if (!sound) {
            console.log(`Sound ${soundName} not preloaded, attempting to load now.`);
            sound = await loadSound(soundName).catch(e => {
                console.error(`Failed to load sound ${soundName} on demand:`, e);
                return null;
            });
        }

        if (sound) {
            sound.currentTime = 0; // Rewind to start
            await sound.play();
        }
    } catch (error) {
        // Ignore errors like "DOMException: The play() request was interrupted..."
        if (error.name !== 'AbortError') {
            console.error(`Error playing sound ${soundName}:`, error);
        }
    }
}


/**
 * Preloads common sound effects to reduce delay on first play.
 */
function preloadSounds() {
    // List of sounds to preload
    const soundsToPreload = ['click', 'win', 'start', 'target_hit', 'achievement'];
    soundsToPreload.forEach(soundName => {
        loadSound(soundName).catch(error => {
            console.warn(`Failed to preload sound: ${soundName}`, error);
        });
    });
}

/**
 * Triggers device vibration if enabled and supported.
 */
function vibrate() {
    if (!appState.settings.vibrationEnabled) return;

    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(VIBRATION_DURATION_MS);
        } catch (e) {
            // Vibration might be blocked by browser settings or capability
            // console.warn("Vibration failed:", e);
        }
    }
}

/**
 * Loads game state (settings, stats, log, achievements) from localStorage.
 */
function loadState() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data) {
            const parsedData = JSON.parse(data);

            // Define defaults to merge with loaded data, ensuring all keys exist
            const defaultSettings = {
                soundEnabled: true, musicEnabled: false, vibrationEnabled: true,
                gameDuration: DEFAULT_GAME_DURATION, difficulty: 'medium', theme: 'dark',
                language: 'english'
            };
            const defaultStats = {
                p1_wins: 0, p2_wins: 0, total_taps: 0,
                single_player_high_score: 0, sp_taps_in_duration: 0,
                sp_taps_in_duration_setting: DEFAULT_GAME_DURATION,
                consecutive_targets_hit: 0, // Reset on load, only tracks within a game
                games_played_sp_tap: 0, games_played_sp_target: 0,
                games_played_tp_tap: 0, games_played_tp_target: 0,
                // --- Initialize New Stats ---
                played_60s_game: false,
                used_dark_theme: false,
                used_light_theme: false
                // --------------------------
            };

            // Merge loaded data with defaults
            appState.settings = { ...defaultSettings, ...(parsedData.settings || {}) };
            appState.stats = { ...defaultStats, ...(parsedData.stats || {}) };
            appState.achievements = parsedData.achievements || {};
            appState.gameLog = Array.isArray(parsedData.gameLog) ? parsedData.gameLog : [];

            // Ensure numeric values are numbers, not strings
            appState.settings.gameDuration = parseInt(appState.settings.gameDuration, 10) || DEFAULT_GAME_DURATION;
            appState.stats.single_player_high_score = parseInt(appState.stats.single_player_high_score, 10) || 0;
            appState.stats.sp_taps_in_duration = parseInt(appState.stats.sp_taps_in_duration, 10) || 0;
            appState.stats.sp_taps_in_duration_setting = parseInt(appState.stats.sp_taps_in_duration_setting, 10) || DEFAULT_GAME_DURATION;
            appState.stats.p1_wins = parseInt(appState.stats.p1_wins, 10) || 0;
            appState.stats.p2_wins = parseInt(appState.stats.p2_wins, 10) || 0;
            appState.stats.total_taps = parseInt(appState.stats.total_taps, 10) || 0;
            appState.stats.games_played_sp_tap = parseInt(appState.stats.games_played_sp_tap, 10) || 0;
            appState.stats.games_played_sp_target = parseInt(appState.stats.games_played_sp_target, 10) || 0;
            appState.stats.games_played_tp_tap = parseInt(appState.stats.games_played_tp_tap, 10) || 0;
            appState.stats.games_played_tp_target = parseInt(appState.stats.games_played_tp_target, 10) || 0;
            // Ensure boolean stats are booleans
            appState.stats.played_60s_game = appState.stats.played_60s_game === true;
            appState.stats.used_dark_theme = appState.stats.used_dark_theme === true;
            appState.stats.used_light_theme = appState.stats.used_light_theme === true;

            // Reset transient stats like consecutive hits
            appState.stats.consecutive_targets_hit = 0;

            // Apply initial theme stat based on loaded setting
             // These flags should ideally be set only when the theme is *applied* via applyTheme
             // Initialize them based on the loaded theme setting
             if (appState.settings.theme === 'dark') appState.stats.used_dark_theme = true;
             if (appState.settings.theme === 'light') appState.stats.used_light_theme = true;


        } else {
            // No saved data found, initialize with defaults
             // Apply initial theme stat flags based on default theme ('dark')
             appState.stats.used_dark_theme = true;
             saveState(); // Save the initial default state
        }
    } catch (e) {
        console.error("Error loading state from localStorage:", e);
        // Fallback to default state if loading fails
        appState.settings = {
            soundEnabled: true, musicEnabled: false, vibrationEnabled: true,
            gameDuration: DEFAULT_GAME_DURATION, difficulty: 'medium', theme: 'dark',
            language: 'english'
        };
        appState.stats = {
             p1_wins: 0, p2_wins: 0, total_taps: 0,
             single_player_high_score: 0, sp_taps_in_duration: 0,
             sp_taps_in_duration_setting: DEFAULT_GAME_DURATION,
             consecutive_targets_hit: 0,
             games_played_sp_tap: 0, games_played_sp_target: 0,
             games_played_tp_tap: 0, games_played_tp_target: 0,
             played_60s_game: false, used_dark_theme: true, used_light_theme: false // Default theme is dark
        };
        appState.achievements = {};
        appState.gameLog = [];
    }

    // Apply loaded settings
    appState.soundManager.enabled = appState.settings.soundEnabled;
    applyTheme(appState.settings.theme); // This will also set theme flags correctly now
    // Assign the background music element after DOM load
    appState.soundManager.backgroundMusic = backgroundMusicElement; // Assuming backgroundMusicElement is assigned later
    updateMusicState();
}


/**
 * Saves the current game state to localStorage.
 */
function saveState() {
    try {
        // Trim game log if it exceeds the maximum length
        if (appState.gameLog.length > MAX_LOG_ENTRIES) {
            appState.gameLog = appState.gameLog.slice(appState.gameLog.length - MAX_LOG_ENTRIES);
        }

        const dataToSave = {
            settings: appState.settings,
            stats: appState.stats,
            achievements: appState.achievements,
            gameLog: appState.gameLog
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
        // console.log("State saved."); // Optional: for debugging
    } catch (e) {
        console.error("Error saving state to localStorage:", e);
        // Consider informing the user if storage is critical and failing
    }
}

/**
 * Adds a new entry to the game log and saves the state.
 * @param {object} entry - The log entry object.
 */
function addLogEntry(entry) {
    appState.gameLog.unshift(entry); // Add to the beginning of the array
    saveState(); // Save state after adding log entry
}


/**
 * Updates the UI elements on the settings screen to reflect current settings.
 */
function updateSettingsUI() {
    // Ensure controls references are valid
     if (!settingsControls || !settingsControls.soundToggle) {
         // console.warn("Settings controls not yet initialized.");
         return;
     }

    try {
        const { soundEnabled, musicEnabled, vibrationEnabled, gameDuration, difficulty, theme, language } = appState.settings;

        // Update toggle buttons text and appearance
        settingsControls.soundToggle.textContent = getLocalizedText('sound_toggle', getLocalizedText(soundEnabled ? 'on' : 'off'));
        settingsControls.soundToggle.style.backgroundColor = `var(--${soundEnabled ? 'accent3' : 'gray-color'})`;

        settingsControls.musicToggle.textContent = getLocalizedText('music_toggle', getLocalizedText(musicEnabled ? 'on' : 'off'));
        settingsControls.musicToggle.style.backgroundColor = `var(--${musicEnabled ? 'accent3' : 'gray-color'})`;

        settingsControls.vibrationToggle.textContent = getLocalizedText('vibration_toggle', getLocalizedText(vibrationEnabled ? 'on' : 'off'));
        settingsControls.vibrationToggle.style.backgroundColor = `var(--${vibrationEnabled ? 'accent3' : 'gray-color'})`;

        // Update duration slider and label
        settingsControls.durationLabel.textContent = getLocalizedText('game_duration_label', gameDuration);
        settingsControls.durationSlider.value = gameDuration;

        // Update difficulty dropdown
        settingsControls.difficultySelect.value = difficulty;

        // Update theme dropdown
        settingsControls.themeSelect.value = theme;

        // Update language toggle button
        settingsControls.languageToggle.textContent = getLocalizedText('language_toggle', getLocalizedText(language)); // Shows "English" or "العربية"
        settingsControls.languageToggle.style.backgroundColor = 'var(--accent4)'; // Consistent color

        // Apply/remove general arabic font class if needed (though updateAllTexts handles specifics)
        document.querySelectorAll('.arabic-font-toggle').forEach(el => {
            if (language === 'arabic') el.classList.add('arabic-font');
            else el.classList.remove('arabic-font');
        });

    } catch (e) {
        console.error("Error updating settings UI:", e);
    }
}

/**
 * Handles changes to a specific setting.
 * @param {string} key - The key of the setting being changed (e.g., 'soundEnabled').
 * @param {any} value - The new value for the setting.
 */
function handleSettingChange(key, value) {
    const oldValue = appState.settings[key];
    if (oldValue === value) return; // No change

    appState.settings[key] = value;

    // Perform actions based on the changed setting
    if (key === 'soundEnabled') {
        appState.soundManager.enabled = value;
        if (value) playSound('click'); // Play sound feedback when enabling
    } else if (key === 'musicEnabled') {
        updateMusicState(); // Play/pause background music
        if (value) playSound('click'); // Play sound feedback when enabling
    } else if (key === 'vibrationEnabled') {
        if (value) vibrate(); // Vibrate feedback when enabling
    } else if (key === 'theme') {
        applyTheme(value); // This will also update theme usage stats
        playSound('click');
        // updateSelectArrowColor(); // Update dropdown arrow if needed
    } else if (key === 'language') {
        updateAllTexts(); // Update all UI text immediately
        // No sound feedback for language change as UI refreshes
    } else if (key === 'gameDuration') {
         // Reset tap mode high score *display* if duration changes from the one saved
         // The actual saved HS remains until a new score beats it at the new duration
         // updateMenuStats(); // Update display on menu if visible
         if (appState.currentScreen === 'game' && appState.currentGameMode === 'tap') {
            // If currently in SP tap game, update the HS label immediately
             const currentTapHS = (parseInt(value, 10) === appState.stats.sp_taps_in_duration_setting)
                                    ? appState.stats.sp_taps_in_duration : '-';
             singlePlayerElements.highScoreLabel.textContent = getLocalizedText('single_player_high_score_tap', value, currentTapHS);
         }
         playSound('click');
    } else {
        // Default sound feedback for other settings (e.g., difficulty)
        playSound('click');
    }

    // Update the settings screen UI elements
    updateSettingsUI();
    // Save the changed state
    saveState();
    // Check achievements immediately after changing settings (e.g., for theme change)
    checkAchievements(true);
}

/**
 * Applies the selected theme (dark/light) to the body element and updates stats.
 * @param {string} themeName - 'dark' or 'light'.
 */
function applyTheme(themeName) {
    if (!bodyElement) return; // Ensure body element is available
    bodyElement.className = `theme-${themeName}`; // Remove previous theme classes and add new one

    // Update theme usage stats for achievements
    if (themeName === 'dark') {
        appState.stats.used_dark_theme = true;
    } else if (themeName === 'light') {
        appState.stats.used_light_theme = true;
    }
    // Don't save state here directly, let handleSettingChange do it or checkAchievements
    // updateSelectArrowColor(); // Update dropdown arrow color if needed
}

/**
 * Plays or pauses the background music based on settings and audio context state.
 */
function updateMusicState() {
    const music = appState.soundManager.backgroundMusic;
    if (!music) {
        // console.warn("Background music element not available.");
        return;
    }

    try {
        // Play only if music is enabled AND audio context is running
        if (appState.settings.musicEnabled && appState.soundManager.audioContext?.state === 'running') {
            // Check if already playing to avoid interrupting
            if (music.paused) {
                 music.play().catch(e => console.error("Error playing background music:", e));
            }
        } else {
             // Pause if music disabled or audio context not running/suspended
             if (!music.paused) {
                music.pause();
             }
        }
    } catch (e) {
        console.error("Exception managing music state:", e);
    }
}

/**
 * Shows a specific screen and hides the others, with optional transition.
 * @param {string} screenName - The key of the screen to show (e.g., 'menu', 'game').
 * @param {string} [transitionType='fade'] - The type of transition ('fade', 'slide-left', 'slide-right', 'none').
 */
function showScreen(screenName, transitionType = 'fade') {
    const newScreen = screens[screenName];
    if (!newScreen) {
        console.error(`Screen "${screenName}" not found.`);
        return;
    }

    const oldScreen = screens[appState.currentScreen];

    // Avoid transitioning to the same screen
    if (oldScreen === newScreen && newScreen.classList.contains('active')) return;

    const transitionPrefix = transitionType.startsWith('slide') ? 'slide' : 'fade';
    const directionClass = transitionType.includes('-') ? transitionType : ''; // e.g., slide-left
    const transitionDuration = (transitionType === 'none' || !oldScreen) ? 0 : 300; // CSS transition duration ms

    // Prepare new screen
    newScreen.style.zIndex = '1'; // Bring new screen temporarily above
    newScreen.classList.add('active');

    // Start transition classes
    if (transitionDuration > 0 && oldScreen) {
        oldScreen.classList.add(`${transitionPrefix}-exit`);
        newScreen.classList.add(`${transitionPrefix}-enter`, directionClass); // Add direction if slide

        // Force reflow before adding active transition classes
        requestAnimationFrame(() => {
             requestAnimationFrame(() => {
                oldScreen.classList.add(`${transitionPrefix}-exit-active`);
                newScreen.classList.add(`${transitionPrefix}-enter-active`, directionClass ? `${directionClass}-active` : ''); // Add direction active if slide
             });
        });
    } else {
         // No transition or no old screen, just make it active
         newScreen.classList.add('active');
    }


    // Clean up after transition
    setTimeout(() => {
        if (oldScreen) {
            oldScreen.classList.remove('active', `${transitionPrefix}-exit`, `${transitionPrefix}-exit-active`);
            // Clean up potential lingering direction classes (safer)
             oldScreen.classList.remove('slide-left', 'slide-right', 'slide-left-active', 'slide-right-active');
        }
        newScreen.classList.remove(`${transitionPrefix}-enter`, `${transitionPrefix}-enter-active`);
        newScreen.classList.remove('slide-left', 'slide-right', 'slide-left-active', 'slide-right-active'); // Clean up direction
        newScreen.style.zIndex = ''; // Reset z-index

        appState.currentScreen = screenName;

        // Call screen-specific entry function if it exists (e.g., onEnter_game)
        const entryFunctionName = `onEnter_${screenName}`;
        if (typeof window[entryFunctionName] === 'function') {
            window[entryFunctionName]();
        }

    }, transitionDuration);

    // Play sound feedback for screen changes, except initial load or returning to menu from game/settings
    if (transitionType !== 'none' && !(screenName === 'menu' && oldScreen && oldScreen !== screens.menu)) {
       // Play sound slightly delayed to match visual transition start
       setTimeout(() => playSound('click'), 50);
    }
}

/**
 * Shows a popup overlay.
 * @param {string} popupId - The key of the popup to show (e.g., 'instructions', 'gameOver').
 */
function showPopup(popupId) {
    const popup = popups[popupId];
    if (popup && !appState.activePopups.includes(popupId)) {
        appState.activePopups.push(popupId); // Add to stack
        popup.style.display = 'flex'; // Make it visible

        // Trigger transition
        requestAnimationFrame(() => {
            popup.classList.add('active');
        });

        // Play sound feedback (except for achievement unlocked popup)
        if (popupId !== 'achievement') {
            playSound('click');
        }

        // Special handling for popups that need text updates on show
        if (popupId === 'instructions') {
            updateInstructionsPopupText();
        }
        if (popupId === 'confirmQuit') {
             // Ensure elements exist before setting text
             const body = popup.querySelector('.popup-body');
             const yesButton = consolidatedPopupElements.confirmQuitYes;
             const noButton = popup.querySelector('.popup-close-button'); // Find 'No' button inside this popup
             if (body) body.textContent = getLocalizedText('quit_confirm');
             if (yesButton) yesButton.textContent = getLocalizedText('yes');
             if (noButton) noButton.textContent = getLocalizedText('no');
        }
        if (popupId === 'modeSelect') {
            if(consolidatedPopupElements.modeSelectTitle) consolidatedPopupElements.modeSelectTitle.textContent = getLocalizedText('select_mode');
            if(consolidatedPopupElements.modeSelectTap) consolidatedPopupElements.modeSelectTap.textContent = getLocalizedText('tap_mode_select');
            if(consolidatedPopupElements.modeSelectTarget) consolidatedPopupElements.modeSelectTarget.textContent = getLocalizedText('target_mode_select');
            const cancelButton = popup.querySelector('.popup-close-button'); // Find Cancel button
            if (cancelButton) cancelButton.textContent = getLocalizedText('cancel');
        }
    }
}


/**
 * Hides a specific popup overlay.
 * @param {string} popupId - The key of the popup to hide.
 */
function hidePopup(popupId) {
    const popup = popups[popupId];
    if (popup) {
        popup.classList.remove('active'); // Start transition out

        // Remove from active stack
        const index = appState.activePopups.indexOf(popupId);
        if (index > -1) {
            appState.activePopups.splice(index, 1);
        }

        // Set display to none after transition completes
        setTimeout(() => {
            // Check if still meant to be hidden (user might have quickly reopened)
             if (!popup.classList.contains('active')) {
                popup.style.display = 'none';
             }
        }, 300); // Match CSS transition duration
    }
}

/**
 * Hides the topmost active popup.
 */
function hideTopPopup() {
    if (appState.activePopups.length > 0) {
        const topPopupId = appState.activePopups[appState.activePopups.length - 1];
        // Special handling if closing the quit confirm implicitly means "No"
        if (topPopupId === 'confirmQuit') {
             handleQuitConfirm(false); // Explicitly handle as "No" before hiding
        } else {
            hidePopup(topPopupId); // Hide normally
        }
    }
}


/**
 * Placeholder for button press animation (now handled by CSS :active).
 * Plays sound and vibrates.
 * @param {HTMLElement} button - The button element.
 */
function animatePress(button) {
    playSound('click');
    vibrate();
    // Visual feedback primarily handled by .base-button:not(:disabled):active in CSS
}

/**
 * Animates a button to indicate a win.
 * @param {HTMLElement} button - The button element to animate.
 */
function animateWin(button) {
    if (!button) return;
    playSound('win');
    vibrate();
    // Use CSS animation defined in style.css
    const originalColor = window.getComputedStyle(button).backgroundColor;
    // Store original color in a custom property for the animation to use
    button.style.setProperty('--original-color', originalColor);
    button.classList.add('win-flash');
    // Remove the class after animation completes
    setTimeout(() => {
        // Check if button still exists before removing class/property
        if (document.body.contains(button)) {
            button.classList.remove('win-flash');
            button.style.removeProperty('--original-color'); // Clean up custom property
        }
    }, 600); // Match CSS animation duration
}

/**
 * Visually enables or disables a button.
 * @param {HTMLElement} button - The button element.
 * @param {boolean} [enable=true] - True to enable, false to disable.
 */
function animateEnableDisable(button, enable = true) {
    if (!button) return;
    try {
        button.disabled = !enable;
        // Opacity and pointer events are handled by .base-button:disabled in CSS
    } catch (e) {
        console.error("Error enabling/disabling button:", e, button);
    }
}

/**
 * Creates a ripple effect animation at the click/tap coordinates.
 * @param {number} x - The clientX coordinate of the event.
 * @param {number} y - The clientY coordinate of the event.
 * @param {HTMLElement} parentElement - The element where the click occurred (to append the ripple).
 */
function playClickEffect(x, y, parentElement) {
    if (!parentElement) return;

    // Create the ripple span
    const ripple = document.createElement("span");
    ripple.classList.add("ripple");

    // Calculate position relative to the parent element
    const rect = parentElement.getBoundingClientRect();
    const relativeX = x - rect.left;
    const relativeY = y - rect.top;

    // Size the ripple (adjust size as needed)
    const size = Math.max(parentElement.clientWidth, parentElement.clientHeight) / 5;
    ripple.style.width = ripple.style.height = `${size}px`;

    // Position the ripple's center at the click point
    ripple.style.left = `${relativeX - size / 2}px`;
    ripple.style.top = `${relativeY - size / 2}px`;


    // Append and remove after animation
    parentElement.appendChild(ripple);
    ripple.addEventListener('animationend', () => {
        try {
             // Check if the ripple is still a child before removing
             if (ripple.parentNode === parentElement) {
                parentElement.removeChild(ripple);
             }
        } catch (e) {} // Ignore errors if element is already gone
    });
}

/**
 * Attempts to request fullscreen mode.
 */
function requestFullScreen() {
    const element = document.documentElement; // Request fullscreen for the whole page
    try {
        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => { /* console.warn(`Fullscreen request failed: ${err.message}`) */ });
        } else if (element.mozRequestFullScreen) { /* Firefox */
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) { /* IE/Edge */
            element.msRequestFullscreen();
        }
    } catch (e) {
        // console.warn("Fullscreen API error:", e);
    }
}

/**
 * Sets up listeners to trigger fullscreen on the first user interaction (touch or click).
 */
function triggerFullscreenOnFirstInteraction() {
    const requestOnce = () => {
        requestFullScreen();
        // Remove both listeners after the first interaction
        document.body.removeEventListener('touchend', requestOnce);
        document.body.removeEventListener('click', requestOnce);
    };
    document.body.addEventListener('touchend', requestOnce, { once: true });
    document.body.addEventListener('click', requestOnce, { once: true });
}
// --- Game Variables ---
let singlePlayerCount = 0;
let singlePlayerGameActive = false;
let spGameTimerId = null; // Interval ID for single player timer
let spTimeLeft = 0;
// spTapModeHighScore is stored in appState.stats.sp_taps_in_duration

let p1Count = 0;
let p2Count = 0;
let tpTimeLeft = DEFAULT_GAME_DURATION;
let tpGameTimerId = null; // Interval ID for two player timer
let isTwoPlayerGameActive = false;
let twoPlayerQuitConfirmationCallback = null; // Function to call if user confirms quit
let p1Name = 'P1'; // Default name, potentially updated
let p2Name = 'P2'; // Default name, potentially updated

// --- Menu & Mode Selection ---

/**
 * Updates the statistics displayed on the main menu.
 */
function updateMenuStats() {
     // Ensure menuStatsLabel is valid
     if (!menuStatsLabel) return;

    const stats = appState.stats;
    let statsText = "";

    // Target Mode High Score
    statsText += getLocalizedText('single_player_high_score', stats.single_player_high_score) + "\n";

    // Tap Mode High Score (showing associated duration)
    statsText += getLocalizedText('single_player_high_score_tap', stats.sp_taps_in_duration_setting, stats.sp_taps_in_duration) + "\n";

    // Two Player Win Rate
    const totalGames = stats.p1_wins + stats.p2_wins;
    const winRate = totalGames > 0 ? Math.round((stats.p1_wins / totalGames) * 100) : 0;
    statsText += getLocalizedText('log_win_rate', winRate) + ` (${getLocalizedText('log_total_games', totalGames)})` + "\n";

    // Total Taps/Targets
    statsText += getLocalizedText('total_taps', stats.total_taps);

    menuStatsLabel.textContent = statsText;
}

/**
 * Function called when entering the menu screen.
 */
function onEnter_menu() {
    updateMenuStats();
    updateAllTexts(); // Ensure all menu text is correctly localized
    // Any other menu-specific setup
    // Ensure background music state is correct when returning to menu
     updateMusicState();
}

/**
 * Initiates the game mode selection process. Shows the mode select popup.
 * @param {string} playerMode - 'single' or 'two'.
 */
function selectGameMode(playerMode) {
    appState.currentPlayerMode = playerMode;

    // Optional: Prompt for names in two-player mode
    if (playerMode === 'two') {
        try {
            // Use current names as defaults in prompt
            const p1Prompt = getLocalizedText('player1') + " Name:";
            const p2Prompt = getLocalizedText('player2') + " Name:";
            // Provide current names as default values in the prompt
            const newP1Name = prompt(p1Prompt, p1Name);
            const newP2Name = prompt(p2Prompt, p2Name);
             // Update names only if user provides non-empty input, otherwise keep defaults/previous
             if (newP1Name !== null && newP1Name.trim() !== '') p1Name = newP1Name.trim();
             if (newP2Name !== null && newP2Name.trim() !== '') p2Name = newP2Name.trim();
        } catch(e){
            console.warn("Prompt for names failed or was cancelled.", e);
            // Keep default/previous names if prompt fails
             p1Name = p1Name || getLocalizedText('player1');
             p2Name = p2Name || getLocalizedText('player2');
        }
    }

    // Show the mode selection popup
    showPopup('modeSelect');
}

/**
 * Starts the game after a mode (tap/target) has been selected from the popup.
 * @param {string} gameMode - 'tap' or 'target'.
 */
function startGameWithMode(gameMode) {
    hidePopup('modeSelect');
    appState.currentGameMode = gameMode;

    if (appState.currentPlayerMode === 'single') {
        showScreen('game', 'slide-left'); // Transition to single player screen
    } else if (appState.currentPlayerMode === 'two') {
        showScreen('two_player', 'slide-left'); // Transition to two player screen
    }
}
// --- Target Creation ---

/**
 * Creates and displays a target element in the specified player's area.
 * @param {object} playerElements - The object containing references for the player (e.g., singlePlayerElements or twoPlayerElements.p1).
 * @param {HTMLElement} areaElement - The container element where the target should appear.
 * @param {number} targetSize - The base size of the target (adjusted by difficulty).
 */
function createTargetElement(playerElements, areaElement, targetSize) {
    // Remove previous target if it exists
    if (playerElements.currentTarget) {
         try { playerElements.currentTarget.remove(); } catch(e){}
         playerElements.currentTarget = null; // Clear reference
    }

    // Check if area element still exists
     if (!areaElement || !document.body.contains(areaElement)) {
        // console.warn("Target area element no longer exists. Cannot create target.");
        return;
     }


    const difficulty = appState.settings.difficulty;
    let sizeMultiplier = 1.0;
    if (difficulty === 'easy') sizeMultiplier = 1.2;
    else if (difficulty === 'hard') sizeMultiplier = 0.8;

    let adjustedSize = Math.max(40, targetSize * sizeMultiplier); // Ensure minimum size

    const target = document.createElement('div');
    target.className = 'target-element';
    // Add click listener (will delegate to handleTargetClick)
    target.addEventListener('click', handleTargetClick);
    // Add touch listener for mobile (prevents default to avoid issues, calls same handler)
    target.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent potential ghost clicks or scrolling
        handleTargetClick(e);
    }, { passive: false }); // Need passive: false to allow preventDefault

    target.textContent = getLocalizedText('tap_here'); // Or maybe an icon?
    target.style.width = `${adjustedSize}px`;
    target.style.height = `${adjustedSize}px`;
     // Adjust font size based on target size for better fit
     target.style.fontSize = `${Math.max(10, adjustedSize * 0.16)}px`;


    // Position the target randomly within the bounds of the areaElement
    const areaRect = areaElement.getBoundingClientRect();
    // Ensure we don't position outside bounds, account for target size
    // Use offsetWidth/Height which includes padding but not border/margin
    const availableWidth = areaElement.offsetWidth;
    const availableHeight = areaElement.offsetHeight;

    const maxX = Math.max(0, availableWidth - adjustedSize - 10); // Add small padding
    const maxY = Math.max(0, availableHeight - adjustedSize - 10); // Add small padding

    // Ensure random values are within the calculated max range
    const randomX = Math.min(maxX, Math.random() * maxX) + 5; // Add small padding offset
    const randomY = Math.min(maxY, Math.random() * maxY) + 5; // Add small padding offset


    target.style.left = `${randomX}px`;
    target.style.top = `${randomY}px`;

    areaElement.appendChild(target);
    playerElements.currentTarget = target; // Store reference to the current target
}

// --- Countdown Timer ---

/**
 * Displays a 3-2-1-GO countdown overlay before starting the game logic.
 * @param {function} callback - The function to execute after the countdown finishes.
 */
function startCountdown(callback) {
    const overlay = popups.countdown;
    const textElement = consolidatedPopupElements.countdownText;
    if (!overlay || !textElement) {
        console.error("Countdown overlay elements not found.");
        if (typeof callback === 'function') callback(); // Proceed without countdown if elements missing
        return;
    }

    let count = 3;
    textElement.textContent = count;
    playSound('click'); // Sound for '3'
    showPopup('countdown'); // Show the overlay

    const intervalId = setInterval(() => {
        // Check if countdown overlay is still active before proceeding
        if (!popups.countdown || !popups.countdown.classList.contains('active')) {
            clearInterval(intervalId);
            return;
        }

        count--;
        if (count > 0) {
            textElement.textContent = count;
            playSound('click'); // Sound for '2', '1'
        } else if (count === 0) {
            textElement.textContent = getLocalizedText('go');
            playSound('start'); // Sound for 'GO!'
        } else {
            // Countdown finished
            clearInterval(intervalId);
            hidePopup('countdown'); // Hide the overlay
            if (typeof callback === 'function') {
                callback(); // Execute the post-countdown logic
            }
        }
    }, 800); // Interval duration (adjust timing as needed)
}

// --- Generic Target Click Handler ---

/**
 * Handles clicks or taps on target elements in both single and two-player modes.
 * @param {Event} event - The click or touchstart event.
 */
function handleTargetClick(event) {
     // Ensure the game mode requires targets
     if (appState.currentGameMode !== 'target') return;

    const target = event.currentTarget;
    const playerArea = target.closest('.player-area'); // Find the parent player area

    if (!playerArea) {
        console.warn("Target clicked outside a player area?");
        return; // Should not happen if targets are correctly placed
    }

    // Get click/tap coordinates for ripple effect
    let clickX, clickY;
    if (event.type === 'touchstart') {
        // Use the first touch point
        if (!event.touches || event.touches.length === 0) return; // No touch data
        clickX = event.touches[0].clientX;
        clickY = event.touches[0].clientY;
    } else {
        clickX = event.clientX;
        clickY = event.clientY;
    }

    // Provide feedback
    playClickEffect(clickX, clickY, playerArea);
    vibrate();
    playSound('target_hit');

    // Update general stats
    appState.stats.total_taps++;

    // --- Single Player Target Mode Logic ---
    if (appState.currentPlayerMode === 'single') {
        if (!singlePlayerGameActive || spTimeLeft <= 0) return; // Game must be active and time remaining

        // Increment consecutive hits *before* potentially starting timer
        appState.stats.consecutive_targets_hit++;

        // Start timer on the very first successful target hit if not already started
        if (spGameTimerId === null && spTimeLeft > 0) {
            startSinglePlayerTimer();
        }

        singlePlayerCount++;
        singlePlayerElements.scoreLabel.textContent = singlePlayerCount.toString();

        // Create the next target immediately
        createTargetElement(singlePlayerElements, singlePlayerElements.targetArea, TARGET_SIZE_SP);
    }
    // --- Two Player Target Mode Logic ---
    else if (appState.currentPlayerMode === 'two') {
        if (!isTwoPlayerGameActive || tpTimeLeft <= 0) return; // Game must be active and time remaining

        // Increment consecutive hits (can be tracked per player if needed, but global for now)
        // Note: TP streak achievements might be complex, using SP streak for now.
         // appState.stats.consecutive_targets_hit++; // Using SP streak for now

        // Determine which player's target was hit
        if (playerArea.classList.contains('player1')) {
            p1Count++;
            twoPlayerElements.p1.scoreLabel.textContent = p1Count.toString();
            // Create next target for player 1
            createTargetElement(twoPlayerElements.p1, twoPlayerElements.p1.area, TARGET_SIZE_TP);
        } else if (playerArea.classList.contains('player2')) {
            p2Count++;
            twoPlayerElements.p2.scoreLabel.textContent = p2Count.toString();
            // Create next target for player 2
            createTargetElement(twoPlayerElements.p2, twoPlayerElements.p2.area, TARGET_SIZE_TP);
        }
    }

    // Check if any achievements were unlocked by this action
    // Pass lastGameResult as null since this isn't the end of a game
    checkAchievements(false, null);
}
// --- Single Player Logic ---

/**
 * Resets the state and UI for the single player game screen.
 */
function resetSinglePlayerState() {
    // Stop existing timer if any
    if (spGameTimerId) {
        clearInterval(spGameTimerId);
        spGameTimerId = null;
    }
    singlePlayerGameActive = false;
    singlePlayerCount = 0;
    spTimeLeft = appState.settings.gameDuration; // Reset timer to current setting
    appState.stats.consecutive_targets_hit = 0; // Reset streak counter for the new game

    // Reset score display
    if (singlePlayerElements.scoreLabel) {
        singlePlayerElements.scoreLabel.textContent = '0';
    }

    // Update High Score Label based on current game mode and duration
    if (singlePlayerElements.highScoreLabel) {
        let hsLabelKey = '';
        let currentHS = 0;
        if (appState.currentGameMode === 'tap') {
            hsLabelKey = 'single_player_high_score_tap';
            currentHS = (appState.settings.gameDuration === appState.stats.sp_taps_in_duration_setting)
                        ? appState.stats.sp_taps_in_duration : '-';
            singlePlayerElements.highScoreLabel.textContent = getLocalizedText(hsLabelKey, appState.settings.gameDuration, currentHS);
        } else { // Target mode
            hsLabelKey = 'single_player_high_score_short';
            currentHS = appState.stats.single_player_high_score;
            singlePlayerElements.highScoreLabel.textContent = getLocalizedText(hsLabelKey, currentHS);
        }
        singlePlayerElements.highScoreLabel.style.color = 'var(--text-color-secondary)'; // Reset color in case it was highlighted
    }


    // Reset timer display
    if (singlePlayerElements.timerLabel) {
        singlePlayerElements.timerLabel.textContent = spTimeLeft;
        singlePlayerElements.timerLabel.classList.remove('low-time', 'pulsing'); // Remove low time indicators
    }

    // Remove any existing target
    if (singlePlayerElements.currentTarget) {
        try { singlePlayerElements.currentTarget.remove(); } catch (e) {}
        singlePlayerElements.currentTarget = null;
    }

    // Reset tap button appearance and state
    if (singlePlayerElements.tapButton) {
        singlePlayerElements.tapButton.style.transform = 'scale(1)';
        singlePlayerElements.tapButton.style.filter = 'brightness(1)';
        animateEnableDisable(singlePlayerElements.tapButton, false); // Disable initially
    }

    // Ensure back button is enabled
    if (singlePlayerElements.backButton) {
        animateEnableDisable(singlePlayerElements.backButton, true);
    }
}

/**
 * Function called when entering the single player game screen. Sets up the mode.
 */
function onEnter_game() {
    // Ensure elements exist
    if (!singlePlayerElements.screen) return;

    // Set the correct class on the game screen container for CSS rules
    singlePlayerElements.screen.classList.remove('tap-mode', 'target-mode');
    singlePlayerElements.screen.classList.add(`${appState.currentGameMode}-mode`);

    resetSinglePlayerState(); // Reset score, timer, UI elements

    // Update button texts
    if (singlePlayerElements.backButton) singlePlayerElements.backButton.textContent = getLocalizedText('back_to_menu');
    if (singlePlayerElements.tapButton) {
        const label = singlePlayerElements.tapButton.querySelector('.game-button-label');
        if(label) label.textContent = getLocalizedText('tap_here');
    }

    singlePlayerGameActive = true; // Mark game as potentially active

    // Start game flow based on mode
    if (appState.currentGameMode === 'target') {
        // For target mode, timer starts on first hit. Create first target after countdown.
        startCountdown(() => {
             if(singlePlayerGameActive) { // Check if still active (user might have gone back during countdown)
                 createTargetElement(singlePlayerElements, singlePlayerElements.targetArea, TARGET_SIZE_SP);
             }
        });
    } else {
        // For tap mode, enable the button and start the timer immediately after countdown
        startCountdown(() => {
             if(singlePlayerGameActive) {
                animateEnableDisable(singlePlayerElements.tapButton, true);
                startSinglePlayerTimer(); // Start timer after countdown finishes
             }
        });
    }
}


/**
 * Starts the single player game timer interval.
 */
function startSinglePlayerTimer() {
    if (spGameTimerId) return; // Prevent multiple timers
    if (!singlePlayerElements.timerLabel) return; // Ensure element exists

    spTimeLeft = appState.settings.gameDuration; // Ensure timer starts from correct duration
    singlePlayerElements.timerLabel.textContent = spTimeLeft;
    singlePlayerElements.timerLabel.classList.remove('low-time', 'pulsing');

    spGameTimerId = setInterval(() => {
        if (!singlePlayerGameActive) { // Stop timer if game becomes inactive
             clearInterval(spGameTimerId);
             spGameTimerId = null;
             return;
        }

        spTimeLeft--;
        singlePlayerElements.timerLabel.textContent = spTimeLeft;

        // Visual feedback for low time
        if (spTimeLeft <= 5 && spTimeLeft > 0) {
            singlePlayerElements.timerLabel.classList.add('low-time');
             if (!singlePlayerElements.timerLabel.classList.contains('pulsing')) { // Prevent sound spamming
                 playSound('click'); // Play tick sound for low time
                 singlePlayerElements.timerLabel.classList.add('pulsing'); // Mark as pulsing
             }
        } else {
            singlePlayerElements.timerLabel.classList.remove('low-time', 'pulsing');
        }

        // End game when time runs out
        if (spTimeLeft <= 0) {
            endSinglePlayerGame();
        }
    }, 1000); // Update every second
}

/**
 * Ends the single player game, updates stats, logs result, checks achievements.
 */
function endSinglePlayerGame() {
    if (!singlePlayerGameActive) return; // Avoid ending multiple times

    // Stop timer
    if (spGameTimerId) {
        clearInterval(spGameTimerId);
        spGameTimerId = null;
    }
    singlePlayerGameActive = false;

    // Update UI
    if (singlePlayerElements.backButton) animateEnableDisable(singlePlayerElements.backButton, true); // Ensure back button is usable
    if (singlePlayerElements.currentTarget) { // Remove final target if exists
        try { singlePlayerElements.currentTarget.remove(); } catch (e) {}
        singlePlayerElements.currentTarget = null;
    }
    if (singlePlayerElements.tapButton) animateEnableDisable(singlePlayerElements.tapButton, false); // Disable tap button
    if (singlePlayerElements.timerLabel) {
        singlePlayerElements.timerLabel.textContent = getLocalizedText('time_up');
        singlePlayerElements.timerLabel.classList.add('low-time'); // Keep low-time style
    }

    // Determine game type and update stats/high scores
    let gameTypeKey = '';
    let isNewHighScore = false;
    let score = singlePlayerCount;
    const duration = appState.settings.gameDuration; // Capture duration at game end
    const mode = appState.currentGameMode; // Capture mode at game end

    // Store result details for potential sharing and achievements
    appState.lastGameResult = { spScore: score, duration: duration, mode: mode };

    if (mode === 'target') {
        gameTypeKey = 'sp_target';
        appState.stats.games_played_sp_target++;
        if (score > appState.stats.single_player_high_score) {
            appState.stats.single_player_high_score = score;
            isNewHighScore = true;
        }
        // Update label immediately
        if (singlePlayerElements.highScoreLabel) {
            singlePlayerElements.highScoreLabel.textContent = getLocalizedText('single_player_high_score_short', appState.stats.single_player_high_score);
        }
    } else { // Tap mode
        gameTypeKey = 'sp_tap';
        appState.stats.games_played_sp_tap++;
        // Check if the game duration matches the duration for the saved tap HS
        if (duration === appState.stats.sp_taps_in_duration_setting) {
             if (score > appState.stats.sp_taps_in_duration) {
                 appState.stats.sp_taps_in_duration = score;
                 isNewHighScore = true;
             }
        } else {
            // If duration is different, only update if score is higher than *any* previously saved tap score
            // And update the associated duration.
            if (score > appState.stats.sp_taps_in_duration) {
                 appState.stats.sp_taps_in_duration = score;
                 appState.stats.sp_taps_in_duration_setting = duration;
                 isNewHighScore = true; // Consider it a new HS for this setting
            }
        }
        // Update label immediately
        if (singlePlayerElements.highScoreLabel) {
            const displayHS = (duration === appState.stats.sp_taps_in_duration_setting) ? appState.stats.sp_taps_in_duration : '-';
            singlePlayerElements.highScoreLabel.textContent = getLocalizedText('single_player_high_score_tap', duration, displayHS);
        }
    }

    // Check for 60s game completion achievement
    if (duration === 60) {
        appState.stats.played_60s_game = true;
    }

    // Log the game result
    const logEntry = {
        type: 'sp',
        mode: mode,
        score: score,
        duration: duration,
        timestamp: new Date().toISOString()
    };
    addLogEntry(logEntry); // This also calls saveState

    // Visual feedback for new high score
    if (isNewHighScore && singlePlayerElements.highScoreLabel) {
        singlePlayerElements.highScoreLabel.style.transition = 'none'; // Disable transition for immediate color change
        singlePlayerElements.highScoreLabel.style.color = 'var(--accent3)'; // Highlight color
        playSound('win'); // Play win sound for new HS
        // Fade back to normal color after a delay
        setTimeout(() => {
            // Check if element still exists
            if (document.body.contains(singlePlayerElements.highScoreLabel)) {
                singlePlayerElements.highScoreLabel.style.transition = 'color 0.5s ease';
                singlePlayerElements.highScoreLabel.style.color = 'var(--text-color-secondary)';
            }
        }, 2000); // Highlight duration
    } else {
         playSound('start'); // Play a less prominent sound for game end without HS
    }

    // Check achievements now that stats are updated, pass last game result
    checkAchievements(true, appState.lastGameResult); // Force save state after checking

    // No automatic popup for SP game over, user can see score and HS.
    // Can choose to go back or play again (by going back and starting new game).
}


/**
 * Handles taps on the main button in single player tap mode.
 * @param {Event} event - The click or touchstart event.
 */
function handleSinglePlayerTap(event) {
    // Only register taps if game is active, in tap mode, and time remains
    if (!singlePlayerGameActive || appState.currentGameMode !== 'tap' || spTimeLeft <= 0) return;

    // Timer is started via countdown callback now

    singlePlayerCount++;
    if(singlePlayerElements.scoreLabel) singlePlayerElements.scoreLabel.textContent = singlePlayerCount.toString();

    // Update stats
    appState.stats.total_taps++;
    appState.stats.consecutive_targets_hit = 0; // Reset consecutive target hits for tap mode

    // Feedback
    vibrate(); // Haptic feedback
    playSound('click'); // Play sound on each tap

    // Get coordinates for ripple effect
    let clickX, clickY;
    if (event.type === 'touchstart') {
        if (!event.touches || event.touches.length === 0) return;
        clickX = event.touches[0].clientX;
        clickY = event.touches[0].clientY;
    } else {
        clickX = event.clientX;
        clickY = event.clientY;
    }
    if(singlePlayerElements.tapButton) playClickEffect(clickX, clickY, singlePlayerElements.tapButton); // Visual ripple

    // Check achievements (pass null for lastResult as game isn't over)
    checkAchievements(false, null);
}

/**
 * Exits the single player game screen and returns to the menu.
 */
function exitSinglePlayer() {
     if (singlePlayerGameActive) {
        // If game was active, stop timer and mark as inactive
        if (spGameTimerId) {
            clearInterval(spGameTimerId);
            spGameTimerId = null;
        }
        singlePlayerGameActive = false;
        // Reset streak counter when exiting mid-game
        appState.stats.consecutive_targets_hit = 0;
     }
     // Remove any remaining target element
     if (singlePlayerElements.currentTarget) {
         try { singlePlayerElements.currentTarget.remove(); } catch(e) {}
         singlePlayerElements.currentTarget = null;
     }

    saveState(); // Save any potential high score updates that occurred
    showScreen('menu', 'slide-right'); // Transition back to menu
}
// --- Two Player Logic ---

/**
 * Resets the state and UI for the two player game screen.
 * @param {boolean} [durationUpdate=true] - Whether to reset the timer duration from settings.
 */
function resetTwoPlayerGameState(durationUpdate = true) {
    // Stop existing timer
    if (tpGameTimerId) {
        clearInterval(tpGameTimerId);
        tpGameTimerId = null;
    }
    isTwoPlayerGameActive = false;
    p1Count = 0;
    p2Count = 0;

    // Reset timer value if requested
    if (durationUpdate) {
        tpTimeLeft = appState.settings.gameDuration;
    }

    // Reset score displays
    if (twoPlayerElements.p1.scoreLabel) twoPlayerElements.p1.scoreLabel.textContent = '0';
    if (twoPlayerElements.p2.scoreLabel) twoPlayerElements.p2.scoreLabel.textContent = '0';

    // Reset player names (might have been updated by prompt)
    if (twoPlayerElements.p1.nameLabel) twoPlayerElements.p1.nameLabel.textContent = p1Name;
    if (twoPlayerElements.p2.nameLabel) twoPlayerElements.p2.nameLabel.textContent = p2Name;

    // Reset timer and status labels
    if (twoPlayerElements.timerLabel) {
        twoPlayerElements.timerLabel.textContent = tpTimeLeft.toString();
        twoPlayerElements.timerLabel.style.color = 'var(--text-color)'; // Reset color
        twoPlayerElements.timerLabel.classList.remove('low-time');
    }
    if (twoPlayerElements.statusLabel) {
        twoPlayerElements.statusLabel.textContent = getLocalizedText('ready');
        twoPlayerElements.statusLabel.style.color = 'var(--text-color-secondary)'; // Reset color
    }


    // Remove any existing targets
    if (twoPlayerElements.p1.currentTarget) {
        try { twoPlayerElements.p1.currentTarget.remove(); } catch (e) {}
        twoPlayerElements.p1.currentTarget = null;
    }
    if (twoPlayerElements.p2.currentTarget) {
        try { twoPlayerElements.p2.currentTarget.remove(); } catch (e) {}
        twoPlayerElements.p2.currentTarget = null;
    }

    // Reset button states (disable game buttons, enable controls)
    animateEnableDisable(twoPlayerElements.p1.button, false);
    animateEnableDisable(twoPlayerElements.p2.button, false);
    animateEnableDisable(twoPlayerElements.startButton, true);
    animateEnableDisable(twoPlayerElements.menuButton, true);
    if(twoPlayerElements.controlButtonsContainer) twoPlayerElements.controlButtonsContainer.classList.remove('hidden'); // Show start/menu buttons

    // Reset button visual state (in case they were animated)
    if (twoPlayerElements.p1.button) {
        twoPlayerElements.p1.button.style.transform = 'scale(1)';
        twoPlayerElements.p1.button.style.filter = 'brightness(1)';
    }
     if (twoPlayerElements.p2.button) {
        twoPlayerElements.p2.button.style.transform = 'scale(1)';
        twoPlayerElements.p2.button.style.filter = 'brightness(1)';
     }

    // Reset consecutive hits counter (if used for TP, though currently not)
    // appState.stats.consecutive_targets_hit = 0;
}

/**
 * Function called when entering the two player game screen.
 */
function onEnter_two_player() {
    // Ensure elements exist
    if (!twoPlayerElements.screen) return;

    // Set the correct class on the game screen container for CSS rules
    twoPlayerElements.screen.classList.remove('tap-mode', 'target-mode');
    twoPlayerElements.screen.classList.add(`${appState.currentGameMode}-mode`);

    resetTwoPlayerGameState(true); // Full reset including duration

    // Update button texts (in case language changed)
    if(twoPlayerElements.startButton) twoPlayerElements.startButton.textContent = getLocalizedText('start');
    if(twoPlayerElements.menuButton) twoPlayerElements.menuButton.textContent = getLocalizedText('menu');
    // Ensure background music state is correct
    updateMusicState();
}

/**
 * Starts the two player game sequence (shows countdown).
 */
function startTwoPlayerGame() {
    // Reset scores but keep the current timer duration if restarting
    resetTwoPlayerGameState(false); // Don't reset duration from settings

    // Disable control buttons during countdown/game
    animateEnableDisable(twoPlayerElements.startButton, false);
    animateEnableDisable(twoPlayerElements.menuButton, false);
    if(twoPlayerElements.controlButtonsContainer) twoPlayerElements.controlButtonsContainer.classList.add('hidden'); // Hide start/menu buttons

    // Start the countdown, then the game logic
    startCountdown(startTwoPlayerGameLogic);
}

/**
 * Callback function executed after the countdown finishes. Starts the actual game logic.
 */
function startTwoPlayerGameLogic() {
     // Check if screen is still active
     if (appState.currentScreen !== 'two_player') return;

    isTwoPlayerGameActive = true;
    if (twoPlayerElements.statusLabel) {
        twoPlayerElements.statusLabel.textContent = getLocalizedText('go');
        twoPlayerElements.statusLabel.style.color = 'var(--accent3)'; // 'Go' color
    }

    // Enable appropriate game elements based on mode
    if (appState.currentGameMode === 'tap') {
        animateEnableDisable(twoPlayerElements.p1.button, true);
        animateEnableDisable(twoPlayerElements.p2.button, true);
    } else if (appState.currentGameMode === 'target') {
        // Create initial targets for both players
        createTargetElement(twoPlayerElements.p1, twoPlayerElements.p1.area, TARGET_SIZE_TP);
        createTargetElement(twoPlayerElements.p2, twoPlayerElements.p2.area, TARGET_SIZE_TP);
    }

    // Start the game timer
    tpTimeLeft = appState.settings.gameDuration; // Ensure timer starts fresh
    if (twoPlayerElements.timerLabel) {
        twoPlayerElements.timerLabel.textContent = tpTimeLeft.toString();
        twoPlayerElements.timerLabel.classList.remove('low-time');
    }
    tpGameTimerId = setInterval(updateTwoPlayerTimer, 1000);
}

/**
 * Handles taps for Player 1 in two player tap mode.
 * @param {Event} event - The click or touchstart event.
 */
function handleP1Tap(event) {
    if (!isTwoPlayerGameActive || appState.currentGameMode !== 'tap' || tpTimeLeft <= 0) return;
    p1Count++;
    if (twoPlayerElements.p1.scoreLabel) twoPlayerElements.p1.scoreLabel.textContent = p1Count.toString();

    appState.stats.total_taps++;
    // appState.stats.consecutive_targets_hit = 0; // Reset target streak if tracking TP streaks
    checkAchievements(false, null); // Pass null, game not over

    // Feedback
    vibrate();
    playSound('click');

    // Ripple effect
    let clickX, clickY;
    if (event.type === 'touchstart') {
        if (!event.touches || event.touches.length === 0) return;
        clickX = event.touches[0].clientX;
        clickY = event.touches[0].clientY;
    } else {
        clickX = event.clientX;
        clickY = event.clientY;
    }
     if(twoPlayerElements.p1.area) playClickEffect(clickX, clickY, twoPlayerElements.p1.area);
}

/**
 * Handles taps for Player 2 in two player tap mode.
 * @param {Event} event - The click or touchstart event.
 */
function handleP2Tap(event) {
    if (!isTwoPlayerGameActive || appState.currentGameMode !== 'tap' || tpTimeLeft <= 0) return;
    p2Count++;
    if(twoPlayerElements.p2.scoreLabel) twoPlayerElements.p2.scoreLabel.textContent = p2Count.toString();

    appState.stats.total_taps++;
    // appState.stats.consecutive_targets_hit = 0; // Reset target streak if tracking TP streaks
    checkAchievements(false, null); // Pass null, game not over

    // Feedback
    vibrate();
     playSound('click');

    // Ripple effect
    let clickX, clickY;
    if (event.type === 'touchstart') {
         if (!event.touches || event.touches.length === 0) return;
        clickX = event.touches[0].clientX;
        clickY = event.touches[0].clientY;
    } else {
        clickX = event.clientX;
        clickY = event.clientY;
    }
    if(twoPlayerElements.p2.area) playClickEffect(clickX, clickY, twoPlayerElements.p2.area);
}

/**
 * Updates the two player game timer each second.
 */
function updateTwoPlayerTimer() {
    // Stop timer if game becomes inactive
    if (!isTwoPlayerGameActive) {
        if (tpGameTimerId) clearInterval(tpGameTimerId);
        tpGameTimerId = null;
        return;
    }

    tpTimeLeft--;
    if (twoPlayerElements.timerLabel) twoPlayerElements.timerLabel.textContent = tpTimeLeft.toString();

    // Low time visual feedback
    if (tpTimeLeft <= 5 && tpTimeLeft > 0) {
        if(twoPlayerElements.timerLabel) twoPlayerElements.timerLabel.classList.add('low-time');
        playSound('click'); // Tick sound
    } else {
        if(twoPlayerElements.timerLabel) twoPlayerElements.timerLabel.classList.remove('low-time');
    }

    // End game when timer reaches zero
    if (tpTimeLeft <= 0) {
        clearInterval(tpGameTimerId);
        tpGameTimerId = null;
        isTwoPlayerGameActive = false;

        // Disable game buttons
        animateEnableDisable(twoPlayerElements.p1.button, false);
        animateEnableDisable(twoPlayerElements.p2.button, false);

        // Remove any remaining targets
        if (twoPlayerElements.p1.currentTarget) {
            try { twoPlayerElements.p1.currentTarget.remove(); } catch (e) {}
            twoPlayerElements.p1.currentTarget = null;
        }
        if (twoPlayerElements.p2.currentTarget) {
            try { twoPlayerElements.p2.currentTarget.remove(); } catch (e) {}
            twoPlayerElements.p2.currentTarget = null;
        }

        // Reset timer visual state
        if (twoPlayerElements.timerLabel) {
            twoPlayerElements.timerLabel.style.color = 'var(--text-color)';
            twoPlayerElements.timerLabel.classList.remove('low-time');
        }

        // Determine and show the winner
        showTwoPlayerWinner();
        return; // Exit function after showing winner
    }
}


/**
 * Determines the winner of the two player game, updates stats, logs result, and shows the game over popup.
 */
function showTwoPlayerWinner() {
    let winnerTextKey = '';
    let winnerColor = 'var(--accent3)'; // Default/tie color
    let winnerButton = null; // Button to animate for win (tap mode)
    let winnerResultKey = ''; // Key for log entry ('log_winner_p1', 'log_winner_p2', 'log_winner_tie')
    let winnerName = '';
    let loserName = '';
    let scoreW = 0;
    let scoreL = 0;
    let isTie = false;
    const duration = appState.settings.gameDuration; // Capture duration
    const mode = appState.currentGameMode; // Capture mode

    // Determine winner
    if (p1Count > p2Count) {
        appState.stats.p1_wins++;
        winnerButton = twoPlayerElements.p1.button;
        winnerColor = 'var(--accent1)';
        winnerResultKey = 'log_winner_p1';
        winnerName = p1Name;
        loserName = p2Name;
        scoreW = p1Count;
        scoreL = p2Count;
    } else if (p2Count > p1Count) {
        appState.stats.p2_wins++;
        winnerButton = twoPlayerElements.p2.button;
        winnerColor = 'var(--accent2)';
        winnerResultKey = 'log_winner_p2';
        winnerName = p2Name;
        loserName = p1Name;
        scoreW = p2Count;
        scoreL = p1Count;
    } else { // Tie
        winnerTextKey = 'tie';
        winnerButton = null;
        winnerColor = 'var(--accent6)';
        winnerResultKey = 'log_winner_tie';
        winnerName = getLocalizedText('tie'); // Special name for tie
        loserName = ''; // No loser in a tie
        scoreW = p1Count;
        scoreL = p2Count;
        isTie = true;
    }

    // Store result for potential sharing and achievements
    // Store before potential animations/UI updates
    appState.lastGameResult = {
        winner: winnerName, loser: loserName, scoreW: scoreW, scoreL: scoreL,
        p1Score: p1Count, p2Score: p2Count, tie: isTie,
        duration: duration, mode: mode // Include duration and mode
    };


    // Animate winning button in tap mode
    if (winnerButton && mode === 'tap') {
        animateWin(winnerButton);
    }

    // Update status label on game screen
    const winnerDisplay = isTie ? getLocalizedText('tie') : winnerName + getLocalizedText('wins_suffix');
    if (twoPlayerElements.statusLabel) {
        twoPlayerElements.statusLabel.textContent = winnerDisplay;
        twoPlayerElements.statusLabel.style.color = winnerColor;
    }

    // Show control buttons again
    if(twoPlayerElements.controlButtonsContainer) twoPlayerElements.controlButtonsContainer.classList.remove('hidden');
    animateEnableDisable(twoPlayerElements.startButton, true); // Re-enable Start (for Play Again)
    animateEnableDisable(twoPlayerElements.menuButton, true); // Re-enable Menu

    // Update games played stats
    if (mode === 'tap') appState.stats.games_played_tp_tap++;
    else appState.stats.games_played_tp_target++;

    // Check for 60s game completion
    if (duration === 60) {
        appState.stats.played_60s_game = true;
    }

    // Log the result
    const logEntry = {
        type: 'tp',
        mode: mode,
        p1Score: p1Count,
        p2Score: p2Count,
        p1Name: p1Name,
        p2Name: p2Name,
        winner: winnerResultKey, // Use the key ('log_winner_p1', etc.)
        duration: duration,
        timestamp: new Date().toISOString()
    };
    addLogEntry(logEntry); // This also saves state


    // Prepare and show Game Over popup
    if (consolidatedPopupElements.winnerText) {
        consolidatedPopupElements.winnerText.textContent = winnerDisplay;
        consolidatedPopupElements.winnerText.style.color = winnerColor;
    }
    if (consolidatedPopupElements.finalScoreDetails) {
        const scoreLabelKey = mode === 'tap' ? 'taps' : 'targets';
        consolidatedPopupElements.finalScoreDetails.innerHTML = `<span>${p1Name}: ${p1Count} ${getLocalizedText(scoreLabelKey)}</span><span>${p2Name}: ${p2Count} ${getLocalizedText(scoreLabelKey)}</span>`;
    }
    if(consolidatedPopupElements.restartButton) consolidatedPopupElements.restartButton.textContent = getLocalizedText('play_again');
    if(consolidatedPopupElements.menuButtonPopup) consolidatedPopupElements.menuButtonPopup.textContent = getLocalizedText('main_menu');
    if(consolidatedPopupElements.shareButton) consolidatedPopupElements.shareButton.textContent = getLocalizedText('share_result');


    checkAchievements(true, appState.lastGameResult); // Check achievements, pass result, force save
    showPopup('gameOver'); // Show the results popup
}

/**
 * Handles actions from the Game Over popup (Play Again or Main Menu).
 * @param {'restart' | 'menu'} action - The action chosen by the user.
 */
function handleGameOverAction(action) {
    hidePopup('gameOver');
    if (action === 'restart') {
        // Short delay before restarting to allow popup to hide smoothly
        setTimeout(() => {
            // Check if still on the 2-player screen before restarting
            if (appState.currentScreen === 'two_player') {
                startTwoPlayerGame(); // Start a new game with same players/mode
            }
        }, 100);
    } else if (action === 'menu') {
        // Reset state before going to menu (scores, timer etc.)
        resetTwoPlayerGameState(true); // Full reset
        showScreen('menu', 'slide-right'); // Go back to main menu
    }
}

/**
 * Handles the click on the Menu button on the two player screen during a game.
 */
function handleTwoPlayerMenuButton() {
    animatePress(twoPlayerElements.menuButton); // Visual/audio feedback

    if (isTwoPlayerGameActive) {
        // If game is running, pause timer and show confirmation popup
        if (tpGameTimerId) {
            clearInterval(tpGameTimerId);
            tpGameTimerId = null; // Pause timer
        }
        // Define what happens if they confirm "Yes"
        twoPlayerQuitConfirmationCallback = () => {
            isTwoPlayerGameActive = false;
            resetTwoPlayerGameState(true); // Reset game state completely
            showScreen('menu', 'slide-right'); // Go to menu
        };
        showPopup('confirmQuit'); // Show the confirmation dialog
    } else {
        // If game is not active (e.g., finished, before start), just go to menu
        resetTwoPlayerGameState(true); // Reset just in case
        showScreen('menu', 'slide-right');
    }
}

/**
 * Handles the user's choice from the quit confirmation popup.
 * @param {boolean} confirm - True if the user chose 'Yes', false for 'No' or closing popup.
 */
function handleQuitConfirm(confirm) {
    // Hide the popup regardless of choice first
    // Check if 'confirmQuit' is the top popup before hiding
    if (appState.activePopups.length > 0 && appState.activePopups[appState.activePopups.length - 1] === 'confirmQuit') {
        hidePopup('confirmQuit');
    }


    if (confirm && typeof twoPlayerQuitConfirmationCallback === 'function') {
        // If confirmed Yes, execute the callback (which usually goes to menu)
        twoPlayerQuitConfirmationCallback();
    } else {
        // If No, or popup closed otherwise, resume the timer if game was active
        if (isTwoPlayerGameActive && tpTimeLeft > 0 && !tpGameTimerId) {
             tpGameTimerId = setInterval(updateTwoPlayerTimer, 1000); // Resume timer
        }
    }
    // Clear the callback function reference
    twoPlayerQuitConfirmationCallback = null;
}
// --- Game Log Screen Logic ---

/**
 * Formats an ISO timestamp string into a user-readable date and time string.
 * @param {string} isoString - The ISO timestamp string.
 * @returns {string} Formatted date and time string.
 */
function formatTimestamp(isoString) {
    try {
        const date = new Date(isoString);
        // Use locale-sensitive formatting
        const optionsDate = { year: 'numeric', month: 'short', day: 'numeric' };
        const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: true }; // Use 12-hour format
        const locale = appState.settings.language === 'arabic' ? 'ar-EG' : 'en-US'; // Use appropriate locales
        return `${date.toLocaleDateString(locale, optionsDate)} - ${date.toLocaleTimeString(locale, optionsTime)}`;
    } catch (e) {
        console.error("Error formatting timestamp:", isoString, e);
        return "Invalid Date"; // Fallback for invalid timestamps
    }
}

/**
 * Updates the content of the game log screen.
 */
function updateLogScreen() {
     if (!logElements.summary || !logElements.entriesContainer) return; // Ensure elements exist

    const stats = appState.stats;
    const totalGames = stats.p1_wins + stats.p2_wins;
    const winRate = totalGames > 0 ? Math.round((stats.p1_wins / totalGames) * 100) : 0;

    // Update summary section
    let summaryHTML = `<span>${getLocalizedText('log_sp_target_highscore', stats.single_player_high_score)} | ${getLocalizedText('log_sp_tap_highscore', stats.sp_taps_in_duration_setting, stats.sp_taps_in_duration)}</span>`;
    summaryHTML += `<span>${getLocalizedText('log_win_rate', winRate)} (${getLocalizedText('log_total_games', totalGames)})</span>`;
    logElements.summary.innerHTML = summaryHTML;

    // Clear previous entries
    logElements.entriesContainer.innerHTML = '';

    // Populate log entries
    if (appState.gameLog.length === 0) {
        logElements.entriesContainer.innerHTML = `<p class="log-placeholder" data-i18n="no_log_entries">${getLocalizedText('no_log_entries')}</p>`;
        return;
    }

    // Create a document fragment to batch DOM updates
     const fragment = document.createDocumentFragment();

    appState.gameLog.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('log-entry');

        const formattedTimestamp = formatTimestamp(entry.timestamp);
        let detailsHTML = `<span class="log-date">${formattedTimestamp}</span>`;

        if (entry.type === 'sp') {
            entryDiv.classList.add('single-player');
            const modeText = getLocalizedText(entry.mode === 'tap' ? 'tap_mode_select' : 'target_mode_select');
            const scoreLabel = getLocalizedText(entry.mode === 'tap' ? 'taps' : 'targets');
            // Format: SP Tap - Taps: 55 (30s) OR SP Target - Targets: 40 (30s)
            detailsHTML += `<span class="log-details">${getLocalizedText('log_entry_sp', modeText, scoreLabel, entry.score, entry.duration)}</span>`;
        } else if (entry.type === 'tp') {
            entryDiv.classList.add('two-player');
            const modeText = getLocalizedText(entry.mode === 'tap' ? 'tap_mode_select' : 'target_mode_select');
            const winnerText = getLocalizedText(entry.winner); // Gets "P1 Wins", "P2 Wins", or "Tie"
            // Determine CSS class for winner highlighting
            const winnerClass = entry.winner === 'log_winner_p1' ? 'log-winner-p1'
                              : entry.winner === 'log_winner_p2' ? 'log-winner-p2'
                              : 'log-tie';
            // Format: TP Tap - P1: 50 vs P2: 45 - <span class="log-winner-p1">P1 Wins</span>
            detailsHTML += `<span class="log-details">${getLocalizedText('log_entry_tp',
                 modeText,
                 entry.p1Name || 'P1', // Fallback names
                 entry.p1Score,
                 entry.p2Name || 'P2',
                 entry.p2Score,
                 `<span class="${winnerClass}">${winnerText}</span>` // Embed winner text with class
             )}</span>`;
        }
        entryDiv.innerHTML = detailsHTML;
        fragment.appendChild(entryDiv); // Add to fragment
    });

    // Append the fragment to the container once
     logElements.entriesContainer.appendChild(fragment);
}

/**
 * Function called when entering the game log screen.
 */
function onEnter_log() {
    updateLogScreen();
    // Update back button text (in case language changed)
    if(logElements.backButton) logElements.backButton.textContent = getLocalizedText('back_button');
}
// --- Achievements Logic ---

// Debounce saving state after achievement checks to avoid excessive writes
let saveTimeoutId = null;
function debouncedSaveState() {
     if (saveTimeoutId) clearTimeout(saveTimeoutId);
     saveTimeoutId = setTimeout(() => {
         saveState();
         saveTimeoutId = null;
     }, ACHIEVEMENT_SAVE_INTERVAL); // Wait before saving
}

/**
 * Checks if any achievements have been unlocked based on current stats.
 * @param {boolean} [forceSave=false] - If true, saves the state immediately after checking.
 * @param {object|null} [lastResult=null] - The result object from the just-finished game, used by some achievement conditions.
 */
function checkAchievements(forceSave = false, lastResult = null) {
    let achievementUnlockedThisCheck = false;
    let stateChanged = false; // Track if any achievement state (progress or unlocked) changed
    // Assumes ACHIEVEMENTS object is available globally from achievements.js

    // Make a copy of current achievements to pass to 'perfectionist' check if needed
    const currentAchievementsState = { ...appState.achievements };

    Object.keys(ACHIEVEMENTS).forEach(id => {
        const achievementDef = ACHIEVEMENTS[id];
        const oldState = currentAchievementsState[id] || { unlocked: false, notified: false, progress: 0 };
        const newState = { ...oldState }; // Work on a copy

        // Only check achievements that are not already unlocked
        if (!newState.unlocked) {
            let currentProgress = newState.progress; // Keep old progress unless updated
            // Update progress if applicable
            if (achievementDef.progressCurrentFn) {
                const calculatedProgress = achievementDef.progressCurrentFn(appState.stats);
                // Only update if progress actually changed
                if (calculatedProgress !== newState.progress) {
                     newState.progress = achievementDef.progressMax ? Math.min(calculatedProgress, achievementDef.progressMax) : calculatedProgress;
                     stateChanged = true; // Mark state as changed due to progress update
                }
                currentProgress = newState.progress; // Use updated progress for condition check
            }

            // Check if the condition is now met
            // Pass stats, lastResult, and the *current* state of all achievements to the condition function
            if (achievementDef.condition(appState.stats, lastResult, currentAchievementsState)) {
                newState.unlocked = true;
                stateChanged = true;
                achievementUnlockedThisCheck = true;

                // Show notification only once
                if (!newState.notified) {
                    showAchievementPopup(id);
                    newState.notified = true; // Mark as notified
                }
                 playSound('achievement'); // Play unlock sound
            }
        }
         // Update the main app state only if the achievement state actually changed
         if (newState.unlocked !== oldState.unlocked || newState.progress !== oldState.progress || newState.notified !== oldState.notified) {
            appState.achievements[id] = newState;
         }
    });

    // Save state if an achievement was unlocked, state changed, or if forced
    if (stateChanged || forceSave) {
        if (forceSave) {
             // If forced (e.g., end of game), save immediately
             if (saveTimeoutId) clearTimeout(saveTimeoutId); // Cancel any pending debounced save
             saveState();
        } else {
             // Otherwise, use debounced save
             debouncedSaveState();
        }
        // If the achievements screen is active, refresh it
        if (appState.currentScreen === 'achievements') {
            updateAchievementsScreen();
        }
    }
}


/**
 * Shows the achievement unlocked popup notification.
 * @param {string} id - The ID of the unlocked achievement.
 */
function showAchievementPopup(id) {
    const achievementDef = ACHIEVEMENTS[id];
    // Ensure all required elements exist
    if (!achievementDef || !popups.achievement || !consolidatedPopupElements.achievementPopupIcon || !consolidatedPopupElements.achievementPopupName || !consolidatedPopupElements.achievementPopupDesc) {
         console.warn(`Cannot show popup for achievement ID: ${id}. Missing elements or definition.`);
         return;
    }

    // Populate popup content
    consolidatedPopupElements.achievementPopupIcon.textContent = achievementDef.icon || '🏆';
    consolidatedPopupElements.achievementPopupName.textContent = getLocalizedText(achievementDef.titleKey);
    consolidatedPopupElements.achievementPopupDesc.textContent = getLocalizedText(achievementDef.descKey);

    showPopup('achievement'); // Show the popup

    // Automatically hide the popup after a few seconds
    setTimeout(() => {
         // Check if this specific popup is still the top one before hiding
         if (appState.activePopups.length > 0 && appState.activePopups[appState.activePopups.length - 1] === 'achievement') {
             hidePopup('achievement');
         }
    }, 3500); // Display duration
}

/**
 * Updates the content of the achievements list screen.
 */
function updateAchievementsScreen() {
     if (!achievementElements.list || !achievementElements.progress) return; // Ensure elements exist

    achievementElements.list.innerHTML = ''; // Clear previous list
    let unlockedCount = 0;
    const totalAchievements = Object.keys(ACHIEVEMENTS).length;
    const perfectionistId = 'perfectionist'; // ID of the final achievement

    if (totalAchievements === 0) {
        achievementElements.list.innerHTML = `<p class="log-placeholder">${getLocalizedText('no_achievements_yet')}</p>`;
        achievementElements.progress.textContent = '';
        return;
    }

    // Separate perfectionist achievement to display last
    const otherAchievementIds = Object.keys(ACHIEVEMENTS).filter(id => id !== perfectionistId);

    // Sort other achievements: Unlocked first, then by definition order (approximated by current order)
    const sortedIds = otherAchievementIds.sort((a, b) => {
        const unlockedA = appState.achievements[a]?.unlocked || false;
        const unlockedB = appState.achievements[b]?.unlocked || false;
        if (unlockedA && !unlockedB) return -1; // A comes first
        if (!unlockedA && unlockedB) return 1;  // B comes first
        return 0; // Keep original order if both locked or both unlocked
    });

    // Function to create and append an achievement entry
    const createEntry = (id) => {
         const definition = ACHIEVEMENTS[id];
         if (!definition) return; // Skip if definition missing

         const state = appState.achievements[id] || { unlocked: false, progress: 0, notified: false }; // Get current state or default

         const entryDiv = document.createElement('div');
         entryDiv.classList.add('achievement-entry');
         if (state.unlocked) {
             entryDiv.classList.add('unlocked');
             // Only count non-perfectionist achievements towards the total shown before perfectionist
             if (id !== perfectionistId) {
                unlockedCount++;
             }
         }

         // Calculate progress text if applicable and not unlocked
         let progressText = '';
         if (definition.progressMax && !state.unlocked) {
             // Use current stats for progress display, not just saved state.progress
             const currentProgress = definition.progressCurrentFn ? definition.progressCurrentFn(appState.stats) : (state.progress || 0);
             progressText = ` (${Math.min(currentProgress, definition.progressMax)} / ${definition.progressMax})`;
         }

         // Build inner HTML for the achievement entry
         entryDiv.innerHTML = `
             <span class="achievement-icon-list">${definition.icon || '🏆'}</span>
             <div class="achievement-details">
                 <span class="achievement-title-list">${getLocalizedText(definition.titleKey)}</span>
                 <span class="achievement-desc-list">${getLocalizedText(definition.descKey)}${progressText}</span>
             </div>`;

         achievementElements.list.appendChild(entryDiv);
    };

    // Create entries for sorted non-perfectionist achievements
    sortedIds.forEach(createEntry);

    // Create entry for perfectionist achievement if it exists
     if (ACHIEVEMENTS[perfectionistId]) {
        createEntry(perfectionistId);
        // If perfectionist is unlocked, increment count (now it's the final one)
        if(appState.achievements[perfectionistId]?.unlocked) {
            unlockedCount++;
        }
     }


    // Update the progress summary text (excluding perfectionist from the denominator initially)
     const displayTotal = totalAchievements - (ACHIEVEMENTS[perfectionistId] ? 1 : 0);
     const displayUnlocked = unlockedCount - (appState.achievements[perfectionistId]?.unlocked ? 1 : 0);

    achievementElements.progress.textContent = `Unlocked: ${displayUnlocked} / ${displayTotal}` + (ACHIEVEMENTS[perfectionistId] ? ' (+ ⭐)' : '');
}


/**
 * Function called when entering the achievements screen.
 */
function onEnter_achievements() {
    updateAchievementsScreen();
    // Update back button text
    if(achievementElements.backButton) achievementElements.backButton.textContent = getLocalizedText('back_button');
}
 // --- Share Functionality ---

/**
 * Attempts to share the last game result using the Web Share API or copies to clipboard as fallback.
 */
async function shareResult() {
    let title = getLocalizedText('main_menu'); // App title for sharing context
    let text = '';
    let url = window.location.href; // URL of the game
    const result = appState.lastGameResult;

    try {
        // Construct the share text based on the last game result
        if (result.p1Score !== undefined && result.p2Score !== undefined) { // Two Player game result
            if (result.tie) {
                // "It's a tie in Speed Tapper Ultra! (50-50) https://..."
                text = getLocalizedText('share_text_tie', result.p1Score, result.p2Score);
            } else {
                 // "PlayerA beat PlayerB in Speed Tapper Ultra! (60-55) https://..."
                text = getLocalizedText('share_text_tp', result.winner, result.loser, result.scoreW, result.scoreL);
            }
        } else if (result.spScore !== undefined) { // Single Player game result
             // "I scored 75 taps in Speed Tapper Ultra! Can you beat it? https://..."
            const modeLabel = getLocalizedText(result.mode === 'tap' ? 'taps' : 'targets');
            text = getLocalizedText('share_text_sp', result.spScore, modeLabel);
        } else {
            // Fallback text if result data is missing or invalid
            text = `Check out ${title}!`;
            console.warn("Last game result data missing for sharing.");
        }

        // Add the URL to the text
        text += ` ${url}`;

        // Use Web Share API if available
        if (navigator.share) {
            await navigator.share({
                title: title,
                text: text,
                // url: url // URL is often implicitly included or can be added to text
            });
            console.log('Result shared successfully via Web Share API.');
        } else {
            // Fallback: Copy to clipboard
            copyTextToClipboard(text);
            alert("Share API not supported. Result copied to clipboard!"); // Inform user
             console.log("Web Share API not supported, copied to clipboard instead.");
        }
    } catch (error) {
        // Handle errors, especially AbortError if user cancels share dialog
        if (error.name === 'AbortError') {
            console.log('Share action cancelled by user.');
        } else {
            console.error('Error sharing result:', error);
            // Attempt clipboard fallback again on general error
             try {
                 copyTextToClipboard(text);
                 alert("Share failed. Result copied to clipboard!");
             } catch(copyError){
                 console.error('Clipboard copy failed:', copyError);
                 alert("Share and copy to clipboard failed."); // Inform user of complete failure
             }
        }
    } finally {
        // Hide the game over popup after sharing attempt (or cancellation)
        // Check if the gameOver popup is the top one before hiding
        if (appState.activePopups.length > 0 && appState.activePopups[appState.activePopups.length - 1] === 'gameOver') {
             hidePopup('gameOver');
        }
    }
}

/**
 * Copies text to the user's clipboard.
 * @param {string} text - The text to copy.
 */
function copyTextToClipboard(text) {
    // Use modern Clipboard API if available
    if (navigator.clipboard && window.isSecureContext) { // Clipboard API requires secure context (HTTPS or localhost)
        navigator.clipboard.writeText(text).then(() => {
            console.log("Text copied to clipboard.");
            // Optionally provide feedback to the user (e.g., temporary message)
            // showTemporaryMessage("Copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy text to clipboard:', err);
             alert("Failed to copy to clipboard. You may need to copy manually."); // Inform user
        });
    } else {
        // Fallback for insecure contexts or older browsers (less reliable)
        console.warn("Clipboard API not available or context is insecure. Copy functionality limited.");
        // Basic alert fallback:
        alert("Automatic copy failed. Please copy the following text manually:\n\n" + text);
    }
}
// --- Initialization ---

/**
 * Initializes the entire application: loads state, sets up DOM references, adds event listeners.
 */
function initializeApp() {
    console.log("Initializing App...");

    // Assign DOM references (ensure DOM is ready)
    bodyElement = document.body;
    backgroundMusicElement = document.getElementById('background-music');
    if (!backgroundMusicElement) console.warn("Background music element not found!");

    screens = {
        menu: document.getElementById('menu-screen'),
        game: document.getElementById('game-screen'),
        two_player: document.getElementById('two-player-screen'),
        settings: document.getElementById('settings-screen'),
        log: document.getElementById('log-screen'),
        achievements: document.getElementById('achievements-screen')
    };
    popups = {
        instructions: document.getElementById('popup-instructions'),
        gameOver: document.getElementById('popup-game-over'),
        confirmQuit: document.getElementById('popup-confirm-quit'),
        countdown: document.getElementById('countdown-overlay'),
        modeSelect: document.getElementById('popup-mode-select'),
        achievement: document.getElementById('popup-achievement')
    };
     // Check if all screens and popups were found
     Object.keys(screens).forEach(key => { if (!screens[key]) console.error(`Screen element not found: ${key}`) });
     Object.keys(popups).forEach(key => { if (!popups[key]) console.error(`Popup element not found: ${key}`) });


    menuButtons = {
        singlePlayer: document.getElementById('btn-single-player'),
        twoPlayers: document.getElementById('btn-two-players'),
        gameLog: document.getElementById('btn-game-log'),
        achievements: document.getElementById('btn-achievements'),
        settings: document.getElementById('btn-settings'),
        instructions: document.getElementById('btn-instructions')
    };
    settingsControls = {
        soundToggle: document.getElementById('sound-toggle'),
        musicToggle: document.getElementById('music-toggle'),
        vibrationToggle: document.getElementById('vibration-toggle'),
        durationLabel: document.getElementById('duration-label'),
        durationSlider: document.getElementById('duration-slider'),
        difficultyLabel: document.getElementById('difficulty-label'),
        difficultySelect: document.getElementById('difficulty-select'),
        themeLabel: document.getElementById('theme-label'),
        themeSelect: document.getElementById('theme-select'),
        languageToggle: document.getElementById('language-toggle'),
        backButton: document.getElementById('btn-settings-back')
    };
    menuStatsLabel = document.getElementById('menu-stats');
    singlePlayerElements = {
        screen: document.getElementById('game-screen'),
        highScoreLabel: document.getElementById('high-score-label'),
        scoreLabel: document.getElementById('single-player-score'),
        timerLabel: document.getElementById('single-player-timer'),
        tapButton: document.getElementById('tap-button'),
        targetArea: document.getElementById('single-player-target-area'),
        currentTarget: null,
        backButton: document.getElementById('btn-game-back')
    };
    twoPlayerElements = {
        screen: document.getElementById('two-player-screen'),
        p1: {
            area: document.querySelector('#two-player-screen .player-area.player1'),
            button: document.getElementById('p1-button'),
            scoreLabel: document.getElementById('p1-score'),
            nameLabel: document.querySelector('#center-controls .player-info.player1 .player-name'),
            currentTarget: null,
            name: 'P1' // Default, will be updated
        },
        p2: {
            area: document.querySelector('#two-player-screen .player-area.player2'),
            button: document.getElementById('p2-button'),
            scoreLabel: document.getElementById('p2-score'),
            nameLabel: document.querySelector('#center-controls .player-info.player2 .player-name'),
            currentTarget: null,
            name: 'P2' // Default, will be updated
        },
        centerControls: document.getElementById('center-controls'),
        centerColumn: document.querySelector('.center-column'),
        timerLabel: document.getElementById('timer-label'),
        statusLabel: document.getElementById('status-label'),
        controlButtonsContainer: document.getElementById('two-player-control-buttons'),
        startButton: document.getElementById('start-button'),
        menuButton: document.getElementById('menu-button-2p')
    };
    logElements = {
        summary: document.getElementById('log-summary'),
        entriesContainer: document.getElementById('log-entries'),
        backButton: document.getElementById('btn-log-back')
    };
    achievementElements = {
        list: document.getElementById('achievements-list'),
        progress: document.getElementById('achievement-progress'),
        backButton: document.getElementById('btn-achievements-back'),
    };
    // Consolidated references to elements inside popups
    consolidatedPopupElements = {
        instructionsText: document.getElementById('instructions-text'),
        developerInfo: document.getElementById('developer-info'),
        winnerText: document.getElementById('winner-text'),
        finalScoreDetails: document.getElementById('final-score-details'),
        shareButtonContainer: document.getElementById('share-button-container'),
        shareButton: document.getElementById('btn-share-result'),
        restartButton: document.getElementById('restart-button'),
        menuButtonPopup: document.getElementById('menu-button-popup'),
        confirmQuitYes: document.getElementById('confirm-quit-yes'),
        // confirmQuitNo is handled by generic close button
        countdownText: document.getElementById('countdown-text'),
        modeSelectTitle: document.getElementById('mode-select-title'),
        modeSelectTap: document.getElementById('btn-select-tap'),
        modeSelectTarget: document.getElementById('btn-select-target'),
        // modeSelectCancel is handled by generic close button
        achievementPopupIcon: document.querySelector('#popup-achievement .achievement-icon'),
        achievementPopupName: document.getElementById('achievement-name'),
        achievementPopupDesc: document.getElementById('achievement-desc')
    };
     // Check if essential consolidated elements were found
     if (!consolidatedPopupElements.instructionsText) console.error("Instructions text element not found");
     if (!consolidatedPopupElements.winnerText) console.error("Winner text element not found");
     // Add more checks if needed


    // Load saved state and apply settings
    loadState(); // This now correctly sets initial theme flags

    // Preload common sounds
    preloadSounds(); // Start loading sounds early

    // --- Add Event Listeners ---
    // Add listeners only if the element exists to prevent errors

    // Menu Buttons
    if(menuButtons.singlePlayer) menuButtons.singlePlayer.addEventListener('click', () => selectGameMode('single'));
    if(menuButtons.twoPlayers) menuButtons.twoPlayers.addEventListener('click', () => selectGameMode('two'));
    if(menuButtons.gameLog) menuButtons.gameLog.addEventListener('click', () => showScreen('log', 'slide-left'));
    if(menuButtons.achievements) menuButtons.achievements.addEventListener('click', () => showScreen('achievements', 'slide-left'));
    if(menuButtons.settings) menuButtons.settings.addEventListener('click', () => showScreen('settings', 'slide-left'));
    if(menuButtons.instructions) menuButtons.instructions.addEventListener('click', () => showPopup('instructions'));

    // Mode Selection Popup Buttons
    if(consolidatedPopupElements.modeSelectTap) consolidatedPopupElements.modeSelectTap.addEventListener('click', () => startGameWithMode('tap'));
    if(consolidatedPopupElements.modeSelectTarget) consolidatedPopupElements.modeSelectTarget.addEventListener('click', () => startGameWithMode('target'));

    // Settings Screen Controls
    if(settingsControls.soundToggle) settingsControls.soundToggle.addEventListener('click', () => handleSettingChange('soundEnabled', !appState.settings.soundEnabled));
    if(settingsControls.musicToggle) settingsControls.musicToggle.addEventListener('click', () => handleSettingChange('musicEnabled', !appState.settings.musicEnabled));
    if(settingsControls.vibrationToggle) settingsControls.vibrationToggle.addEventListener('click', () => handleSettingChange('vibrationEnabled', !appState.settings.vibrationEnabled));
    if(settingsControls.durationSlider) {
        settingsControls.durationSlider.addEventListener('input', (e) => {
            if(settingsControls.durationLabel) settingsControls.durationLabel.textContent = getLocalizedText('game_duration_label', e.target.value);
        });
        settingsControls.durationSlider.addEventListener('change', (e) => {
            handleSettingChange('gameDuration', parseInt(e.target.value, 10));
            vibrate();
        });
    }
    if(settingsControls.difficultySelect) settingsControls.difficultySelect.addEventListener('change', (e) => handleSettingChange('difficulty', e.target.value));
    if(settingsControls.themeSelect) settingsControls.themeSelect.addEventListener('change', (e) => handleSettingChange('theme', e.target.value));
    if(settingsControls.languageToggle) settingsControls.languageToggle.addEventListener('click', () => {
        const newLang = appState.settings.language === 'english' ? 'arabic' : 'english';
        handleSettingChange('language', newLang);
    });
    if(settingsControls.backButton) settingsControls.backButton.addEventListener('click', () => showScreen('menu', 'slide-right'));

    // Single Player Screen
    if(singlePlayerElements.backButton) singlePlayerElements.backButton.addEventListener('click', exitSinglePlayer);
    if(singlePlayerElements.tapButton) {
        singlePlayerElements.tapButton.addEventListener('touchstart', (e) => { e.preventDefault(); handleSinglePlayerTap(e); }, { passive: false });
        singlePlayerElements.tapButton.addEventListener('click', handleSinglePlayerTap);
    }
     // Target Area Listener (delegated from createTargetElement) - no direct listener needed here

    // Two Player Screen
    if(twoPlayerElements.startButton) twoPlayerElements.startButton.addEventListener('click', startTwoPlayerGame);
    if(twoPlayerElements.menuButton) twoPlayerElements.menuButton.addEventListener('click', handleTwoPlayerMenuButton);
    if(twoPlayerElements.p1.button) {
        twoPlayerElements.p1.button.addEventListener('touchstart', (e) => { e.preventDefault(); handleP1Tap(e); }, { passive: false });
        twoPlayerElements.p1.button.addEventListener('click', handleP1Tap);
    }
    if(twoPlayerElements.p2.button) {
        twoPlayerElements.p2.button.addEventListener('touchstart', (e) => { e.preventDefault(); handleP2Tap(e); }, { passive: false });
        twoPlayerElements.p2.button.addEventListener('click', handleP2Tap);
    }
     // Target Area Listeners (delegated from createTargetElement) - no direct listener needed here

    // Log & Achievements Screens Back Buttons
    if(logElements.backButton) logElements.backButton.addEventListener('click', () => showScreen('menu', 'slide-right'));
    if(achievementElements.backButton) achievementElements.backButton.addEventListener('click', () => showScreen('menu', 'slide-right'));

    // Popup Action Buttons
    if(consolidatedPopupElements.restartButton) consolidatedPopupElements.restartButton.addEventListener('click', () => handleGameOverAction('restart'));
    if(consolidatedPopupElements.menuButtonPopup) consolidatedPopupElements.menuButtonPopup.addEventListener('click', () => handleGameOverAction('menu'));
    if(consolidatedPopupElements.confirmQuitYes) consolidatedPopupElements.confirmQuitYes.addEventListener('click', () => handleQuitConfirm(true));
    if(consolidatedPopupElements.shareButton) consolidatedPopupElements.shareButton.addEventListener('click', shareResult);

    // Generic Popup Close Buttons (handles 'No' on confirm, Cancel on mode select, Close on instructions)
    document.querySelectorAll('.popup-close-button').forEach(button => {
        button.addEventListener('click', () => hideTopPopup());
    });

    // Add general press feedback to non-gameplay buttons (optional)
    // document.querySelectorAll('.base-button:not(.game-button):not(.tp-game-button)').forEach(btn => {
    //     btn.addEventListener('click', (e) => { animatePress(e.currentTarget); });
    // });


    // Final Setup
    showScreen(appState.currentScreen, 'none'); // Show initial screen without transition
    updateAllTexts(); // Apply initial language and text
    updateMenuStats(); // Show initial stats on menu
    //initAudioContext(); // Initialize audio context (now done on first interaction/sound play)
    triggerFullscreenOnFirstInteraction(); // Setup fullscreen trigger
    checkAchievements(true, null); // Initial achievement check and save (pass null for lastResult)

    console.log("App Initialized and Ready.");
}

// --- Global Error Handling ---
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Global Error:", message, "at", source, ":", lineno, ":", colno, error);
    // Optional: Display a user-friendly error message
    // alert("An unexpected error occurred. Please reload the page or contact support.");
    // Consider logging errors to a server in a real application
};
window.onunhandledrejection = function(event) {
     console.error('Unhandled Promise Rejection:', event.reason);
     // Optional: Display a user-friendly error message
     // alert("An unexpected error occurred processing a background task.");
};

// --- Start the App ---
// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', initializeApp);