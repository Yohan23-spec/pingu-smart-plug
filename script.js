// =====================================================
// KONFIGURASI FIREBASE
// =====================================================
const firebaseConfig = {
    apiKey: "AIzaSyAQH4jcohVU3cfPAuWjNsHQpI78h8avb14",
    databaseURL: "https://pingu-smart-plug-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// =====================================================
// PATH FIREBASE (SESUAI DENGAN SOURCE CODE ARDUINO)
// =====================================================
const FB_PATH = {
    RELAY_V1: "/relay/v1"
};

// =====================================================
// IMPOR FIREBASE SDK MODULAR
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
// INISIALISASI FIREBASE
// =====================================================
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// =====================================================
// DOM REFERENSI
// =====================================================
const elements = {
    relayStatus: document.getElementById("relayStatus"),
    statusIndicator: document.getElementById("statusIndicator"),
    btnOn: document.getElementById("btnOn"),
    btnOff: document.getElementById("btnOff"),
    connectionStatus: document.getElementById("connectionStatus")
};

// =====================================================
// STATE APLIKASI
// =====================================================
const state = {
    currentStatus: null, // true = ON, false = OFF, null = loading
    isUpdating: false,
    isConnected: false
};

// =====================================================
// FUNGSI UI - UPDATE STATUS
// =====================================================
function updateUI(status) {
    // Update status text
    if (status === true) {
        elements.relayStatus.textContent = "ON";
        elements.relayStatus.className = "status-value on";
        elements.statusIndicator.className = "status-indicator on";
    } else if (status === false) {
        elements.relayStatus.textContent = "OFF";
        elements.relayStatus.className = "status-value off";
        elements.statusIndicator.className = "status-indicator off";
    } else {
        elements.relayStatus.textContent = "---";
        elements.relayStatus.className = "status-value loading";
        elements.statusIndicator.className = "status-indicator loading";
    }

    // Update tombol (highlight tombol yang aktif)
    elements.btnOn.className = "btn btn-on";
    elements.btnOff.className = "btn btn-off";

    if (status === true) {
        elements.btnOn.classList.add("active");
    } else if (status === false) {
        elements.btnOff.classList.add("active");
    }

    // Update state
    state.currentStatus = status;
}

// =====================================================
// FUNGSI UI - UPDATE KONEKSI
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
    } else {
        badge.className = "status-badge offline";
        dot.style.background = "var(--danger)";
        text.textContent = "Terputus";
    }

    // Enable/disable tombol berdasarkan koneksi
    elements.btnOn.disabled = !connected;
    elements.btnOff.disabled = !connected;
}

// =====================================================
// FUNGSI - BACA RELAY DARI FIREBASE (REALTIME)
// =====================================================
function listenRelayStatus() {
    const relayRef = ref(database, FB_PATH.RELAY_V1);

    // Gunakan onValue untuk realtime listener
    onValue(relayRef, (snapshot) => {
        const value = snapshot.val();

        // Cek apakah data ada dan berupa boolean
        if (snapshot.exists()) {
            if (typeof value === "boolean") {
                updateUI(value);
                console.log(`📡 Status relay dari Firebase: ${value ? "ON" : "OFF"}`);
                updateConnectionStatus(true);
            } else {
                console.warn("⚠️ Data relay bukan boolean:", value);
                updateUI(null);
            }
        } else {
            // Node belum ada, set default false
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
// FUNGSI - KONTROL RELAY VIA FIREBASE
// =====================================================
async function setRelayStatus(status) {
    // Cegah update ganda
    if (state.isUpdating) {
        console.warn("⏳ Update sedang berlangsung, tunggu...");
        return;
    }

    // Cek apakah status sudah sama
    if (status === state.currentStatus) {
        console.log(`ℹ️ Relay sudah ${status ? "ON" : "OFF"}, tidak ada perubahan`);
        return;
    }

    state.isUpdating = true;

    // Disable tombol sementara
    elements.btnOn.disabled = true;
    elements.btnOff.disabled = true;

    try {
        const relayRef = ref(database, FB_PATH.RELAY_V1);
        await set(relayRef, status);
        
        console.log(`✅ Relay berhasil diubah menjadi: ${status ? "ON" : "OFF"}`);
        
        // UI akan ter-update otomatis oleh listener onValue
    } catch (error) {
        console.error("❌ Gagal mengubah status relay:", error);
        // Tampilkan error ke user (opsional)
    } finally {
        state.isUpdating = false;
        // Enable tombol kembali (jika terhubung)
        if (state.isConnected) {
            elements.btnOn.disabled = false;
            elements.btnOff.disabled = false;
        }
    }
}

// =====================================================
// EVENT HANDLERS
// =====================================================
// Tombol ON
elements.btnOn.addEventListener("click", () => {
    setRelayStatus(true);
});

// Tombol OFF
elements.btnOff.addEventListener("click", () => {
    setRelayStatus(false);
});

// =====================================================
// INISIALISASI
// =====================================================
function init() {
    console.log("🚀 PINGU SMART PLUG - Website Controller");
    console.log("📡 Menghubungkan ke Firebase Realtime Database...");

    // Set initial loading state
    updateUI(null);
    updateConnectionStatus(false);

    // Mulai mendengarkan perubahan dari Firebase
    listenRelayStatus();

    // Set status koneksi setelah beberapa detik jika tidak ada perubahan
    // (ini hanya fallback, akan di-update oleh listener)
    setTimeout(() => {
        if (!state.isConnected) {
            // Cek koneksi dengan membaca referensi
            const testRef = ref(database, "/");
            onValue(testRef, () => {
                updateConnectionStatus(true);
            }, () => {
                updateConnectionStatus(false);
            }, { onlyOnce: true });
        }
    }, 3000);
}

// Jalankan inisialisasi
init();

// =====================================================
// HANDLE UNLOAD (Cleanup)
// =====================================================
window.addEventListener("beforeunload", () => {
    // Firebase onValue akan otomatis di-cancel saat page unload
    console.log("👋 Menutup koneksi...");
});

// =====================================================
// DEBUG (Opsional - Hapus di production)
// =====================================================
console.log("📋 Firebase Path yang digunakan:");
console.log(`   RELAY V1: ${FB_PATH.RELAY_V1}`);
console.log("📋 Struktur Database:");
console.log(`   ${FB_PATH.RELAY_V1} : boolean (true=ON, false=OFF)`);
console.log("📋 Status: Menunggu koneksi...");