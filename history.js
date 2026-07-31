/* ── Theme Boot ── */
(function(){
    const K=['--accent','--accent-light','--accent-dark','--accent-rgb','--accent-glow','--accent-subtle','--bg-gradient','--glass-bg','--glass-border','--text-primary','--text-secondary'];
    const T={
        ocean:   ['#1565c0','#42a5f5','#003c8f','21,101,192','rgba(21,101,192,.28)','rgba(21,101,192,.08)','linear-gradient(135deg,#f0f7ff,#dce8ff,#c2d9ff)','rgba(255,255,255,.52)','rgba(255,255,255,.36)','#1a237e','#546e7a'],
        forest:  ['#2e7d32','#66bb6a','#1b5e20','46,125,50','rgba(46,125,50,.28)','rgba(46,125,50,.08)','linear-gradient(135deg,#f1f8e9,#dcedc8,#c8e6c9)','rgba(255,255,255,.52)','rgba(255,255,255,.36)','#1b5e20','#388e3c'],
        coral:   ['#e64a19','#ff7043','#bf360c','230,74,25','rgba(230,74,25,.28)','rgba(230,74,25,.08)','linear-gradient(135deg,#fff3e0,#ffe0b2,#ffccbc)','rgba(255,255,255,.52)','rgba(255,255,255,.36)','#bf360c','#e64a19']
    };
    let n=localStorage.getItem('hydroTheme')||'ocean';
    if (!T[n]) { n='ocean'; localStorage.setItem('hydroTheme','ocean'); }
    const v=T[n];
    const r=document.documentElement.style;
    K.forEach((k,i)=>r.setProperty(k,v[i]));
})();

var API_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : "http://localhost:5000";

// 1. The ONLY thing we keep in the browser is the Token (The Key to the Cloud)
var token = localStorage.getItem('token'); 

// 2. Initial "Waiting" State
var isDataReady = typeof isDataReady !== 'undefined' ? isDataReady : false; 
var data = typeof data !== 'undefined' ? data : {
    username: "Loading...",
    goal: 2500,
    intake: 0,
    history: {},
    currentLogs: [],
    notes: {} 
};

// 3. Date Logic (Local time for accurate calendar display)
// Helper for YYYY-MM-DD in local time
function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const todayISO = getLocalDateString();
var selectedDate = todayISO;

function saveLocalCache(userData) {
    try {
        localStorage.setItem('hydro_data_cache', JSON.stringify(userData));
        if (typeof window !== 'undefined' && window.BroadcastChannel) {
            const bc = new BroadcastChannel('hydrotrack_channel');
            bc.postMessage({ type: 'DATA_UPDATED', userData });
        }
    } catch(e) {}
}

function loadLocalCache() {
    try {
        const cached = localStorage.getItem('hydro_data_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object' && parsed.username && parsed.username !== "Loading...") {
                data = parsed;
                isDataReady = true;
                return true;
            }
        }
    } catch(e) {}
    return false;
}

// Initial instant load from cache
loadLocalCache();

// Listen for live updates from other tabs (e.g. Home tab logging water)
if (typeof window !== 'undefined' && window.BroadcastChannel) {
    const bc = new BroadcastChannel('hydrotrack_channel');
    bc.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_UPDATED') {
            data = event.data.userData;
            isDataReady = true;
            if (typeof loadDateStats === 'function') loadDateStats();
        }
    };
}

async function syncToCloud() {
    if (!isDataReady) return; 
    saveLocalCache(data);

    try {
        await fetch(`${API_URL}/api/user/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userData: data })
        });
    } catch (err) {
        console.error("Cloud sync failed", err);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (typeof updateTheme === 'function') updateTheme(); 

    const picker = document.getElementById('calendar-picker');
    if (picker) {
        picker.value = todayISO;  // Force the input to show today
        picker.max = todayISO;    // Disable selection of future dates
    }

    loadHistoryData(); 
});

function toggleLogout() {
    const menu = document.getElementById('logout-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function logout() {
    localStorage.clear(); 
    window.location.href = 'index.html';
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

    // Phase 1: Render instantly from local cache if available (0ms delay)
    if (loadLocalCache()) {
        const userDisplay = document.getElementById('username-display');
        const avatar = document.getElementById('user-initial');
        if (userDisplay && data.username) userDisplay.innerText = data.username;
        if (avatar && data.username) avatar.innerText = data.username[0].toUpperCase();
        loadDateStats();
    }

    // Phase 2: Fetch fresh cloud data from MongoDB
    try {
        const response = await fetch(`${API_URL}/api/user/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Unauthorized");
        
        const cloudData = await response.json();
        data = cloudData; 
        isDataReady = true; 
        saveLocalCache(data);
        
        const userDisplay = document.getElementById('username-display');
        const avatar = document.getElementById('user-initial');
        
        if (userDisplay && data.username) {
            userDisplay.innerText = data.username;
        }
        if (avatar && data.username) {
            avatar.innerText = data.username[0].toUpperCase();
        }

        loadDateStats();
    } catch (err) {
        console.error(err);
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
    lineColor: "#ffffff",
    waveSpeedX: 0.0125,
    waveSpeedY: 0.01,
    waveAmpX: 40,
    waveAmpY: 20,
    friction: 0.9,
    tension: 0.01,
    xGap: 12,
    yGap: 36
});
