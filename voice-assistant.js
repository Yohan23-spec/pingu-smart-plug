// ============================================================
// VOICE ASSISTANT - Wake Word System (Disesuaikan dengan UI baru)
// ============================================================

import { playVoice, queueVoice, isVoicePlaying, stopVoice, preloadAudios } from './voice-player.js';

// ============================================================
// STATE MACHINE
// ============================================================
const STATE = {
    OFF: 'OFF',
    LISTENING_WAKEWORD: 'LISTENING_WAKEWORD',
    RESPONDING: 'RESPONDING',
    LISTENING_COMMAND: 'LISTENING_COMMAND',
    PROCESSING_COMMAND: 'PROCESSING_COMMAND',
    PLAYING_AUDIO: 'PLAYING_AUDIO',
    TIMEOUT: 'TIMEOUT',
    ERROR: 'ERROR',
};

// ============================================================
// KONFIGURASI
// ============================================================
const CONFIG = {
    wakeWordAliases: [
        'pingu',
        'pinguin',
        'penguin',
        'pinggu',
        'bingung',
        'pingo',
        'bingo',
        'oi',
        'woe',
        'hai',
    ],
    commandTimeout: 5000,
    silenceThreshold: 2000,
    language: 'id-ID',
    continuous: true,
};

// ============================================================
// STATE
// ============================================================
let recognition = null;
let currentState = STATE.OFF;
let isListening = false;
let wakeWordDetected = false;
let commandTimeoutId = null;
let onCommandCallback = null;
let statusCallback = null;
let isAssistantActive = false;
let isWaitingForAudioComplete = false;

// DOM Elements (Disesuaikan dengan UI baru)
let assistantToggleBtn = null;
let assistantStatusText = null;
let assistantResultText = null;
let assistantBtnText = null;

// ============================================================
// INITIALIZATION
// ============================================================
export function initVoiceAssistant(options = {}) {
    return new Promise((resolve, reject) => {
        onCommandCallback = options.onCommand || null;
        statusCallback = options.onStatusUpdate || null;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('⚠️ Browser tidak mendukung Web Speech API');
            if (statusCallback) {
                statusCallback('error', 'Browser tidak mendukung voice recognition');
            }
            reject(new Error('Speech Recognition not supported'));
            return;
        }
        
        // DOM Elements - Disesuaikan dengan ID baru
        assistantToggleBtn = document.getElementById('assistantToggleBtn');
        assistantStatusText = document.getElementById('voiceOrbStatusText');
        assistantResultText = document.getElementById('assistantResultText');
        assistantBtnText = document.getElementById('assistantBtnText');
        
        if (!assistantToggleBtn) {
            reject(new Error('Assistant toggle button not found'));
            return;
        }
        
        recognition = new SpeechRecognition();
        recognition.lang = CONFIG.language;
        recognition.continuous = CONFIG.continuous;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        recognition.onstart = () => {
            isListening = true;
            updateUIState(currentState);
            console.log('🎤 Voice recognition started');
        };
        
        recognition.onend = () => {
            isListening = false;
            
            if (isAssistantActive && 
                currentState !== STATE.OFF && 
                currentState !== STATE.PLAYING_AUDIO &&
                !isWaitingForAudioComplete) {
                console.log('🔄 Restarting voice recognition...');
                setTimeout(() => {
                    if (isAssistantActive && 
                        currentState !== STATE.OFF && 
                        currentState !== STATE.PLAYING_AUDIO &&
                        !isWaitingForAudioComplete) {
                        try {
                            recognition.start();
                        } catch (e) {
                            console.warn('⚠️ Gagal restart recognition:', e);
                        }
                    }
                }, 100);
            }
            
            updateUIState(currentState);
        };
        
        recognition.onerror = (event) => {
            console.warn('🎤 Voice recognition error:', event.error);
            
            if (event.error === 'not-allowed') {
                setState(STATE.ERROR);
                if (statusCallback) {
                    statusCallback('error', 'Izin mikrofon ditolak');
                }
                deactivateAssistant();
            } else if (event.error === 'no-speech') {
                // Silent
            } else if (event.error === 'aborted') {
                // Ignore
            } else {
                if (isAssistantActive && 
                    currentState !== STATE.OFF && 
                    currentState !== STATE.PLAYING_AUDIO &&
                    !isWaitingForAudioComplete) {
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch (e) {
                            // Ignore
                        }
                    }, 500);
                }
            }
        };
        
        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.toLowerCase().trim();
            const isFinal = result.isFinal;
            
            if (assistantResultText) {
                assistantResultText.textContent = `"${transcript}"`;
                assistantResultText.className = 'voice-orb-result-text';
            }
            
            if (isFinal) {
                handleTranscript(transcript);
            } else {
                if (assistantResultText) {
                    assistantResultText.textContent = `"${transcript}"`;
                    assistantResultText.className = 'voice-orb-result-text interim';
                }
            }
        };
        
        assistantToggleBtn.addEventListener('click', toggleAssistant);
        
        assistantToggleBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAssistant();
            }
        });
        
        try {
            preloadAudios();
        } catch (e) {
            console.warn('⚠️ Gagal preload audio:', e);
        }
        
        resolve();
    });
}

// ============================================================
// TOGGLE ASSISTANT
// ============================================================
function toggleAssistant() {
    if (isAssistantActive) {
        deactivateAssistant();
    } else {
        activateAssistant();
    }
}

// ============================================================
// ACTIVATE ASSISTANT
// ============================================================
function activateAssistant() {
    if (isAssistantActive) return;
    if (!recognition) return;
    
    isAssistantActive = true;
    isWaitingForAudioComplete = false;
    setState(STATE.PLAYING_AUDIO);
    
    console.log('🎵 Memutar audio: mode_panggil_aktif');
    
    stopRecognition();
    
    playVoice('mode_panggil_aktif')
        .then(() => {
            console.log('✅ Audio mode_panggil_aktif selesai');
            isWaitingForAudioComplete = false;
            if (isAssistantActive) {
                setState(STATE.LISTENING_WAKEWORD);
                startRecognition();
            }
        })
        .catch(() => {
            console.warn('⚠️ Gagal memutar mode_panggil_aktif');
            isWaitingForAudioComplete = false;
            if (isAssistantActive) {
                setState(STATE.LISTENING_WAKEWORD);
                startRecognition();
            }
        });
    
    updateUIState(currentState);
    console.log('🎤 Voice Assistant diaktifkan');
}

// ============================================================
// DEACTIVATE ASSISTANT
// ============================================================
function deactivateAssistant() {
    isAssistantActive = false;
    wakeWordDetected = false;
    isWaitingForAudioComplete = false;
    
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
        commandTimeoutId = null;
    }
    
    stopRecognition();
    stopVoice();
    
    setState(STATE.OFF);
    updateUIState(STATE.OFF);
    console.log('🎤 Voice Assistant dinonaktifkan');
}

// ============================================================
// START / STOP RECOGNITION
// ============================================================
function startRecognition() {
    if (!recognition) return;
    if (isListening) return;
    if (isWaitingForAudioComplete) return;
    if (currentState === STATE.PLAYING_AUDIO) return;
    
    try {
        recognition.start();
        console.log('🎤 Recognition started');
    } catch (e) {
        console.warn('⚠️ Gagal memulai recognition:', e);
    }
}

function stopRecognition() {
    if (!recognition) return;
    if (isListening) {
        try {
            recognition.stop();
            console.log('🛑 Recognition stopped');
        } catch (e) {
            console.warn('⚠️ Gagal menghentikan recognition:', e);
        }
    }
    isListening = false;
}

// ============================================================
// SET STATE
// ============================================================
function setState(newState) {
    currentState = newState;
    updateUIState(newState);
    
    if (statusCallback) {
        statusCallback(newState, getStateLabel(newState));
    }
}

// ============================================================
// HANDLE TRANSCRIPT
// ============================================================
function handleTranscript(transcript) {
    console.log(`📝 Transcript: "${transcript}"`);
    
    switch (currentState) {
        case STATE.LISTENING_WAKEWORD:
            handleWakeWord(transcript);
            break;
        case STATE.LISTENING_COMMAND:
            handleCommand(transcript);
            break;
        default:
            break;
    }
}

// ============================================================
// NORMALIZE TEXT
// ============================================================
function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,!?;:()"']/g, '').replace(/\s+$/g, '');
}

// ============================================================
// CHECK WAKE WORD
// ============================================================
function checkWakeWord(text, aliases) {
    if (!text || !aliases || aliases.length === 0) {
        return { matched: false, alias: null, index: -1 };
    }
    
    for (let i = 0; i < aliases.length; i++) {
        const alias = aliases[i].toLowerCase().trim();
        if (!alias) continue;
        const index = text.indexOf(alias);
        if (index !== -1) {
            return { matched: true, alias: aliases[i], index: index };
        }
    }
    
    return { matched: false, alias: null, index: -1 };
}

// ============================================================
// HANDLE WAKE WORD
// ============================================================
function handleWakeWord(transcript) {
    const originalText = transcript || '';
    const normalizedText = normalizeText(originalText);
    const wakeWordResult = checkWakeWord(normalizedText, CONFIG.wakeWordAliases);
    
    if (wakeWordResult.matched) {
        console.log(`🔔 Wake word detected: "${wakeWordResult.alias}"`);
        wakeWordDetected = true;
        
        stopRecognition();
        setState(STATE.PLAYING_AUDIO);
        
        if (assistantResultText) {
            assistantResultText.textContent = `🔔 Wake word detected! (${wakeWordResult.alias})`;
            assistantResultText.className = 'voice-orb-result-text detected';
        }
        
        console.log('🎵 Memutar audio: iya');
        isWaitingForAudioComplete = true;
        
        playVoice('iya')
            .then(() => {
                console.log('✅ Audio "iya" selesai');
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_COMMAND);
                    startCommandTimeout();
                    startRecognition();
                }
            })
            .catch(() => {
                console.warn('⚠️ Gagal memutar iya');
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_COMMAND);
                    startCommandTimeout();
                    startRecognition();
                }
            });
    }
}

// ============================================================
// HANDLE COMMAND
// ============================================================
function handleCommand(transcript) {
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
        commandTimeoutId = null;
    }
    
    const lower = transcript.toLowerCase().trim();
    
    stopRecognition();
    setState(STATE.PROCESSING_COMMAND);
    
    let commandFound = false;
    
    // OFF
    if (lower.includes('matikan') || 
        lower.includes('nonaktifkan') || 
        lower.includes('off') || 
        lower.includes('padamkan') ||
        lower.includes('tutup') ||
        lower.includes('mati')) {
        
        commandFound = true;
        console.log('🔊 Perintah: MATIKAN');
        
        if (onCommandCallback) {
            onCommandCallback('matikan v1');
        }
        
        setState(STATE.PLAYING_AUDIO);
        isWaitingForAudioComplete = true;
        
        console.log('🎵 Memutar audio: pingu_dimatikan');
        playVoice('pingu_dimatikan')
            .then(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            });
    }
    // ON
    else if (lower.includes('nyalakan') || 
             lower.includes('hidupkan') || 
             lower.includes('aktifkan') || 
             lower.includes('on') ||
             lower.includes('buka') ||
             lower.includes('nyala')) {
        
        commandFound = true;
        console.log('🔊 Perintah: NYALAKAN');
        
        if (onCommandCallback) {
            onCommandCallback('nyalakan v1');
        }
        
        setState(STATE.PLAYING_AUDIO);
        isWaitingForAudioComplete = true;
        
        console.log('🎵 Memutar audio: pingu_dinyalakan');
        playVoice('pingu_dinyalakan')
            .then(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            });
    }
    
    if (!commandFound) {
        console.log(`❌ Perintah tidak dikenali: "${lower}"`);
        setState(STATE.PLAYING_AUDIO);
        isWaitingForAudioComplete = true;
        
        if (assistantResultText) {
            assistantResultText.textContent = '❌ Perintah tidak dikenali';
            assistantResultText.className = 'voice-orb-result-text error';
        }
        
        console.log('🎵 Memutar audio: tidak_dimengerti');
        playVoice('tidak_dimengerti')
            .then(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            });
    }
}

// ============================================================
// COMMAND TIMEOUT
// ============================================================
function startCommandTimeout() {
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
    }
    
    commandTimeoutId = setTimeout(() => {
        console.log('⏰ Command timeout');
        commandTimeoutId = null;
        
        stopRecognition();
        setState(STATE.PLAYING_AUDIO);
        isWaitingForAudioComplete = true;
        
        if (assistantResultText) {
            assistantResultText.textContent = '⏰ Waktu habis';
            assistantResultText.className = 'voice-orb-result-text error';
        }
        
        console.log('🎵 Memutar audio: waktu_habis');
        playVoice('waktu_habis')
            .then(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    startRecognition();
                }
            });
    }, CONFIG.commandTimeout);
}

// ============================================================
// UI UPDATE
// ============================================================
function updateUIState(state) {
    if (!assistantToggleBtn) return;
    
    const isActive = isAssistantActive && state !== STATE.OFF;
    assistantToggleBtn.classList.toggle('active', isActive);
    
    if (assistantStatusText) {
        assistantStatusText.textContent = getStateLabel(state);
    }
    
    if (assistantBtnText) {
        assistantBtnText.textContent = isActive ? 'Nonaktifkan' : 'Aktifkan Asisten';
    }
}

function getStateLabel(state) {
    const labels = {
        [STATE.OFF]: 'Nonaktif',
        [STATE.LISTENING_WAKEWORD]: 'Menunggu "Pingu"',
        [STATE.RESPONDING]: 'Merespon...',
        [STATE.LISTENING_COMMAND]: 'Mendengarkan perintah',
        [STATE.PROCESSING_COMMAND]: 'Memproses...',
        [STATE.PLAYING_AUDIO]: 'Memutar suara...',
        [STATE.TIMEOUT]: 'Waktu habis',
        [STATE.ERROR]: 'Error',
    };
    return labels[state] || 'Unknown';
}

// ============================================================
// PUBLIC METHODS
// ============================================================
export function isAssistantActiveState() {
    return isAssistantActive;
}

export function getCurrentState() {
    return currentState;
}

export function stopAssistant() {
    deactivateAssistant();
}

// ============================================================
// CLEANUP
// ============================================================
export function disposeVoiceAssistant() {
    if (recognition) {
        try {
            recognition.abort();
        } catch (e) {}
        recognition = null;
    }
    
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
        commandTimeoutId = null;
    }
    
    isAssistantActive = false;
    isListening = false;
    isWaitingForAudioComplete = false;
    currentState = STATE.OFF;
    stopVoice();
}