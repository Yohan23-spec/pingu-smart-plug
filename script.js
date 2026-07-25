// =====================================================
// KONFIGURASI FIREBASE (TIDAK DIUBAH)
// =====================================================
const firebaseConfig = {
    apiKey: "AIzaSyAQH4jcohVU3cfPAuWjNsHQpI78h8avb14",
    databaseURL: "https://pingu-smart-plug-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// =====================================================
// PATH FIREBASE (TIDAK DIUBAH)
// =====================================================
const FB_PATH = {
    RELAY_V1: "/relay/v1"
};

// =====================================================
// IMPOR FIREBASE SDK MODULAR (TIDAK DIUBAH)
// =====================================================
import { initializeApp } from "firebase/app";
import { 
    getDatabase, 
    ref, 
    onValue, 
    set,
} from "firebase/database";

// =====================================================
// IMPOR MODUL TAMBAHAN
// =====================================================
import { initVoiceAssistant, isAssistantActiveState, stopAssistant } from './voice-assistant.js';

// =====================================================
// INISIALISASI FIREBASE (TIDAK DIUBAH)
// =====================================================
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// =====================================================
// DOM REFERENSI
// =====================================================
const elements = {
    // Navigation
    navStatusDot: document.getElementById("navStatusDot"),
    navStatusText: document.getElementById("navStatusText"),
    navMenuBtn: document.getElementById("navMenuBtn"),
    navLinks: document.querySelector(".nav-links"),
    navLinksAll: document.querySelectorAll(".nav-link"),
    
    // Hero
    heroStatStatus: document.getElementById("heroStatStatus"),
    heroStatRelay: document.getElementById("heroStatRelay"),
    heroStatUptime: document.getElementById("heroStatUptime"),
    heroModelStatusText: document.getElementById("heroModelStatusText"),
    heroCtaVoice: document.getElementById("heroCtaVoice"),
    heroCtaControl: document.getElementById("heroCtaControl"),
    
    // Pingu 2D
    pinguImage: document.getElementById("pinguImage"),
    pinguGlow: document.getElementById("pinguGlow"),
    
    // Relay
    relayToggle: document.getElementById("relayToggle"),
    relayStatus: document.getElementById("relayStatus"),
    relayStatusIcon: document.getElementById("relayStatusIcon"),
    relayProgressBar: document.getElementById("relayProgressBar"),
    relayBadge: document.getElementById("relayBadge"),
    
    // Device Info
    deviceIP: document.getElementById("deviceIP"),
    deviceMAC: document.getElementById("deviceMAC"),
    deviceFirmware: document.getElementById("deviceFirmware"),
    deviceRSSI: document.getElementById("deviceRSSI"),
    deviceVersion: document.getElementById("deviceVersion"),
    deviceUptime: document.getElementById("deviceUptime"),
    uptimeDisplay: document.getElementById("uptimeDisplay"),
    latencyDisplay: document.getElementById("latencyDisplay"),
    
    // Voice Orb
    voiceOrb: document.getElementById("voiceOrb"),
    voiceOrbCore: document.getElementById("voiceOrbCore"),
    voiceOrbStatusText: document.getElementById("voiceOrbStatusText"),
    voiceOrbResultText: document.getElementById("assistantResultText"),
    assistantToggleBtn: document.getElementById("assistantToggleBtn"),
    assistantBtnText: document.getElementById("assistantBtnText"),
    orbParticles: document.getElementById("orbParticles"),
};

// =====================================================
// STATE APLIKASI
// =====================================================
const state = {
    currentStatus: null,
    isUpdating: false,
    isConnected: false,
    uptimeSeconds: 0,
    uptimeInterval: null,
    currentPage: 'home',
};

// =====================================================
// NAVIGATION
// =====================================================
function initNavigation() {
    // Nav links
    elements.navLinksAll.forEach(link => {
        link.addEventListener('click', () => {
            const page = link.dataset.page;
            navigateTo(page);
            closeMobileMenu();
        });
    });
    
    // Mobile menu toggle
    elements.navMenuBtn.addEventListener('click', () => {
        elements.navMenuBtn.classList.toggle('active');
        elements.navLinks.classList.toggle('open');
    });
    
    // Hero CTA buttons
    elements.heroCtaVoice.addEventListener('click', () => {
        navigateTo('voice');
    });
    
    elements.heroCtaControl.addEventListener('click', () => {
        navigateTo('control');
    });
}

function navigateTo(page) {
    // Update nav links
    elements.navLinksAll.forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    state.currentPage = page;
    
    // Re-trigger animations
    const activePage = document.getElementById(`page-${page}`);
    if (activePage) {
        activePage.style.animation = 'none';
        requestAnimationFrame(() => {
            activePage.style.animation = '';
        });
    }
}

function closeMobileMenu() {
    elements.navMenuBtn.classList.remove('active');
    elements.navLinks.classList.remove('open');
}

// =====================================================
// VOICE ORB - PARTICLES
// =====================================================
function createOrbParticles() {
    if (!elements.orbParticles) return;
    
    elements.orbParticles.innerHTML = '';
    const count = 20;
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'orb-particle';
        
        const angle = (i / count) * Math.PI * 2;
        const radius = 60 + Math.random() * 40;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius;
        
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        particle.style.animationDelay = `${Math.random() * 4}s`;
        particle.style.width = `${2 + Math.random() * 4}px`;
        particle.style.height = particle.style.width;
        
        elements.orbParticles.appendChild(particle);
    }
}

// =====================================================
// UPDATE VOICE ORB STATUS
// =====================================================
export function updateVoiceOrbStatus(status, label) {
    if (!elements.voiceOrbCore) return;
    
    // Reset classes
    elements.voiceOrbCore.className = 'voice-orb-core';
    elements.voiceOrb.classList.remove('active');
    
    switch (status) {
        case 'OFF':
            elements.voiceOrbCore.classList.remove('listening', 'processing', 'speaking', 'error');
            elements.voiceOrbStatusText.textContent = 'Nonaktif';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text';
            break;
        case 'LISTENING_WAKEWORD':
            elements.voiceOrbCore.classList.add('listening');
            elements.voiceOrb.classList.add('active');
            elements.voiceOrbStatusText.textContent = 'Menunggu "Pingu"';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text listening';
            break;
        case 'LISTENING_COMMAND':
            elements.voiceOrbCore.classList.add('listening');
            elements.voiceOrb.classList.add('active');
            elements.voiceOrbStatusText.textContent = 'Mendengarkan perintah';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text listening';
            break;
        case 'PROCESSING_COMMAND':
            elements.voiceOrbCore.classList.add('processing');
            elements.voiceOrb.classList.add('active');
            elements.voiceOrbStatusText.textContent = 'Memproses...';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text processing';
            break;
        case 'PLAYING_AUDIO':
            elements.voiceOrbCore.classList.add('speaking');
            elements.voiceOrb.classList.add('active');
            elements.voiceOrbStatusText.textContent = 'Memutar suara...';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text speaking';
            break;
        case 'RESPONDING':
            elements.voiceOrbCore.classList.add('speaking');
            elements.voiceOrb.classList.add('active');
            elements.voiceOrbStatusText.textContent = 'Merespon...';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text speaking';
            break;
        case 'ERROR':
            elements.voiceOrbCore.classList.add('error');
            elements.voiceOrbStatusText.textContent = 'Error';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text error';
            break;
        default:
            elements.voiceOrbCore.classList.remove('listening', 'processing', 'speaking', 'error');
            elements.voiceOrbStatusText.textContent = label || 'Nonaktif';
            elements.voiceOrbStatusText.className = 'voice-orb-status-text';
    }
}

// =====================================================
// UPDATE PINGU 2D STATUS
// =====================================================
function updatePinguStatus(status) {
    const pinguImage = elements.pinguImage;
    const pinguGlow = elements.pinguGlow;
    
    if (!pinguImage) return;
    
    if (status === true) {
        // Relay ON - efek glow hijau
        pinguImage.style.filter = 'drop-shadow(0 0 30px rgba(34, 197, 94, 0.5)) brightness(1.1)';
        pinguImage.style.transform = 'scale(1.02)';
        if (pinguGlow) {
            pinguGlow.style.opacity = '0.8';
            pinguGlow.style.background = 'radial-gradient(circle, rgba(34, 197, 94, 0.3), transparent 70%)';
        }
    } else if (status === false) {
        // Relay OFF - normal
        pinguImage.style.filter = 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.15)) brightness(1)';
        pinguImage.style.transform = 'scale(1)';
        if (pinguGlow) {
            pinguGlow.style.opacity = '0.4';
            pinguGlow.style.background = 'radial-gradient(circle, rgba(0, 212, 255, 0.1), transparent 70%)';
        }
    } else {
        // Unknown - default
        pinguImage.style.filter = 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.1)) brightness(1)';
        pinguImage.style.transform = 'scale(1)';
    }
}

// =====================================================
// UPDATE RELAY UI
// =====================================================
function updateRelayUI(status) {
    if (status === true) {
        elements.relayStatus.textContent = "ON";
        elements.relayStatus.className = "control-status-value on";
        elements.relayStatusIcon.className = "control-status-icon on";
        elements.relayProgressBar.className = "control-progress-bar on";
        elements.relayToggle.classList.add("active");
        elements.relayToggle.setAttribute("aria-checked", "true");
        
        // Hero stat
        if (elements.heroStatRelay) {
            elements.heroStatRelay.textContent = "ON";
            elements.heroStatRelay.style.color = "var(--success)";
        }
    } else if (status === false) {
        elements.relayStatus.textContent = "OFF";
        elements.relayStatus.className = "control-status-value off";
        elements.relayStatusIcon.className = "control-status-icon off";
        elements.relayProgressBar.className = "control-progress-bar off";
        elements.relayToggle.classList.remove("active");
        elements.relayToggle.setAttribute("aria-checked", "false");
        
        if (elements.heroStatRelay) {
            elements.heroStatRelay.textContent = "OFF";
            elements.heroStatRelay.style.color = "var(--danger)";
        }
    } else {
        elements.relayStatus.textContent = "---";
        elements.relayStatus.className = "control-status-value";
        elements.relayStatusIcon.className = "control-status-icon";
        elements.relayProgressBar.className = "control-progress-bar";
        elements.relayToggle.classList.remove("active");
        elements.relayToggle.setAttribute("aria-checked", "false");
        
        if (elements.heroStatRelay) {
            elements.heroStatRelay.textContent = "---";
            elements.heroStatRelay.style.color = "rgba(255,255,255,0.4)";
        }
    }
    
    // Update Pingu 2D
    updatePinguStatus(status);
    
    // Update hero model status
    if (elements.heroModelStatusText) {
        if (status === true) {
            elements.heroModelStatusText.textContent = 'Relay ON';
            elements.heroModelStatusText.style.color = 'var(--success)';
        } else if (status === false) {
            elements.heroModelStatusText.textContent = 'Relay OFF';
            elements.heroModelStatusText.style.color = 'var(--danger)';
        } else {
            elements.heroModelStatusText.textContent = 'Waiting...';
            elements.heroModelStatusText.style.color = 'rgba(255,255,255,0.5)';
        }
    }
    
    state.currentStatus = status;
}

// =====================================================
// UPDATE CONNECTION STATUS
// =====================================================
function updateConnectionStatus(connected) {
    state.isConnected = connected;
    
    // Nav status
    const dot = elements.navStatusDot;
    const text = elements.navStatusText;
    
    if (connected) {
        dot.className = "nav-status-dot online";
        text.textContent = "Terhubung";
        
        if (elements.heroStatStatus) {
            elements.heroStatStatus.textContent = "Online";
            elements.heroStatStatus.style.color = "var(--success)";
        }
        
        if (elements.heroModelStatusText) {
            elements.heroModelStatusText.style.color = 'var(--success)';
        }
        
        // Hero 3D status dot
        const statusDot = document.querySelector('.hero-3d-status-dot');
        if (statusDot) statusDot.className = 'hero-3d-status-dot';
    } else {
        dot.className = "nav-status-dot offline";
        text.textContent = "Terputus";
        
        if (elements.heroStatStatus) {
            elements.heroStatStatus.textContent = "Offline";
            elements.heroStatStatus.style.color = "var(--danger)";
        }
        
        if (elements.heroModelStatusText) {
            elements.heroModelStatusText.textContent = 'Disconnected';
            elements.heroModelStatusText.style.color = 'var(--danger)';
        }
        
        const statusDot = document.querySelector('.hero-3d-status-dot');
        if (statusDot) statusDot.className = 'hero-3d-status-dot offline';
    }
    
    // Enable/disable relay toggle
    elements.relayToggle.disabled = !connected;
    elements.relayToggle.style.opacity = connected ? '1' : '0.5';
}

// =====================================================
// LISTEN RELAY STATUS (TIDAK DIUBAH)
// =====================================================
function listenRelayStatus() {
    const relayRef = ref(database, FB_PATH.RELAY_V1);

    onValue(relayRef, (snapshot) => {
        const value = snapshot.val();

        if (snapshot.exists()) {
            if (typeof value === "boolean") {
                updateRelayUI(value);
                console.log(`📡 Status relay dari Firebase: ${value ? "ON" : "OFF"}`);
                updateConnectionStatus(true);
            } else {
                console.warn("⚠️ Data relay bukan boolean:", value);
                updateRelayUI(null);
            }
        } else {
            console.warn("⚠️ Node relay belum ada, membuat default false...");
            set(relayRef, false)
                .then(() => {
                    console.log("✅ Default relay dibuat: OFF");
                    updateRelayUI(false);
                })
                .catch((error) => {
                    console.error("❌ Gagal membuat default relay:", error);
                    updateRelayUI(null);
                });
        }
    }, (error) => {
        console.error("❌ Error mendengarkan Firebase:", error);
        updateConnectionStatus(false);
        updateRelayUI(null);
    });
}

// =====================================================
// SET RELAY STATUS (TIDAK DIUBAH)
// =====================================================
async function setRelayStatus(status) {
    if (state.isUpdating) {
        console.warn("⏳ Update sedang berlangsung, tunggu...");
        return;
    }

    if (status === state.currentStatus) {
        console.log(`ℹ️ Relay sudah ${status ? "ON" : "OFF"}, tidak ada perubahan`);
        return;
    }

    state.isUpdating = true;
    elements.relayToggle.disabled = true;

    try {
        const relayRef = ref(database, FB_PATH.RELAY_V1);
        await set(relayRef, status);
        console.log(`✅ Relay berhasil diubah menjadi: ${status ? "ON" : "OFF"}`);
    } catch (error) {
        console.error("❌ Gagal mengubah status relay:", error);
    } finally {
        state.isUpdating = false;
        if (state.isConnected) {
            elements.relayToggle.disabled = false;
        }
    }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

// Relay Toggle
elements.relayToggle.addEventListener("click", () => {
    const currentState = state.currentStatus;
    const newState = currentState === true ? false : true;
    setRelayStatus(newState);
});

elements.relayToggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.relayToggle.click();
    }
});

// =====================================================
// UPDATE UPTIME
// =====================================================
function startUptimeCounter() {
    state.uptimeSeconds = 0;
    
    if (state.uptimeInterval) {
        clearInterval(state.uptimeInterval);
    }
    
    state.uptimeInterval = setInterval(() => {
        state.uptimeSeconds++;
        
        const hours = Math.floor(state.uptimeSeconds / 3600);
        const minutes = Math.floor((state.uptimeSeconds % 3600) / 60);
        const seconds = state.uptimeSeconds % 60;
        
        const uptimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Update all uptime displays
        if (elements.uptimeDisplay) {
            elements.uptimeDisplay.textContent = uptimeStr;
        }
        if (elements.heroStatUptime) {
            elements.heroStatUptime.textContent = uptimeStr;
        }
    }, 1000);
}

// =====================================================
// UPDATE DEVICE INFO
// =====================================================
function updateDeviceInfo() {
    const mockData = {
        ip: '192.168.1.100',
        mac: 'AA:BB:CC:DD:EE:FF',
        firmware: 'v2.4.1',
        rssi: '-45 dBm',
        version: '1.0.0',
        uptime: '2d 14h 32m'
    };
    
    if (elements.deviceIP) elements.deviceIP.textContent = mockData.ip;
    if (elements.deviceMAC) elements.deviceMAC.textContent = mockData.mac;
    if (elements.deviceFirmware) elements.deviceFirmware.textContent = mockData.firmware;
    if (elements.deviceRSSI) elements.deviceRSSI.textContent = mockData.rssi;
    if (elements.deviceVersion) elements.deviceVersion.textContent = mockData.version;
    if (elements.deviceUptime) elements.deviceUptime.textContent = mockData.uptime;
    
    if (elements.latencyDisplay) {
        const latency = Math.floor(Math.random() * 30) + 20;
        elements.latencyDisplay.textContent = `< ${latency}ms`;
    }
}

// =====================================================
// HANDLE VOICE COMMAND
// =====================================================
function handleVoiceCommand(command) {
    console.log(`🎤 Voice command diterima: ${command}`);
    
    const lower = command.toLowerCase().trim();
    
    if (lower.includes('nyalakan') && lower.includes('v1')) {
        console.log('🔊 Eksekusi: Nyalakan Relay V1');
        setRelayStatus(true);
    } else if (lower.includes('matikan') && lower.includes('v1')) {
        console.log('🔊 Eksekusi: Matikan Relay V1');
        setRelayStatus(false);
    } else {
        console.warn(`⚠️ Perintah tidak dikenali: ${command}`);
    }
}

// =====================================================
// INITIALIZATION
// =====================================================
async function init() {
    console.log("🚀 PINGU SMART HOME - Premium Dashboard");
    console.log("📡 Menghubungkan ke Firebase Realtime Database...");

    // Setup navigation
    initNavigation();
    
    // Create orb particles
    createOrbParticles();

    // Set initial state
    updateRelayUI(null);
    updateConnectionStatus(false);

    // Initialize Pingu 2D
    try {
        const pinguImage = elements.pinguImage;
        if (pinguImage) {
            updatePinguStatus(null);
            console.log("✅ Pingu 2D berhasil dimuat");
        }
    } catch (error) {
        console.error("❌ Gagal memuat Pingu 2D:", error);
    }

    // Initialize Voice Assistant
    try {
        await initVoiceAssistant({
            onCommand: handleVoiceCommand,
            onStatusUpdate: (state, label) => {
                console.log(`🗣️ Assistant state: ${state} - ${label}`);
                updateVoiceOrbStatus(state, label);
            }
        });
        console.log("✅ Voice Assistant berhasil diinisialisasi");
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Voice Assistant:", error);
    }

    // Listen to Firebase
    listenRelayStatus();

    // Start uptime counter
    startUptimeCounter();

    // Update device info
    updateDeviceInfo();
    setInterval(updateDeviceInfo, 30000);

    // Fallback connection check
    setTimeout(() => {
        if (!state.isConnected) {
            const testRef = ref(database, "/");
            onValue(testRef, () => {
                updateConnectionStatus(true);
            }, () => {
                updateConnectionStatus(false);
            }, { onlyOnce: true });
        }
    }, 3000);

    console.log("✅ Dashboard siap digunakan");
}

// =====================================================
// HANDLE UNLOAD
// =====================================================
window.addEventListener("beforeunload", () => {
    if (state.uptimeInterval) {
        clearInterval(state.uptimeInterval);
    }
    try {
        stopAssistant();
    } catch (e) {
        // Ignore
    }
    console.log("👋 Menutup koneksi...");
});

// =====================================================
// JALANKAN INISIALISASI
// =====================================================
init();