// ============================================================
// VOICE COMMAND - Web Speech API
// ============================================================

let recognition = null;
let isListening = false;
let onCommandCallback = null;
let voiceBtn, voiceStatusText, voiceResultText, voiceWave;

// ============================================================
// INITIALIZATION
// ============================================================
export function initVoiceCommand(options = {}) {
    return new Promise((resolve, reject) => {
        onCommandCallback = options.onCommand || null;
        
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('⚠️ Browser tidak mendukung Web Speech API');
            const status = document.getElementById('voiceStatusText');
            if (status) status.textContent = 'Voice tidak didukung';
            reject(new Error('Speech Recognition not supported'));
            return;
        }
        
        // Setup DOM elements
        voiceBtn = document.getElementById('voiceBtn');
        voiceStatusText = document.getElementById('voiceStatusText');
        voiceResultText = document.getElementById('voiceResultText');
        voiceWave = document.getElementById('voiceWave');
        
        if (!voiceBtn) {
            reject(new Error('Voice button not found'));
            return;
        }
        
        // Create recognition
        recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        // Event handlers
        recognition.onstart = () => {
            isListening = true;
            voiceBtn.classList.add('listening');
            voiceStatusText.textContent = 'Mendengarkan...';
            voiceResultText.textContent = '👂 Dengarkan...';
            voiceResultText.className = 'voice-result-text';
        };
        
        recognition.onend = () => {
            isListening = false;
            voiceBtn.classList.remove('listening');
            voiceStatusText.textContent = 'Klik untuk bicara';
            
            // Jika tidak ada hasil, tampilkan pesan
            if (voiceResultText.textContent === '👂 Dengarkan...') {
                voiceResultText.textContent = 'Tidak ada perintah yang dikenali';
                voiceResultText.className = 'voice-result-text error';
            }
        };
        
        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript;
            
            voiceResultText.textContent = `"${transcript}"`;
            voiceResultText.className = 'voice-result-text';
            
            if (result.isFinal) {
                voiceResultText.className = 'voice-result-text recognized';
                voiceResultText.textContent = `✅ "${transcript}"`;
                
                // Process command
                if (onCommandCallback) {
                    onCommandCallback(transcript);
                }
                
                // Auto stop after final result
                setTimeout(() => {
                    if (recognition && isListening) {
                        recognition.stop();
                    }
                }, 500);
            } else {
                // Interim result
                voiceResultText.textContent = `"${transcript}"`;
                voiceResultText.className = 'voice-result-text';
            }
        };
        
        recognition.onerror = (event) => {
            console.warn('🎤 Voice recognition error:', event.error);
            
            if (event.error === 'not-allowed') {
                voiceResultText.textContent = '❌ Izin mikrofon ditolak';
                voiceResultText.className = 'voice-result-text error';
                voiceStatusText.textContent = 'Izin ditolak';
            } else if (event.error === 'no-speech') {
                voiceResultText.textContent = 'Tidak ada suara terdeteksi';
                voiceResultText.className = 'voice-result-text error';
            } else {
                voiceResultText.textContent = `❌ Error: ${event.error}`;
                voiceResultText.className = 'voice-result-text error';
            }
            
            isListening = false;
            voiceBtn.classList.remove('listening');
            voiceStatusText.textContent = 'Klik untuk bicara';
        };
        
        // Click handler
        voiceBtn.addEventListener('click', toggleVoice);
        
        resolve();
    });
}

// ============================================================
// TOGGLE VOICE
// ============================================================
function toggleVoice() {
    if (!recognition) return;
    
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (e) {
            console.warn('⚠️ Gagal memulai voice recognition:', e);
            // Restart if needed
            try {
                recognition.stop();
                setTimeout(() => recognition.start(), 100);
            } catch (e2) {
                console.error('❌ Gagal memulai ulang voice recognition:', e2);
            }
        }
    }
}

// ============================================================
// STOP VOICE
// ============================================================
export function stopVoice() {
    if (recognition && isListening) {
        recognition.stop();
    }
}

// ============================================================
// CLEANUP
// ============================================================
export function disposeVoice() {
    if (recognition) {
        recognition.abort();
        recognition = null;
    }
    if (voiceBtn) {
        voiceBtn.removeEventListener('click', toggleVoice);
    }
}