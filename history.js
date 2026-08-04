/* ── Theme Boot (runs before DOM paint) ── */
(function(){
    const K = [
        '--accent','--accent-light','--accent-dark','--accent-rgb',
        '--accent-glow','--accent-subtle','--bg-gradient',
        '--glass-bg','--glass-border','--text-primary','--text-secondary',
        '--sidebar-bg','--sidebar-border','--sidebar-brand-text','--nav-text'
    ];
    const T = {
        ocean: [
            '#0284c7', '#38bdf8', '#0369a1', '2,132,199',
            'rgba(2,132,199,0.22)', 'rgba(2,132,199,0.08)',
            'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
            'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.45)',
            '#0c4a6e', '#475569',
            'rgba(240,249,255,0.88)', '#bae6fd', '#0284c7', '#0c4a6e'
        ],
        forest: [
            '#2e7d32', '#4caf50', '#1b5e20', '46,125,50',
            'rgba(46,125,50,0.22)', 'rgba(46,125,50,0.08)',
            'linear-gradient(135deg, #f4fbf7 0%, #e8f5e9 50%, #c8e6c9 100%)',
            'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.45)',
            '#1b5e20', '#388e3c',
            'rgba(244,251,247,0.88)', '#c8e6c9', '#2e7d32', '#1b5e20'
        ],
        coral: [
            '#e65100', '#ff9800', '#bf360c', '230,81,0',
            'rgba(230,81,0,0.22)', 'rgba(230,81,0,0.08)',
            'linear-gradient(135deg, #fff8f5 0%, #fff0e6 50%, #ffe0b2 100%)',
            'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.45)',
            '#bf360c', '#e64a19',
            'rgba(255,248,245,0.88)', '#ffccbc', '#e65100', '#bf360c'
        ]
    };
    let n = localStorage.getItem('hydroTheme') || 'ocean';
    if (!T[n]) { n = 'ocean'; localStorage.setItem('hydroTheme', 'ocean'); }
    const v = T[n];
    const r = document.documentElement.style;
    K.forEach((k, i) => r.setProperty(k, v[i]));
})();

/* ── Standalone config ── */
var API_URL = (window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:5000';
var token   = localStorage.getItem('token');

/* ── App state ── */
var isDataReady = false;
var data = {
    username: 'Loading...',
    goal: 2500,
    intake: 0,
    history: {},
    currentLogs: [],
    notes: {}
};

/* ── Date helpers ── */
function getLocalDateString(d) {
    d = d || new Date();
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + dy;
}
const todayISO    = getLocalDateString();
var   selectedDate = todayISO;

/* ── Time-of-day theme helper ── */
function updateTheme() {
    const hr = new Date().getHours();
    const b  = document.body;
    b.classList.remove('theme-morning','theme-day','theme-evening','theme-night');
    if      (hr >= 6  && hr < 10) b.classList.add('theme-morning');
    else if (hr >= 10 && hr < 16) b.classList.add('theme-day');
    else if (hr >= 16 && hr < 18) b.classList.add('theme-evening');
    else                           b.classList.add('theme-night');
}

/* ── localStorage cache ── */
function saveLocalCache(userData) {
    try {
        localStorage.setItem('hydro_data_cache', JSON.stringify(userData));
        localStorage.setItem('hydro_update_ts',  Date.now().toString());
        if (_hydroBC) _hydroBC.postMessage({ type: 'DATA_UPDATED', userData });
    } catch(e) {}
}

function loadLocalCache() {
    try {
        const raw = localStorage.getItem('hydro_data_cache');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username && parsed.username !== 'Loading...') {
            data        = parsed;
            isDataReady = true;
            return true;
        }
    } catch(e) {}
    return false;
}

/* ── BroadcastChannel (for live two-tab updates when Home is open) ── */
var _hydroBC = null;
try { _hydroBC = new BroadcastChannel('hydrotrack_channel'); } catch(e) {}

if (_hydroBC) {
    _hydroBC.onmessage = function(event) {
        if (event.data && event.data.type === 'DATA_UPDATED') {
            // Home page just logged water — merge and re-render
            const incoming = event.data.userData;
            if (incoming) {
                data        = incoming;
                isDataReady = true;
                loadDateStats();
            }
        }
    };
}

/* ── storage event: fires when Home page writes to localStorage in another tab ── */
window.addEventListener('storage', function(event) {
    if (event.key === 'hydro_update_ts') {
        if (loadLocalCache()) loadDateStats();
    }
});

/* ── Cloud sync (for notes save) ── */
async function syncToCloud() {
    if (!isDataReady) return;
    try {
        await fetch(API_URL + '/api/user/sync', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token, userData: data })
        });
    } catch(e) { console.error('Cloud sync failed', e); }
}

window.addEventListener('DOMContentLoaded', () => {
    if (typeof updateTheme === 'function') updateTheme(); 

    const picker = document.getElementById('calendar-picker');
    if (picker) {
        picker.value = todayISO;  // Force the input to show today
        picker.max = todayISO;    // Disable selection of future dates
    }

    // ── Instant username from cache or JWT token (avoids flashing "User") ──
    const userDisplay = document.getElementById('username-display');
    const avatar = document.getElementById('user-initial');

    // Try cache first
    const cachedRaw = localStorage.getItem('hydro_data_cache');
    let cachedName = null;
    try {
        const cachedObj = JSON.parse(cachedRaw);
        if (cachedObj && cachedObj.username && cachedObj.username !== 'Loading...') {
            cachedName = cachedObj.username;
        }
    } catch(e) {}

    // Fallback: decode JWT payload for the username
    if (!cachedName && token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload && (payload.username || payload.name)) {
                cachedName = payload.username || payload.name;
            }
        } catch(e) {}
    }

    if (cachedName) {
        if (userDisplay) userDisplay.innerText = cachedName.toUpperCase();
        if (avatar) avatar.innerText = cachedName[0].toUpperCase();
    }

    loadHistoryData(); 
});

// ── Re-read cache when user navigates back to this page (back button / bfcache) ──
window.addEventListener('pageshow', (event) => {
    // event.persisted = true means page was served from bfcache (back-forward cache)
    if (event.persisted) {
        if (loadLocalCache()) loadDateStats();
    }
});

// ── Re-read cache when tab becomes visible again (user switches back to this tab) ──
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (loadLocalCache()) loadDateStats();
    }
});

function toggleLogout() {
    const menu = document.getElementById('logout-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function toggleMobileLogout() {
    const menu = document.getElementById('mobile-logout-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function logout() {
    localStorage.clear(); 
    window.location.href = 'index.html';
}

// ── DELETE ACCOUNT MODAL LOGIC ──
function togglePassVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = '🙈';
    } else {
        input.type = 'password';
        btn.innerText = '👁️';
    }
}

function openDeleteAccountModal() {
    let modal = document.getElementById('delete-account-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'delete-account-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">
                    <span style="font-size: 1.8rem;">⚠️</span>
                    <h2>Delete Account</h2>
                </div>
                <p class="modal-warning">
                    This action is <strong>permanent</strong> and cannot be undone. All your water intake records, history, streaks, and settings will be permanently erased from the cloud.
                </p>
                <div class="modal-form">
                    <label>Current Password</label>
                    <div class="input-with-eye">
                        <input type="password" id="delete-pass-1" placeholder="Enter current password">
                        <button type="button" class="toggle-eye-btn" onclick="togglePassVisibility('delete-pass-1', this)" title="Show/Hide Password">👁️</button>
                    </div>
                    
                    <label>Confirm Password</label>
                    <div class="input-with-eye">
                        <input type="password" id="delete-pass-2" placeholder="Re-enter password to confirm">
                        <button type="button" class="toggle-eye-btn" onclick="togglePassVisibility('delete-pass-2', this)" title="Show/Hide Password">👁️</button>
                    </div>
                    
                    <div id="delete-account-err" class="modal-err" style="display:none;"></div>
                </div>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeDeleteAccountModal()">Cancel</button>
                    <button class="btn-danger" id="confirm-delete-btn" onclick="confirmDeleteAccount()">Delete Permanently</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    const p1 = document.getElementById('delete-pass-1');
    const p2 = document.getElementById('delete-pass-2');
    if (p1) { p1.value = ''; p1.type = 'password'; }
    if (p2) { p2.value = ''; p2.type = 'password'; }
    
    const eyeBtns = modal.querySelectorAll('.toggle-eye-btn');
    eyeBtns.forEach(btn => btn.innerText = '👁️');

    const errDiv = document.getElementById('delete-account-err');
    if (errDiv) { errDiv.style.display = 'none'; errDiv.innerText = ''; }
    modal.style.display = 'flex';
}

function closeDeleteAccountModal() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) modal.style.display = 'none';
}

async function confirmDeleteAccount() {
    const pass1 = document.getElementById('delete-pass-1')?.value || '';
    const pass2 = document.getElementById('delete-pass-2')?.value || '';
    const errDiv = document.getElementById('delete-account-err');
    const confirmBtn = document.getElementById('confirm-delete-btn');

    if (!pass1 || !pass2) {
        if (errDiv) { errDiv.innerText = 'Please fill in both password fields.'; errDiv.style.display = 'block'; }
        return;
    }

    if (pass1 !== pass2) {
        if (errDiv) { errDiv.innerText = 'Passwords do not match.'; errDiv.style.display = 'block'; }
        return;
    }

    const currentToken = localStorage.getItem('token');
    if (!currentToken) return window.location.href = 'index.html';

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerText = 'Deleting...'; }
    if (errDiv) errDiv.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/api/auth/delete-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken, password: pass1, confirmPassword: pass2 })
        });

        const resData = await response.json();

        if (!response.ok) {
            if (errDiv) { errDiv.innerText = resData.error || 'Failed to delete account.'; errDiv.style.display = 'block'; }
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Delete Permanently'; }
            return;
        }

        // Successfully deleted
        localStorage.clear();
        alert('Your account has been permanently deleted.');
        window.location.href = 'index.html';

    } catch (err) {
        if (errDiv) { errDiv.innerText = 'Network error. Please try again.'; errDiv.style.display = 'block'; }
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerText = 'Delete Permanently'; }
    }
}

function loadDateStats() {
    const picker = document.getElementById('calendar-picker');
    if (picker && picker.value) {
        selectedDate = picker.value; 
    }

    const todayLocal = getLocalDateString();

    const dateLabel = document.getElementById('current-note-date');
    if (dateLabel) {
        dateLabel.innerText = "Viewing: " + selectedDate;
    }

    let displayVolume = 0;
    let dailyLogs = [];

    /* ============================================================
       1. DATA RETRIEVAL (Supports Today's live data & Past history)
    ============================================================ */
    if (selectedDate === todayLocal) {
        displayVolume = Number(data.intake) || 0;
        dailyLogs = data.currentLogs || [];
    } else {
        const historyEntry = data.history && data.history[selectedDate];

        if (historyEntry) {
            if (typeof historyEntry === "object") {
                displayVolume = Number(historyEntry.total) || 0;
                dailyLogs = Array.isArray(historyEntry.logs) ? historyEntry.logs : [];
            } else {
                displayVolume = Number(historyEntry) || 0;
                dailyLogs = [];
            }
        }
    }

    const dailyGoal = data.goal || 2500;
    const dailyPct = Math.round((displayVolume / dailyGoal) * 100);

    /* ============================================================
       2. HYDRATION RANK
    ============================================================ */
    const rankEl = document.getElementById('rank-display') || document.getElementById('total-days');
    if (rankEl) {
        let rank = "🌵 Desert Dweller";

        if (dailyPct >= 90) rank = "🔱 Ocean Master";
        else if (dailyPct >= 80) rank = "🛡️ Shield Guardian";
        else if (dailyPct >= 70) rank = "🏄 Wave Rider";
        else if (dailyPct >= 60) rank = "🌊 Current Commander"; 
        else if (dailyPct >= 50) rank = "🚣 River Guide";
        else if (dailyPct >= 40) rank = "🛶 Stream Sailor";
        else if (dailyPct >= 30) rank = "💧 Puddle Jumper";
        else if (dailyPct >= 20) rank = "🧊 Dew Dropper";
        else if (dailyPct >= 10) rank = "🌫️ Mist Seeker";

        rankEl.innerText = rank;
    }

    /* ============================================================
       3. GOAL MET
    ============================================================ */
    const goalMetEl = document.getElementById('goals-met');
    if (goalMetEl) {
        if (displayVolume >= dailyGoal) {
            goalMetEl.innerHTML = `<span style="color: #2e7d32; font-weight:700;">✅ Met</span>`;
        } else {
            goalMetEl.innerHTML = `<span style="color: #d32f2f; font-weight:700;">❌ Incomplete</span>`;
        }
    }

    /* ============================================================
       4. SUCCESS RATE %
    ============================================================ */
    const successEl = document.getElementById('success-pct');
    if (successEl) {
        successEl.innerText = dailyPct + "%";
    }

    /* ============================================================
       5. ANTI-WRINKLE SHIELD
    ============================================================ */
    const shieldEl = document.getElementById('shield-status') || document.getElementById('total-liters');
    if (shieldEl) {
        if (dailyPct >= 80) {
            shieldEl.innerHTML = `<span style="color: #2e7d32; font-weight:700;">ACTIVE ✨</span>`;
        } else {
            shieldEl.innerHTML = `<span style="color: #888; font-weight:700;">INACTIVE</span>`;
        }
    }

    /* ============================================================
       6. TIMELINE
    ============================================================ */
    const timelineContainer = document.getElementById('daily-timeline');

    if (timelineContainer) {
        timelineContainer.innerHTML = "";

        if (dailyLogs.length === 0) {
            timelineContainer.innerHTML = `
                <div style="text-align:center; padding: 30px; opacity:0.6;">
                    <div style="font-size: 32px; margin-bottom: 8px;">💧</div>
                    <p style="margin:0; font-size:14px;">No intake logged for ${selectedDate}.</p>
                </div>`;
        } else {
            [...dailyLogs].reverse().forEach(log => {
                const item = document.createElement('div');
                item.className = 'timeline-item';

                const val = log.ml || log.amount || 0;
                const timeStr = log.time || '--:--';

                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <span>🕒 ${timeStr}</span>
                        <strong style="color:var(--accent); font-size:1.1rem;">+${val} ml</strong>
                    </div>
                `;

                timelineContainer.appendChild(item);
            });
        }
    }

    /* ============================================================
       7. LOAD NOTES
    ============================================================ */
    const savedNotes = data.notes || {}; 
    const noteArea = document.getElementById('daily-note-area');
    if (noteArea) {
        noteArea.value = savedNotes[selectedDate] || "";
    }
}

async function loadHistoryData() {
    if (!token) return window.location.href = 'index.html';

    // ── Phase 1: Render INSTANTLY from local cache (0ms delay) ──
    const cachedLoaded = loadLocalCache();
    const userDisplay = document.getElementById('username-display');
    const avatar = document.getElementById('user-initial');

    if (cachedLoaded) {
        if (userDisplay && data.username) userDisplay.innerText = data.username.toUpperCase();
        if (avatar && data.username) avatar.innerText = data.username[0].toUpperCase();
        const mobileAvatar = document.getElementById('mobile-user-initial');
        if (mobileAvatar && data.username) mobileAvatar.innerText = data.username[0].toUpperCase();
        loadDateStats(); // Show whatever we have immediately
    }

    // ── Phase 2: Fetch fresh data from cloud ──
    try {
        const response = await fetch(`${API_URL}/api/user/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Unauthorized");

        const cloudData = await response.json();

        // ── SMART MERGE: Never let stale cloud overwrite fresh local data ──
        // The localStorage cache is written synchronously the moment user logs water.
        // The cloud sync is async and may lag behind. So for TODAY's intake & logs,
        // always keep whichever value is larger (local wins if it has more logs).
        const todayLocal = getLocalDateString();
        const cachedIntake = (data && data.intake) || 0;
        const cloudIntake  = (cloudData && cloudData.intake) || 0;
        const cachedLogs   = (data && data.currentLogs) || [];
        const cloudLogs    = (cloudData && cloudData.currentLogs) || [];

        // Use cloud as the base (has full history map, settings, etc.)
        data = cloudData;
        isDataReady = true;

        // But preserve local today-data if it's richer than the cloud response
        if (cachedIntake > cloudIntake) {
            data.intake = cachedIntake;
        }
        if (cachedLogs.length > cloudLogs.length) {
            data.currentLogs = cachedLogs;
        }

        // Merge history: local cache may have today already archived; don't lose it
        if (cloudData.history) {
            data.history = cloudData.history;
        }

        saveLocalCache(data); // Write merged result back to cache

        if (userDisplay && data.username) userDisplay.innerText = data.username.toUpperCase();
        if (avatar && data.username) avatar.innerText = data.username[0].toUpperCase();
        const mobileAvatar = document.getElementById('mobile-user-initial');
        if (mobileAvatar && data.username) mobileAvatar.innerText = data.username[0].toUpperCase();

        loadDateStats(); // Re-render with merged authoritative data

    } catch (err) {
        console.error("Cloud fetch failed:", err);
        // Cloud unavailable — still show whatever we have from cache
        if (cachedLoaded) loadDateStats();
    }
}

function saveNote() {
    const noteArea = document.getElementById('daily-note-area');
    if (!noteArea || !isDataReady) return;

    const noteText = noteArea.value;
    if (!data.notes) data.notes = {};
    data.notes[selectedDate] = noteText; 

    syncToCloud();
    showToast("Note saved for " + selectedDate + "!");
}

function deleteNote() {
    if (!isDataReady) return;
    
    if (confirm("Clear notes for " + selectedDate + "?")) {
        if (data.notes && data.notes[selectedDate]) {
            delete data.notes[selectedDate];
        }
        
        const noteArea = document.getElementById('daily-note-area');
        if (noteArea) noteArea.value = "";
        
        syncToCloud();
        showToast("Note deleted!");
    }
}



// EFFECTS
class Noise {
    constructor(seed = 0) {
        this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
        this.p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        this.perm = new Array(512);
        this.gradP = new Array(512);
        this.seed(seed);
    }
    seed(seed) {
        if (seed > 0 && seed < 1) seed *= 65536;
        seed = Math.floor(seed);
        if (seed < 256) seed |= seed << 8;
        for (let i = 0; i < 256; i++) {
            let v = i & 1 ? this.p[i] ^ (seed & 255) : this.p[i] ^ ((seed >> 8) & 255);
            this.perm[i] = this.perm[i + 256] = v;
            const g = this.grad3[v % 12];
            this.gradP[i] = this.gradP[i + 256] = {x: g[0], y: g[1]};
        }
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return (1 - t) * a + t * b; }
    perlin2(x, y) {
        let X = Math.floor(x), Y = Math.floor(y);
        x -= X; y -= Y; X &= 255; Y &= 255;
        const n00 = this.gradP[X + this.perm[Y]].x * x + this.gradP[X + this.perm[Y]].y * y;
        const n01 = this.gradP[X + this.perm[Y + 1]].x * x + this.gradP[X + this.perm[Y + 1]].y * (y - 1);
        const n10 = this.gradP[X + 1 + this.perm[Y]].x * (x - 1) + this.gradP[X + 1 + this.perm[Y]].y * y;
        const n11 = this.gradP[X + 1 + this.perm[Y + 1]].x * (x - 1) + this.gradP[X + 1 + this.perm[Y + 1]].y * (y - 1);
        const u = this.fade(x);
        return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y));
    }
}

class WaterWaves {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'waves-canvas';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.config = config;
        this.noise = new Noise(Math.random());
        this.lines = [];
        this.mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };
        this.init();
    }

    init() {
    window.addEventListener('resize', () => this.onResize());
    
    // Support both Mouse and Touch
    const handlePointer = (e) => this.onPointerMove(e.touches ? e.touches[0] : e);
    
    window.addEventListener('mousemove', handlePointer);
    window.addEventListener('touchmove', (e) => {
        handlePointer(e);
    }, { passive: true }); // Improved scroll performance on mobile
    
    this.onResize();
    this.tick(0);
    }

    onResize() {
        const b = this.container.getBoundingClientRect();
        this.canvas.width = b.width;
        this.canvas.height = b.height;
        this.setLines(b.width, b.height);
    }

    setLines(width, height) {
        this.lines = [];
        const oWidth = width + 200, oHeight = height + 30;
        const totalLines = Math.ceil(oWidth / this.config.xGap);
        const totalPoints = Math.ceil(oHeight / this.config.yGap);
        const xStart = (width - this.config.xGap * totalLines) / 2;
        const yStart = (height - this.config.yGap * totalPoints) / 2;

        for (let i = 0; i <= totalLines; i++) {
            const pts = [];
            for (let j = 0; j <= totalPoints; j++) {
                pts.push({ x: xStart + this.config.xGap * i, y: yStart + this.config.yGap * j, wave: { x: 0, y: 0 }, cursor: { x: 0, y: 0, vx: 0, vy: 0 } });
            }
            this.lines.push(pts);
        }
    }

    onPointerMove(e) {
    const b = this.container.getBoundingClientRect();
    this.mouse.x = e.clientX - b.left;
    this.mouse.y = e.clientY - b.top;
    if (!this.mouse.set) {
        this.mouse.sx = this.mouse.lx = this.mouse.x;
        this.mouse.sy = this.mouse.ly = this.mouse.y;
        this.mouse.set = true;
    }
    }

    tick(t) {
        this.mouse.sx += (this.mouse.x - this.mouse.sx) * 0.1;
        this.mouse.sy += (this.mouse.y - this.mouse.sy) * 0.1;
        const dx = this.mouse.x - this.mouse.lx, dy = this.mouse.y - this.mouse.ly;
        const d = Math.hypot(dx, dy);
        this.mouse.vs += (d - this.mouse.vs) * 0.1;
        this.mouse.vs = Math.min(100, this.mouse.vs);
        this.mouse.lx = this.mouse.x; this.mouse.ly = this.mouse.y;
        this.mouse.a = Math.atan2(dy, dx);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.config.lineColor;

        this.lines.forEach(pts => {
            pts.forEach(p => {
                const move = this.noise.perlin2((p.x + t * this.config.waveSpeedX) * 0.002, (p.y + t * this.config.waveSpeedY) * 0.0015) * 12;
                p.wave.x = Math.cos(move) * this.config.waveAmpX;
                p.wave.y = Math.sin(move) * this.config.waveAmpY;

                const mdx = p.x - this.mouse.sx, mdy = p.y - this.mouse.sy;
                const dist = Math.hypot(mdx, mdy), l = Math.max(175, this.mouse.vs);
                if (dist < l) {
                    const f = Math.cos(dist * 0.001) * (1 - dist / l);
                    p.cursor.vx += Math.cos(this.mouse.a) * f * l * this.mouse.vs * 0.00065;
                    p.cursor.vy += Math.sin(this.mouse.a) * f * l * this.mouse.vs * 0.00065;
                }
                p.cursor.vx += (0 - p.cursor.x) * this.config.tension;
                p.cursor.vy += (0 - p.cursor.y) * this.config.tension;
                p.cursor.vx *= this.config.friction; p.cursor.vy *= this.config.friction;
                p.cursor.x += p.cursor.vx * 2; p.cursor.y += p.cursor.vy * 2;
            });

            this.ctx.moveTo(pts[0].x + pts[0].wave.x, pts[0].y + pts[0].wave.y);
            pts.forEach((p, idx) => {
                const isLast = idx === pts.length - 1;
                this.ctx.lineTo(p.x + p.wave.x + (isLast ? 0 : p.cursor.x), p.y + p.wave.y + (isLast ? 0 : p.cursor.y));
            });
        });
        this.ctx.stroke();
        requestAnimationFrame((time) => this.tick(time));
    }
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-msg'; // Styling already added in previous step
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Initialize with your settings
new WaterWaves('waves-bg', {
    lineColor: "rgba(21, 101, 192, 0.35)",
    waveSpeedX: 0.0125,
    waveSpeedY: 0.01,
    waveAmpX: 40,
    waveAmpY: 20,
    friction: 0.9,
    tension: 0.01,
    xGap: 12,
    yGap: 36
});

/* ── PWA INSTALLATION LOGIC ── */
var deferredPWAInstallPrompt = window.deferredPWAInstallPrompt || null;

function isAppStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') ||
           window.location.search.includes('mode=standalone');
}

function updatePWAInstallButtons() {
    const isInstalled = localStorage.getItem('pwa_installed') === 'true';
    const standalone = isAppStandalone();

    const btns = document.querySelectorAll('.install-app-btn');

    if (isInstalled || standalone) {
        btns.forEach(btn => {
            btn.style.setProperty('display', 'none', 'important');
        });
        return;
    }

    btns.forEach(btn => {
        if (deferredPWAInstallPrompt) {
            btn.style.setProperty('display', 'flex', 'important');
        } else {
            btn.style.setProperty('display', 'none', 'important');
        }
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    window.deferredPWAInstallPrompt = e;
    updatePWAInstallButtons();
});

async function triggerPWAInstall() {
    if (!deferredPWAInstallPrompt) return;

    deferredPWAInstallPrompt.prompt();
    try {
        const choice = await deferredPWAInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
            localStorage.setItem('pwa_installed', 'true');
            deferredPWAInstallPrompt = null;
            window.deferredPWAInstallPrompt = null;
            updatePWAInstallButtons();
        }
    } catch(e) {}
}

window.addEventListener('appinstalled', () => {
    localStorage.setItem('pwa_installed', 'true');
    deferredPWAInstallPrompt = null;
    window.deferredPWAInstallPrompt = null;
    updatePWAInstallButtons();
    if (typeof showToast === 'function') showToast('Hydro Tracker Installed Successfully! 🎉');
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updatePWAInstallButtons);
} else {
    updatePWAInstallButtons();
}
