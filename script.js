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
    update,
    child,
    push
} from "firebase/database";

// =====================================================
// IMPOR MODUL TAMBAHAN (PATH DIPERBARUI)
// =====================================================
import { initThree, updateModelRelayStatus } from './three-setup.js';
import { initVoiceCommand } from './voice-command.js';
import { showNotification, initNotifications } from './notifications.js';

// =====================================================
// INISIALISASI FIREBASE (TIDAK DIUBAH)
// =====================================================
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// =====================================================
// DOM REFERENSI (DIPERBARUI UNTUK ELEMEN BARU)
// =====================================================
const elements = {
    // Existing
    relayStatus: document.getElementById("relayStatus"),
    statusIndicator: document.getElementById("statusIndicator"),
    btnOn: document.getElementById("btnOn"),
    btnOff: document.getElementById("btnOff"),
    connectionStatus: document.getElementById("connectionStatus"),
    
    // New
    relayToggle: document.getElementById("relayToggle"),
    relayStatusIcon: document.getElementById("relayStatusIcon"),
    relayProgressBar: document.getElementById("relayProgressBar"),
    relayBadge: document.getElementById("relayBadge"),
    statusCircle: document.getElementById("statusCircle"),
    deviceStatusLabel: document.getElementById("deviceStatusLabel"),
    modelStatusText: document.getElementById("modelStatusText"),
    // Device Info
    deviceIP: document.getElementById("deviceIP"),
    deviceMAC: document.getElementById("deviceMAC"),
    deviceFirmware: document.getElementById("deviceFirmware"),
    deviceRSSI: document.getElementById("deviceRSSI"),
    deviceVersion: document.getElementById("deviceVersion"),
    deviceUptime: document.getElementById("deviceUptime"),
    uptimeDisplay: document.getElementById("uptimeDisplay"),
    latencyDisplay: document.getElementById("latencyDisplay"),
};

// =====================================================
// STATE APLIKASI (DIPERBARUI)
// =====================================================
const state = {
    currentStatus: null,
    isUpdating: false,
    isConnected: false,
    uptimeSeconds: 0,
    uptimeInterval: null,
    threeInitialized: false,
};

// =====================================================
// FUNGSI UI - UPDATE STATUS (DIPERBARUI)
// =====================================================
function updateUI(status) {
    // Update status text (existing logic)
    if (status === true) {
        elements.relayStatus.textContent = "ON";
        elements.relayStatus.className = "relay-value on";
        elements.relayStatusIcon.className = "relay-status-icon on";
        elements.relayProgressBar.className = "relay-progress-bar on";
        elements.relayToggle.classList.add("active");
        elements.relayToggle.setAttribute("aria-checked", "true");
    } else if (status === false) {
        elements.relayStatus.textContent = "OFF";
        elements.relayStatus.className = "relay-value off";
        elements.relayStatusIcon.className = "relay-status-icon off";
        elements.relayProgressBar.className = "relay-progress-bar off";
        elements.relayToggle.classList.remove("active");
        elements.relayToggle.setAttribute("aria-checked", "false");
    } else {
        elements.relayStatus.textContent = "---";
        elements.relayStatus.className = "relay-value";
        elements.relayStatusIcon.className = "relay-status-icon";
        elements.relayProgressBar.className = "relay-progress-bar";
    }

    // Update 3D model
    if (state.threeInitialized) {
        updateModelRelayStatus(status);
    }

    // Update model status text
    if (status === true) {
        elements.modelStatusText.textContent = '● Relay ON';
        elements.modelStatusText.className = 'model-status-text';
    } else if (status === false) {
        elements.modelStatusText.textContent = '● Relay OFF';
        elements.modelStatusText.className = 'model-status-text';
    } else {
        elements.modelStatusText.textContent = '● Waiting...';
        elements.modelStatusText.className = 'model-status-text';
    }

    state.currentStatus = status;
}

// =====================================================
// FUNGSI UI - UPDATE KONEKSI (DIPERBARUI)
// =====================================================
function updateConnectionStatus(connected) {
    state.isConnected = connected;
    const badge = elements.connectionStatus;
    const dot = badge.querySelector(".dot");
    const text = badge.querySelector("span:last-child");

    if (connected) {
        badge.className = "status-badge online";
        dot.style.background = "var(--success)";
        text.textContent = "Terhubung";
        elements.statusCircle.className = "status-circle";
        elements.deviceStatusLabel.textContent = "Online";
        elements.deviceStatusLabel.className = "status-label-text";
        elements.modelStatusText.className = "model-status-text";
        showNotification('info', 'Terhubung', 'Firebase Realtime Database terhubung');
    } else {
        badge.className = "status-badge offline";
        dot.style.background = "var(--danger)";
        text.textContent = "Terputus";
        elements.statusCircle.className = "status-circle offline";
        elements.deviceStatusLabel.textContent = "Offline";
        elements.deviceStatusLabel.className = "status-label-text offline";
        elements.modelStatusText.className = "model-status-text offline";
        elements.modelStatusText.textContent = '● Disconnected';
        showNotification('error', 'Terputus', 'Koneksi ke Firebase terputus');
    }

    // Enable/disable relay toggle
    elements.relayToggle.disabled = !connected;
    elements.relayToggle.style.opacity = connected ? '1' : '0.5';
}

// =====================================================
// FUNGSI - BACA RELAY DARI FIREBASE (TIDAK DIUBAH)
// =====================================================
function listenRelayStatus() {
    const relayRef = ref(database, FB_PATH.RELAY_V1);

    onValue(relayRef, (snapshot) => {
        const value = snapshot.val();

        if (snapshot.exists()) {
            if (typeof value === "boolean") {
                updateUI(value);
                console.log(`📡 Status relay dari Firebase: ${value ? "ON" : "OFF"}`);
                updateConnectionStatus(true);
                
                if (value === true) {
                    showNotification('success', 'Relay ON', 'Perangkat dinyalakan');
                } else {
                    showNotification('info', 'Relay OFF', 'Perangkat dimatikan');
                }
            } else {
                console.warn("⚠️ Data relay bukan boolean:", value);
                updateUI(null);
            }
        } else {
            console.warn("⚠️ Node relay belum ada, membuat default false...");
            set(relayRef, false)
                .then(() => {
                    console.log("✅ Default relay dibuat: OFF");
                    updateUI(false);
                })
                .catch((error) => {
                    console.error("❌ Gagal membuat default relay:", error);
                    updateUI(null);
                });
        }
    }, (error) => {
        console.error("❌ Error mendengarkan Firebase:", error);
        updateConnectionStatus(false);
        updateUI(null);
    });
}

// =====================================================
// FUNGSI - KONTROL RELAY (DIPERBARUI DENGAN TOGGLE)
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
        showNotification('error', 'Gagal', 'Gagal mengubah status relay');
    } finally {
        state.isUpdating = false;
        if (state.isConnected) {
            elements.relayToggle.disabled = false;
        }
    }
}

// =====================================================
// EVENT HANDLERS (DIPERBARUI)
// =====================================================

// Toggle Switch
elements.relayToggle.addEventListener("click", () => {
    const currentState = state.currentStatus;
    const newState = currentState === true ? false : true;
    setRelayStatus(newState);
});

// Keyboard support for toggle
elements.relayToggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.relayToggle.click();
    }
});

// =====================================================
// FUNGSI - UPDATE UPTIME
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
        
        if (elements.uptimeDisplay) {
            elements.uptimeDisplay.textContent = uptimeStr;
        }
    }, 1000);
}

// =====================================================
// FUNGSI - UPDATE DEVICE INFO (SIMULASI)
// =====================================================
function updateDeviceInfo() {
    // Simulasi data device - bisa diganti dengan data dari Firebase nantinya
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
    
    // Simulasi latency
    if (elements.latencyDisplay) {
        const latency = Math.floor(Math.random() * 30) + 20;
        elements.latencyDisplay.textContent = `< ${latency}ms`;
    }
}

// =====================================================
// INISIALISASI (DIPERBARUI)
// =====================================================
async function init() {
    console.log("🚀 PINGU SMART PLUG - Dashboard Premium");
    console.log("📡 Menghubungkan ke Firebase Realtime Database...");

    // Set initial loading state
    updateUI(null);
    updateConnectionStatus(false);

    // Initialize Three.js
    try {
        const canvasContainer = document.getElementById('three-canvas');
        if (canvasContainer) {
            const three = await initThree(canvasContainer);
            state.threeInitialized = true;
            console.log("✅ Three.js berhasil diinisialisasi");
            
            // Update model with initial state
            setTimeout(() => {
                if (state.currentStatus !== null) {
                    updateModelRelayStatus(state.currentStatus);
                }
            }, 1000);
        }
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Three.js:", error);
    }

    // Initialize Voice Command
    try {
        await initVoiceCommand({
            onCommand: (command) => {
                console.log(`🎤 Voice command: ${command}`);
                const lower = command.toLowerCase().trim();
                
                // Cek perintah ON
                if (lower.includes('nyalakan') || lower.includes('hidupkan') || lower.includes('aktifkan')) {
                    if (lower.includes('v1') || lower.includes('relay')) {
                        setRelayStatus(true);
                        showNotification('success', 'Voice Command', 'Memerintahkan: Nyalakan V1');
                    }
                }
                // Cek perintah OFF
                else if (lower.includes('matikan') || lower.includes('nonaktifkan')) {
                    if (lower.includes('v1') || lower.includes('relay')) {
                        setRelayStatus(false);
                        showNotification('info', 'Voice Command', 'Memerintahkan: Matikan V1');
                    }
                }
            }
        });
        console.log("✅ Voice Command berhasil diinisialisasi");
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Voice Command:", error);
    }

    // Initialize Notifications
    initNotifications();

    // Mulai mendengarkan Firebase
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
    console.log("👋 Menutup koneksi...");
});

// =====================================================
// JALANKAN INISIALISASI
// =====================================================
init();