// ============================================================
// VOICE PLAYER - Audio Response System
// ============================================================

// ============================================================
// KONFIGURASI AUDIO
// ============================================================
const AUDIO_BASE_PATH = '';

const AUDIO_FILES = {
    iya: 'iya.wav',
    pingu_dinyalakan: 'pingu_dinyalakan.wav',
    pingu_dimatikan: 'pingu_dimatikan.wav',
    tidak_dimengerti: 'tidak_dimengerti.wav',
    waktu_habis: 'waktu_habis.wav',
    mode_panggil_aktif: 'mode_panggil_aktif.wav',
};

// ============================================================
// STATE
// ============================================================
let currentAudio = null;
let isPlaying = false;
let playbackQueue = [];
let isProcessingQueue = false;
let ttsVoicesLoaded = false;
let cachedVoices = [];

// Cache untuk audio yang sudah di-preload
const audioCache = new Map();

// ============================================================
// TEXT TO SPEECH MESSAGES (FALLBACK)
// ============================================================
const TTS_MESSAGES = {
    iya: 'Iya?',
    pingu_dinyalakan: 'Pingu dinyalakan.',
    pingu_dimatikan: 'Pingu dimatikan.',
    tidak_dimengerti: 'Maaf, saya tidak memahami perintah tersebut.',
    waktu_habis: 'Baik, saya kembali menunggu.',
    mode_panggil_aktif: 'Mode panggil aktif.',
};

// ============================================================
// PRELOAD AUDIO FILE
// ============================================================
function preloadAudioFile(key) {
    return new Promise((resolve, reject) => {
        // Cek cache
        if (audioCache.has(key)) {
            resolve(audioCache.get(key));
            return;
        }

        const filename = AUDIO_FILES[key];
        if (!filename) {
            reject(new Error(`No audio file for key "${key}"`));
            return;
        }

        const url = `${AUDIO_BASE_PATH}${filename}`;
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';

        // Cek apakah file bisa dimuat
        audio.addEventListener('canplaythrough', () => {
            audioCache.set(key, audio);
            console.log(`✅ Audio siap: ${filename}`);
            resolve(audio);
        });

        audio.addEventListener('error', () => {
            console.warn(`⚠️ Gagal memuat audio: ${filename}`);
            reject(new Error(`Failed to load audio: ${filename}`));
        });

        // Load audio
        audio.load();
    });
}

// ============================================================
// CHECK AUDIO FILE AVAILABILITY
// ============================================================
function checkAudioFile(key) {
    const filename = AUDIO_FILES[key];
    if (!filename) return false;
    
    // Cek cache
    if (audioCache.has(key)) {
        const audio = audioCache.get(key);
        return audio && audio.readyState >= 2; // HAVE_CURRENT_DATA
    }
    
    return false;
}

// ============================================================
// GET VOICE INDONESIA (FALLBACK TTS)
// ============================================================
function getIndonesianVoice() {
    const voices = window.speechSynthesis.getVoices();
    
    let voice = voices.find(v => v.lang.includes('id'));
    
    if (!voice) {
        voice = voices.find(v => v.lang.includes('ms'));
    }
    
    if (!voice) {
        voice = voices.find(v => v.name.toLowerCase().includes('female')) || 
                voices.find(v => v.name.toLowerCase().includes('google')) ||
                voices[0];
    }
    
    return voice;
}

// ============================================================
// LOAD VOICES (FALLBACK TTS)
// ============================================================
function loadVoices() {
    return new Promise((resolve) => {
        if (ttsVoicesLoaded) {
            resolve(cachedVoices);
            return;
        }
        
        if (!window.speechSynthesis) {
            resolve([]);
            return;
        }
        
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            cachedVoices = voices;
            ttsVoicesLoaded = true;
            resolve(voices);
            return;
        }
        
        window.speechSynthesis.onvoiceschanged = () => {
            const newVoices = window.speechSynthesis.getVoices();
            if (newVoices.length > 0) {
                cachedVoices = newVoices;
                ttsVoicesLoaded = true;
                resolve(newVoices);
            }
        };
        
        setTimeout(() => {
            const newVoices = window.speechSynthesis.getVoices();
            if (newVoices.length > 0) {
                cachedVoices = newVoices;
                ttsVoicesLoaded = true;
                resolve(newVoices);
            } else {
                resolve([]);
            }
        }, 3000);
    });
}

// ============================================================
// PLAY TTS (FALLBACK - Hanya digunakan jika WAV gagal)
// ============================================================
function playTTS(key, onEnd = null) {
    return new Promise(async (resolve, reject) => {
        const message = TTS_MESSAGES[key];
        
        if (!message) {
            console.warn(`⚠️ Tidak ada TTS message untuk key "${key}"`);
            reject(new Error(`No TTS message for key "${key}"`));
            return;
        }
        
        if (!window.speechSynthesis) {
            console.warn('⚠️ Browser tidak mendukung Speech Synthesis');
            reject(new Error('Speech Synthesis not supported'));
            return;
        }
        
        console.log(`🔊 FALLBACK TTS: "${message}"`);
        
        // Load voices
        await loadVoices();
        
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'id-ID';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        const voice = getIndonesianVoice();
        if (voice) {
            utterance.voice = voice;
            console.log(`✅ Menggunakan voice: ${voice.name} (${voice.lang})`);
        }
        
        let isResolved = false;
        
        utterance.onstart = () => {
            isPlaying = true;
        };
        
        utterance.onend = () => {
            if (isResolved) return;
            isResolved = true;
            isPlaying = false;
            if (onEnd) onEnd();
            resolve();
            processQueue();
        };
        
        utterance.onerror = (error) => {
            if (isResolved) return;
            isResolved = true;
            console.warn('⚠️ TTS error:', error);
            isPlaying = false;
            if (onEnd) onEnd();
            resolve(); // Resolve anyway to continue flow
            processQueue();
        };
        
        try {
            window.speechSynthesis.speak(utterance);
        } catch (err) {
            if (isResolved) return;
            isResolved = true;
            console.error('❌ Gagal memutar TTS:', err);
            isPlaying = false;
            if (onEnd) onEnd();
            resolve();
            processQueue();
        }
    });
}

// ============================================================
// PLAY WAV AUDIO (PRIMARY)
// ============================================================
function playWavAudio(key, onEnd = null) {
    return new Promise((resolve, reject) => {
        const filename = AUDIO_FILES[key];
        
        if (!filename) {
            reject(new Error(`No audio file for key "${key}"`));
            return;
        }

        // Cek apakah audio sudah di-cache dan siap
        if (audioCache.has(key)) {
            const cachedAudio = audioCache.get(key);
            if (cachedAudio && cachedAudio.readyState >= 2) {
                console.log(`🎵 Memutar audio custom: ${filename}`);
                playAudioElement(cachedAudio, onEnd, resolve, reject);
                return;
            }
        }

        // Jika belum di-cache, load dan putar
        const url = `${AUDIO_BASE_PATH}${filename}`;
        console.log(`🎵 Memuat audio custom: ${url}`);
        
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
        
        let isResolved = false;
        
        audio.addEventListener('canplaythrough', () => {
            if (isResolved) return;
            audioCache.set(key, audio);
            console.log(`✅ Audio siap: ${filename}`);
            playAudioElement(audio, onEnd, resolve, reject);
        });
        
        audio.addEventListener('error', (error) => {
            if (isResolved) return;
            isResolved = true;
            console.warn(`⚠️ Gagal memuat audio custom: ${filename}`);
            reject(error);
        });
        
        audio.load();
    });
}

// ============================================================
// PLAY AUDIO ELEMENT
// ============================================================
function playAudioElement(audio, onEnd, resolve, reject) {
    let isResolved = false;
    
    // Pastikan audio yang sebelumnya dimainkan dihentikan
    if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    
    // Hapus semua event listener lama untuk menghindari multiple calls
    const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
    };
    
    audio.onended = () => {
        if (isResolved) return;
        isResolved = true;
        isPlaying = false;
        currentAudio = null;
        if (onEnd) onEnd();
        cleanup();
        resolve();
        processQueue();
    };
    
    audio.onerror = (error) => {
        if (isResolved) return;
        isResolved = true;
        console.warn('⚠️ Gagal memutar audio:', error);
        isPlaying = false;
        currentAudio = null;
        if (onEnd) onEnd();
        cleanup();
        reject(error);
        processQueue();
    };
    
    // Juga handle jika audio di-pause oleh sistem
    audio.onpause = () => {
        // Jika audio di-pause dan belum selesai, anggap selesai
        if (!isResolved && audio.currentTime > 0) {
            // Cek apakah audio sudah mendekati akhir
            if (audio.currentTime >= audio.duration - 0.1) {
                audio.onended();
            }
        }
    };
    
    try {
        isPlaying = true;
        currentAudio = audio;
        
        // Reset audio jika sudah pernah diputar
        audio.currentTime = 0;
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                if (isResolved) return;
                isResolved = true;
                console.warn('⚠️ Gagal memutar audio:', err);
                isPlaying = false;
                currentAudio = null;
                if (onEnd) onEnd();
                cleanup();
                reject(err);
                processQueue();
            });
        }
    } catch (err) {
        if (isResolved) return;
        isResolved = true;
        console.warn('⚠️ Gagal memutar audio:', err);
        isPlaying = false;
        currentAudio = null;
        if (onEnd) onEnd();
        cleanup();
        reject(err);
        processQueue();
    }
}

// ============================================================
// PLAY VOICE (PRIMARY WAV, FALLBACK TTS)
// ============================================================
export function playVoice(key, onEnd = null) {
    return new Promise((resolve, reject) => {
        console.log(`🔊 Memutar: "${key}"`);
        
        // Coba putar WAV terlebih dahulu
        playWavAudio(key, onEnd)
            .then(() => {
                console.log(`✅ Audio custom selesai: "${key}"`);
                resolve();
            })
            .catch((error) => {
                console.warn(`⚠️ Audio custom gagal diputar untuk "${key}", fallback ke TTS...`);
                // Fallback ke TTS
                playTTS(key, onEnd)
                    .then(() => {
                        console.log(`✅ Fallback TTS selesai: "${key}"`);
                        resolve();
                    })
                    .catch((ttsError) => {
                        console.error(`❌ Fallback TTS juga gagal untuk "${key}":`, ttsError);
                        // Jangan reject, lanjutkan queue
                        if (onEnd) onEnd();
                        resolve();
                    });
            });
    });
}

// ============================================================
// PLAY VOICE WITH WAV ONLY (Alternatif tanpa fallback)
// ============================================================
export function playVoiceWithWavOnly(key, onEnd = null) {
    return new Promise((resolve, reject) => {
        playWavAudio(key, onEnd)
            .then(resolve)
            .catch(reject);
    });
}

// ============================================================
// QUEUE SYSTEM
// ============================================================
export function queueVoice(key) {
    playbackQueue.push(key);
    if (!isProcessingQueue) {
        processQueue();
    }
}

async function processQueue() {
    if (isProcessingQueue) return;
    if (playbackQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    while (playbackQueue.length > 0) {
        const key = playbackQueue.shift();
        try {
            await playVoice(key);
        } catch (error) {
            console.warn(`⚠️ Gagal memutar "${key}", melanjutkan...`);
        }
    }
    
    isProcessingQueue = false;
}

// ============================================================
// STOP VOICE
// ============================================================
export function stopVoice() {
    // Stop audio element
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        // Hapus event listener untuk mencegah callback yang tidak diinginkan
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.onpause = null;
        currentAudio = null;
        isPlaying = false;
    }
    
    // Stop TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    playbackQueue = [];
    isProcessingQueue = false;
}

// ============================================================
// CHECK PLAYING STATUS
// ============================================================
export function isVoicePlaying() {
    return isPlaying || playbackQueue.length > 0;
}

// ============================================================
// PRELOAD AUDIOS
// ============================================================
export function preloadAudios() {
    console.log('🎵 Preloading audio files...');
    
    // Preload semua audio
    const keys = Object.keys(AUDIO_FILES);
    let loadedCount = 0;
    let failedCount = 0;
    
    keys.forEach((key) => {
        preloadAudioFile(key)
            .then(() => {
                loadedCount++;
                console.log(`✅ Preload: ${key} (${loadedCount}/${keys.length})`);
            })
            .catch(() => {
                failedCount++;
                console.warn(`⚠️ Preload gagal: ${key}`);
            });
    });
    
    // Preload TTS voices sebagai fallback
    if (window.speechSynthesis) {
        loadVoices().then((voices) => {
            console.log(`✅ TTS voices loaded: ${voices.length} voices available`);
            const indoVoice = getIndonesianVoice();
            if (indoVoice) {
                console.log(`✅ Voice Indonesia: ${indoVoice.name} (${indoVoice.lang})`);
            } else {
                console.log('ℹ️ Tidak ada voice Indonesia, menggunakan default');
            }
        }).catch(() => {
            console.log('ℹ️ Menggunakan TTS default');
        });
        
        window.speechSynthesis.getVoices();
    } else {
        console.warn('⚠️ Speech Synthesis tidak tersedia');
    }
    
    console.log(`✅ Audio system ready (${loadedCount} files loaded, ${failedCount} failed)`);
}

// ============================================================
// GET AUDIO STATUS
// ============================================================
export function getAudioStatus() {
    const keys = Object.keys(AUDIO_FILES);
    const status = {};
    
    keys.forEach((key) => {
        status[key] = {
            filename: AUDIO_FILES[key],
            cached: audioCache.has(key),
            ready: checkAudioFile(key),
        };
    });
    
    return {
        files: status,
        isPlaying: isPlaying,
        queueLength: playbackQueue.length,
    };
}

// ============================================================
// CLEAR AUDIO CACHE
// ============================================================
export function clearAudioCache() {
    audioCache.clear();
    console.log('🗑️ Audio cache cleared');
}