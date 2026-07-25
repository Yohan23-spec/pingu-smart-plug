// ============================================================
// VOICE ASSISTANT - Wake Word System (Optimasi untuk Android)
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
// KONFIGURASI (DIOPTIMASI UNTUK ANDROID)
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
    // DITINGKATKAN DARI 5 DETIK MENJADI 8 DETIK UNTUK MOBILE
    commandTimeout: 8000,
    silenceThreshold: 2000,
    language: 'id-ID',
    continuous: true,
    // KONFIGURASI BARU UNTUK ANDROID
    transcriptBufferDelay: 800, // Jeda sebelum memproses transcript (ms)
    audioCompleteDelay: 400, // Jeda setelah audio selesai (ms)
    restartRecognitionDelay: 300, // Jeda sebelum restart recognition (ms)
    minTranscriptLength: 2, // Panjang minimal transcript untuk diproses
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
let isProcessingTranscript = false;

// ============================================================
// TRANSCRIPT BUFFER (SOLUSI UNTUK ANDROID)
// ============================================================
class TranscriptBuffer {
    constructor() {
        this.buffer = '';
        this.timerId = null;
        this.isProcessing = false;
        this.lastTranscript = '';
        this.transcriptCount = 0;
        this.delay = CONFIG.transcriptBufferDelay;
    }

    /**
     * Menambahkan transcript ke buffer
     * Fitur ini mencegah Android memproses hasil speech yang terpotong
     * 
     * Alasan teknis:
     * - Android Chrome sering mengirim hasil final secara bertahap
     * - Contoh: "tolong" → "tolong nyalakan" → "tolong nyalakan lampu"
     * - Dengan buffer, kita menunggu hingga user benar-benar selesai bicara
     */
    addTranscript(transcript) {
        // Normalisasi transcript
        const normalized = transcript.toLowerCase().trim();
        if (!normalized) return;

        // Jika transcript sama dengan yang terakhir, abaikan (duplikat)
        if (normalized === this.lastTranscript) {
            return;
        }

        this.lastTranscript = normalized;
        this.transcriptCount++;

        // Update buffer
        this.buffer = normalized;
        
        // Reset timer setiap kali ada transcript baru
        this.resetTimer();
        
        console.log(`📝 Buffer updated: "${this.buffer}" (${this.transcriptCount})`);
    }

    resetTimer() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        // Tunggu hingga user berhenti bicara sebelum memproses
        this.timerId = setTimeout(() => {
            this.processBuffer();
        }, this.delay);
    }

    processBuffer() {
        if (this.isProcessing) return;
        if (!this.buffer || this.buffer.length < CONFIG.minTranscriptLength) {
            console.log(`📝 Buffer terlalu pendek, diabaikan: "${this.buffer}"`);
            this.clear();
            return;
        }

        this.isProcessing = true;
        const transcript = this.buffer;
        
        console.log(`📝 Processing final transcript: "${transcript}"`);
        
        // Proses transcript yang sudah lengkap
        handleFinalTranscript(transcript);
        
        this.clear();
        this.isProcessing = false;
    }

    clear() {
        this.buffer = '';
        this.lastTranscript = '';
        this.transcriptCount = 0;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        this.isProcessing = false;
    }

    // Untuk memproses buffer secara paksa (saat timeout)
    flush() {
        if (this.buffer && !this.isProcessing) {
            console.log(`📝 Flushing buffer: "${this.buffer}"`);
            this.processBuffer();
        }
    }
}

// Inisialisasi buffer
let transcriptBuffer = null;

// ============================================================
// DOM ELEMENTS
// ============================================================
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
        
        // DOM Elements
        assistantToggleBtn = document.getElementById('assistantToggleBtn');
        assistantStatusText = document.getElementById('voiceOrbStatusText');
        assistantResultText = document.getElementById('assistantResultText');
        assistantBtnText = document.getElementById('assistantBtnText');
        
        if (!assistantToggleBtn) {
            reject(new Error('Assistant toggle button not found'));
            return;
        }
        
        // Inisialisasi transcript buffer
        transcriptBuffer = new TranscriptBuffer();
        
        // Setup recognition dengan konfigurasi optimal untuk Android
        recognition = new SpeechRecognition();
        recognition.lang = CONFIG.language;
        recognition.continuous = CONFIG.continuous;
        // interimResults = true untuk mendapatkan feedback lebih cepat
        // Tapi kita TIDAK langsung memproses hasil interim
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        // ============================================================
        // EVENT HANDLERS (DIOPTIMASI UNTUK ANDROID)
        // ============================================================
        
        recognition.onstart = () => {
            isListening = true;
            updateUIState(currentState);
            console.log('🎤 Voice recognition started (Android optimized)');
        };
        
        recognition.onend = () => {
            isListening = false;
            console.log('🛑 Voice recognition ended');
            
            // Jika recognition berhenti dan masih ada buffer yang belum diproses
            if (transcriptBuffer && transcriptBuffer.buffer) {
                console.log('📝 Recognition ended, flushing buffer...');
                transcriptBuffer.flush();
            }
            
            // Restart recognition jika asisten masih aktif
            if (isAssistantActive && 
                currentState !== STATE.OFF && 
                currentState !== STATE.PLAYING_AUDIO &&
                !isWaitingForAudioComplete &&
                !isProcessingTranscript) {
                
                console.log('🔄 Restarting voice recognition...');
                setTimeout(() => {
                    safeStartRecognition();
                }, CONFIG.restartRecognitionDelay);
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
                // Silent - Android sering mengirim ini
                // Tidak perlu melakukan apa-apa
            } else if (event.error === 'aborted') {
                // Ignore - ini adalah hasil dari stop yang disengaja
            } else if (event.error === 'audio-capture') {
                console.warn('⚠️ Audio capture error, mencoba restart...');
                if (isAssistantActive && 
                    currentState !== STATE.OFF && 
                    currentState !== STATE.PLAYING_AUDIO &&
                    !isWaitingForAudioComplete) {
                    setTimeout(() => {
                        safeStartRecognition();
                    }, 500);
                }
            } else {
                // Untuk error lain, coba restart
                if (isAssistantActive && 
                    currentState !== STATE.OFF && 
                    currentState !== STATE.PLAYING_AUDIO &&
                    !isWaitingForAudioComplete) {
                    setTimeout(() => {
                        safeStartRecognition();
                    }, 500);
                }
            }
        };
        
        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.toLowerCase().trim();
            const isFinal = result.isFinal;
            
            // Update UI dengan transcript (interim atau final)
            if (assistantResultText) {
                assistantResultText.textContent = `"${transcript}"`;
                assistantResultText.className = 'voice-orb-result-text';
                if (!isFinal) {
                    assistantResultText.className = 'voice-orb-result-text interim';
                }
            }
            
            // ============================================================
            // KRITIKAL: HANYA PROSES HASIL FINAL DENGAN BUFFER
            // ============================================================
            // Alasan: Android sering mengirim hasil final secara bertahap
            // Contoh: "tolong" (final) → "tolong nyalakan" (final)
            // Dengan buffer, kita menunggu hingga user selesai bicara
            // ============================================================
            
            if (isFinal) {
                // Tambahkan ke buffer, JANGAN langsung diproses
                if (transcriptBuffer) {
                    transcriptBuffer.addTranscript(transcript);
                }
                
                // Log untuk debugging
                console.log(`📝 Final transcript added to buffer: "${transcript}"`);
                
                // Reset command timeout karena user masih bicara
                if (currentState === STATE.LISTENING_COMMAND) {
                    resetCommandTimeout();
                }
            } else {
                // Interim result - hanya untuk UI feedback
                if (assistantResultText) {
                    assistantResultText.textContent = `"${transcript}"`;
                    assistantResultText.className = 'voice-orb-result-text interim';
                }
            }
        };
        
        // Setup toggle button
        assistantToggleBtn.addEventListener('click', toggleAssistant);
        assistantToggleBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAssistant();
            }
        });
        
        // Preload audio
        try {
            preloadAudios();
        } catch (e) {
            console.warn('⚠️ Gagal preload audio:', e);
        }
        
        resolve();
    });
}

// ============================================================
// SAFE START RECOGNITION (CEGAH RACE CONDITION)
// ============================================================
function safeStartRecognition() {
    if (!recognition) return;
    if (isListening) {
        console.log('ℹ️ Recognition already listening');
        return;
    }
    if (isWaitingForAudioComplete) {
        console.log('ℹ️ Waiting for audio to complete');
        return;
    }
    if (currentState === STATE.PLAYING_AUDIO) {
        console.log('ℹ️ Currently playing audio');
        return;
    }
    if (currentState === STATE.OFF) {
        console.log('ℹ️ Assistant is off');
        return;
    }
    if (isProcessingTranscript) {
        console.log('ℹ️ Processing transcript, waiting...');
        return;
    }
    
    try {
        recognition.start();
        console.log('🎤 Recognition started safely');
    } catch (e) {
        console.warn('⚠️ Gagal memulai recognition:', e);
        // Jika error, coba lagi setelah delay
        if (isAssistantActive && currentState !== STATE.OFF) {
            setTimeout(() => {
                safeStartRecognition();
            }, CONFIG.restartRecognitionDelay);
        }
    }
}

// ============================================================
// SAFE STOP RECOGNITION (CEGAH DOUBLE CALL)
// ============================================================
function safeStopRecognition() {
    if (!recognition) return;
    if (!isListening) {
        console.log('ℹ️ Recognition already stopped');
        return;
    }
    
    try {
        recognition.stop();
        console.log('🛑 Recognition stopped safely');
    } catch (e) {
        console.warn('⚠️ Gagal menghentikan recognition:', e);
    }
    isListening = false;
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
    isProcessingTranscript = false;
    setState(STATE.PLAYING_AUDIO);
    
    console.log('🎵 Memutar audio: mode_panggil_aktif');
    
    safeStopRecognition();
    
    // Inisialisasi ulang buffer
    if (transcriptBuffer) {
        transcriptBuffer.clear();
    }
    
    playVoice('mode_panggil_aktif')
        .then(() => {
            console.log('✅ Audio mode_panggil_aktif selesai');
            isWaitingForAudioComplete = false;
            if (isAssistantActive) {
                // Jeda sebelum start recognition (penting untuk Android)
                setTimeout(() => {
                    if (isAssistantActive) {
                        setState(STATE.LISTENING_WAKEWORD);
                        safeStartRecognition();
                    }
                }, CONFIG.audioCompleteDelay);
            }
        })
        .catch(() => {
            console.warn('⚠️ Gagal memutar mode_panggil_aktif');
            isWaitingForAudioComplete = false;
            if (isAssistantActive) {
                setTimeout(() => {
                    if (isAssistantActive) {
                        setState(STATE.LISTENING_WAKEWORD);
                        safeStartRecognition();
                    }
                }, CONFIG.audioCompleteDelay);
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
    isProcessingTranscript = false;
    
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
        commandTimeoutId = null;
    }
    
    if (transcriptBuffer) {
        transcriptBuffer.clear();
    }
    
    safeStopRecognition();
    stopVoice();
    
    setState(STATE.OFF);
    updateUIState(STATE.OFF);
    console.log('🎤 Voice Assistant dinonaktifkan');
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
// HANDLE FINAL TRANSCRIPT (DARI BUFFER)
// ============================================================
function handleFinalTranscript(transcript) {
    console.log(`📝 Processing final transcript: "${transcript}"`);
    
    switch (currentState) {
        case STATE.LISTENING_WAKEWORD:
            handleWakeWord(transcript);
            break;
        case STATE.LISTENING_COMMAND:
            handleCommand(transcript);
            break;
        default:
            console.log(`ℹ️ Transcript ignored (state: ${currentState})`);
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
        
        // Stop recognition saat wake word terdeteksi
        safeStopRecognition();
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
                    // Jeda setelah audio selesai (penting untuk Android)
                    setTimeout(() => {
                        if (isAssistantActive) {
                            setState(STATE.LISTENING_COMMAND);
                            startCommandTimeout();
                            // Reset buffer untuk command
                            if (transcriptBuffer) {
                                transcriptBuffer.clear();
                            }
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            })
            .catch(() => {
                console.warn('⚠️ Gagal memutar iya');
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setTimeout(() => {
                        if (isAssistantActive) {
                            setState(STATE.LISTENING_COMMAND);
                            startCommandTimeout();
                            if (transcriptBuffer) {
                                transcriptBuffer.clear();
                            }
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            });
    }
}

// ============================================================
// HANDLE COMMAND
// ============================================================
function handleCommand(transcript) {
    if (isProcessingTranscript) {
        console.log('⏳ Already processing, ignoring...');
        return;
    }
    
    isProcessingTranscript = true;
    
    // Clear timeout karena command sudah diterima
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
        commandTimeoutId = null;
    }
    
    const lower = transcript.toLowerCase().trim();
    
    safeStopRecognition();
    setState(STATE.PROCESSING_COMMAND);
    
    let commandFound = false;
    
    // DETEKSI PERINTAH MATIKAN
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
                isProcessingTranscript = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                isProcessingTranscript = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            });
    }
    // DETEKSI PERINTAH NYALAKAN
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
                isProcessingTranscript = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                isProcessingTranscript = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            });
    }
    
    // PERINTAH TIDAK DIKENALI
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
                isProcessingTranscript = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                isProcessingTranscript = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
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
        commandTimeoutId = null;
    }
    
    commandTimeoutId = setTimeout(() => {
        console.log('⏰ Command timeout');
        commandTimeoutId = null;
        
        // Flush buffer jika ada transcript yang belum diproses
        if (transcriptBuffer && transcriptBuffer.buffer) {
            console.log('📝 Timeout: flushing buffer...');
            transcriptBuffer.flush();
            // Jika buffer diproses, timeout akan di-handle di proses tersebut
            return;
        }
        
        safeStopRecognition();
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
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            })
            .catch(() => {
                isWaitingForAudioComplete = false;
                if (isAssistantActive) {
                    setState(STATE.LISTENING_WAKEWORD);
                    wakeWordDetected = false;
                    if (transcriptBuffer) {
                        transcriptBuffer.clear();
                    }
                    setTimeout(() => {
                        if (isAssistantActive) {
                            safeStartRecognition();
                        }
                    }, CONFIG.audioCompleteDelay);
                }
            });
    }, CONFIG.commandTimeout);
}

function resetCommandTimeout() {
    if (commandTimeoutId) {
        clearTimeout(commandTimeoutId);
        commandTimeoutId = null;
    }
    // Restart timeout
    startCommandTimeout();
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
    
    if (transcriptBuffer) {
        transcriptBuffer.clear();
        transcriptBuffer = null;
    }
    
    isAssistantActive = false;
    isListening = false;
    isWaitingForAudioComplete = false;
    isProcessingTranscript = false;
    currentState = STATE.OFF;
    stopVoice();
}