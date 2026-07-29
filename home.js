/* ── Theme Boot (runs before DOM paint) ── */
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

// 1. Only keep the Token (Required to ask the Cloud who you are)
var token = localStorage.getItem('token'); 
var API_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : "http://localhost:5000";

// 2. Initialize a "Waiting" state
var isDataReady = false; // This prevents syncing until the Cloud data arrives
var data = {
    username: "Loading...",
    goal: 2500,
    intake: 0,
    streak: 0,
    reminders: [
        { time: "08:00", daily: true, active: true },
        { time: "12:00", daily: true, active: true },
        { time: "18:00", daily: true, active: true },
        { time: "21:00", daily: true, active: true }
    ],
    mealTimes: { bfast: "08:30", lunch: "13:30", dinner: "20:30" },
    postMealEnabled: false,
    currentLogs: [],
    history: {}
};

// 3. Initial & Profile Logic
// window.addEventListener('DOMContentLoaded', () => {

//     const today = new Date().toLocaleDateString();

//     // ==========================================
//     // DAILY RESET + HISTORY ARCHIVING
//     // ==========================================
//     if (data.lastLogDate !== today) {

//     // 1. Prepare the data to be archived
//     const historyEntry = {
//         total: data.intake || 0,
//         logs: data.currentLogs || []
//     };

//     // 2. FIX: Convert lastLogDate to a clean YYYY-MM-DD string using local time
//     if (data.lastLogDate) {
//         const d = new Date(data.lastLogDate);
//         const oldDateISO = d.getFullYear() + '-' + 
//                            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
//                            String(d.getDate()).padStart(2, '0');

//         if (!data.history) data.history = {};
        
//         // Save the data to history under the local date string
//         data.history[oldDateISO] = historyEntry;
//     }

//     // 3. Reset for the new day
//     data.intake = 0;
//     data.currentLogs = [];
//     data.lastLogDate = today;

//     syncToCloud(); // Save the updated history and reset values
// }

//     // ==========================================
//     // THEME INITIALIZATION
//     // ==========================================
//     updateTheme();

//     // ==========================================
//     // USER PROFILE UI SETUP
//     // ==========================================
//     const displayElement = document.getElementById('username-display');
//     const initialElement = document.getElementById('user-initial');

//     if (displayElement) {
//         displayElement.innerText = data.username;
//     }

//     if (initialElement) {
//         initialElement.innerText = data.username.charAt(0).toUpperCase();
//     }

//     // ==========================================
//     // HOME PAGE UI REFRESH
//     // ==========================================
//     if (document.getElementById('percent-text')) {
//         refreshHome();
//     }

// });

window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Visuals
    updateTheme(); 

    // 2. Clear One-Time Reminders locally (Optional UI cleanup)
    if (typeof clearOneTimeReminders === 'function') {
        clearOneTimeReminders();
    }

    // 3. Fetch Fresh Data from Cloud
    // This function handles the Daily Reset automatically on the server side
    loadUserData(); 
});

// 4. Save Data (Linked to the unique user key)
// function saveData() {
//     localStorage.setItem(storageKey, JSON.stringify(data));
// }

// 5. Water Logic
function logWater(ml) {
    data.intake += ml;
    if(!data.currentLogs) data.currentLogs = [];
    
    data.currentLogs.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ml: ml
    });
    
    refreshHome();
    syncToCloud(); // Immediate push to MongoDB
    showToast(`Logged ${ml}ml to Cloud!`);
}

function undoLog() {
    if (!data.currentLogs || data.currentLogs.length === 0) return;

    const removedEntry = data.currentLogs.pop();
    const amountToSubtract = removedEntry.ml || 0;
    data.intake = Math.max(0, data.intake - amountToSubtract);

    refreshHome();
    syncToCloud(); // Update the cloud after undo
}

function logCustom() {
    const val = document.getElementById('custom-val');
    const amount = parseInt(val.value);
    if (amount > 0) {
        logWater(amount);
        val.value = ''; // Clear input
    }
}

// 6. UI Rendering
function refreshHome() {
    const currentIntake = Number(data.intake) || 0;
    const currentGoal = Number(data.goal) || 2500;

    // % calculation (capped at 100 for UI)
    const pct = Math.min((currentIntake / currentGoal) * 100, 100);

    /* ============================================================
       1. UPDATE PERCENT TEXT
    ============================================================ */
    const percentDisplay = document.getElementById('percent-text');
    if (percentDisplay) {
        percentDisplay.innerText = Math.round((currentIntake / currentGoal) * 100) + "%";
    }

    /* ============================================================
       2. UPDATE LITERS TEXT
    ============================================================ */
    const litersDisplay = document.getElementById('liters-text');
    if (litersDisplay) {
        litersDisplay.innerText =
            `${(currentIntake / 1000).toFixed(1)} / ${(currentGoal / 1000).toFixed(1)} L`;
    }

    /* ============================================================
       3. UPDATE PROGRESS RING
    ============================================================ */
    const circle = document.getElementById('progress-bar');
    if (circle) {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;

        const offset = circumference - (pct / 100) * circumference;

        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    }

    /* ============================================================
       4. STREAK CALCULATION
    ============================================================ */
    const streakDisplay = document.getElementById('streak');
    if (streakDisplay) {
        data.streak = calculateStreak();
        streakDisplay.innerText = data.streak;
    }

    /* ============================================================
       5. BEST INTAKE CALCULATION
    ============================================================ */
    const bestDisplay = document.getElementById('best');
    const history = data.history || {};

    const historicalMax = Math.max(
        ...Object.values(history).map(e =>
            (typeof e === 'object' ? e.total : e) || 0
        ),
        0
    );

    const bestValue = Math.max(historicalMax, currentIntake);

    if (bestDisplay) {
        bestDisplay.innerText = (bestValue / 1000).toFixed(1) + " L";
    }

    /* ============================================================
       6. SAVE DATA
    ============================================================ */
    // syncToCloud()
}

// 7. Navigation & Session Logic
function toggleLogout() {
    const menu = document.getElementById('logout-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function logout() {
    localStorage.clear(); // Clear token and all session data
    window.location.href = 'index.html';    // Redirect to login
}

function updateTheme() {
    const hr = new Date().getHours();
    const b = document.body;
    b.classList.remove('theme-morning', 'theme-day', 'theme-evening', 'theme-night');
    if (hr >= 6 && hr < 10) b.classList.add('theme-morning');
    else if (hr >= 10 && hr < 16) b.classList.add('theme-day');
    else if (hr >= 16 && hr < 18) b.classList.add('theme-evening');
    else b.classList.add('theme-night');
}

async function loadUserData() {
    if (!token) return window.location.href = 'index.html';

    try {
        const response = await fetch(`${API_URL}/api/user/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Unauthorized");

        const cloudData = await response.json(); 
        
        data = cloudData;       
        isDataReady = true;     
        
        // ✅ FIX: Update Sidebar UI directly from the Cloud response
        const displayElement = document.getElementById('username-display');
        const initialElement = document.getElementById('user-initial');

        if (displayElement && data.username) {
            displayElement.innerText = data.username;
        }
        
        if (initialElement && data.username) {
            initialElement.innerText = data.username[0].toUpperCase();
        }
        
        // Refresh the progress ring and stats
        refreshHome();
        checkBadges(); 

    } catch (err) {
        console.error("Cloud connection failed:", err);
        showToast("Error loading profile from Cloud.");
    }
}

async function syncToCloud() {
    // ✅ NEW: If data isn't ready or still loading, STOP the sync.
    if (!isDataReady || data.username === "Loading...") return;

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

function calculateStreak() {
    const history = data.history || {};
    const todayISO = new Date().toISOString().split('T')[0];
    const goal = data.goal || 2500;
    
    // Get all historical dates and sort them (newest first)
    const dates = Object.keys(history).sort((a, b) => new Date(b) - new Date(a));
    
    let currentStreak = 0;
    
    // 1. Check if Today's goal is met to start the streak
    if (data.intake >= goal) {
        currentStreak = 1;
    }

    // 2. Look back through history
    let checkDate = new Date();
    // Start checking from yesterday
    checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
        const dateStr = checkDate.getFullYear() + '-' + 
                        String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(checkDate.getDate()).padStart(2, '0');
        
        const entry = history[dateStr];
        const dayTotal = (entry && typeof entry === 'object') ? entry.total : (entry || 0);

        if (dayTotal >= goal) {
            // If the user met the goal today, we add to that. 
            // If they haven't met today yet, the streak starts from yesterday.
            if (data.intake >= goal) {
                currentStreak++;
            } else {
                // If today isn't met, but yesterday was, the streak is whatever the history says
                currentStreak++; 
            }
            // Move to the previous day
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Streak broken
            break;
        }
    }
    
    return currentStreak;
}

// Reminder check — runs every 60 seconds
let lastNotificationTime = Date.now();
let lastIntervalNotification = Date.now();

setInterval(() => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ":" + 
                        now.getMinutes().toString().padStart(2, '0');

    /* ============================================================
       1. SPECIFIC TIME REMINDERS
    ============================================================ */
    const timeRows = document.querySelectorAll('.time-toggle-row');
    timeRows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        const dailyToggle = row.querySelector('.daily-toggle');
        const alarmTime = checkbox.value;
        const reminderIndex = data.reminders ? data.reminders.findIndex(r => r.time === alarmTime) : -1;

        if (checkbox.checked && alarmTime === currentTime && data.reminders?.[reminderIndex]?.active !== false) {
            const randomMsg = typeof getRandomReminder === 'function' ? getRandomReminder() : "Time to hydrate!";
            if (typeof sendSystemNotification === 'function') {
                sendSystemNotification("Hydration Reminder", `🔔 ${alarmTime}: ${randomMsg}`);
            }

            // If it's a "Once" alarm, deactivate it in cloud and UI after firing
            if (dailyToggle && !dailyToggle.checked) {
                if (reminderIndex !== -1) {
                    data.reminders[reminderIndex].active = false;
                }
                checkbox.checked = false;
                if (typeof loadReminders === 'function') loadReminders();
                if (typeof syncToCloud === 'function') syncToCloud();
            }
        }
    });

    /* ============================================================
       2. INTERVAL-BASED REMINDERS
    ============================================================ */
    const isIntervalEnabled = document.getElementById('interval-master-toggle')?.checked;
    const intervalMinutes = parseInt(document.getElementById('interval-min')?.value);

    if (isIntervalEnabled && intervalMinutes > 0) {
        const elapsed = (Date.now() - lastIntervalNotification) / 60000;
        if (elapsed >= intervalMinutes) {
            sendSystemNotification("Interval Reminder", `💧 Repeat Alert: It's been ${intervalMinutes} minutes!`);
            lastIntervalNotification = Date.now();
        }
    }

    /* ============================================================
       3. POST-MEAL REMINDERS (Calculated 30m Delay)
    ============================================================ */
    if (data.postMealEnabled && data.mealTimes) {
        const mealKeys = ['bfast', 'lunch', 'dinner'];
        const mealNames = { bfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

        mealKeys.forEach(key => {
            const mealTime = data.mealTimes[key];
            if (mealTime) {
                let [hours, minutes] = mealTime.split(':').map(Number);
                minutes += 30;
                if (minutes >= 60) {
                    hours = (hours + 1) % 24;
                    minutes -= 60;
                }
                const triggerTime = hours.toString().padStart(2, '0') + ":" + 
                                minutes.toString().padStart(2, '0');

                if (triggerTime === currentTime) {
                    sendSystemNotification("Post-Meal Reminder", `🥗 30 mins since ${mealNames[key]}: Time to hydrate!`);
                }
            }
        });
    }

    /* ============================================================
       4. MIDNIGHT RESET
    ============================================================ */
    if (currentTime === "00:00") {
        if (typeof clearOneTimeReminders === 'function') clearOneTimeReminders();
        document.querySelectorAll('.time-toggle-row').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            const dailyToggle = row.querySelector('.daily-toggle');
            if (checkbox && dailyToggle && checkbox.checked && !dailyToggle.checked) {
                checkbox.checked = false;
            }
        });
        if (typeof loadReminders === 'function') loadReminders();
        if (typeof syncToCloud === 'function') syncToCloud();
    }

}, 60000);

function checkAchievements() {
    const streak = calculateStreak();
    let newBadges = [...(data.badges || [])];

    if (streak >= 5 && !newBadges.includes('High Five')) {
        newBadges.push('High Five');
        showNotification("🏆 Badge Unlocked: 5 Day Streak!");
    }
    
    if (data.intake >= 4000 && !newBadges.includes('Water Whale')) {
        newBadges.push('Water Whale');
        showNotification("🐳 Badge Unlocked: 4L in one day!");
    }

    if (newBadges.length > (data.badges || []).length) {
        data.badges = newBadges;
        syncToCloud();
    }
}

function checkBadges() {
    const streak = calculateStreak();
    let currentBadges = data.badges || [];
    let earnedNew = false;

    // 🏆 Achievement: 5-Day Finisher
    if (streak >= 5 && !currentBadges.includes('5-day-streak')) {
        currentBadges.push('5-day-streak');
        showNotification("🏆 Achievement Unlocked: 5-Day Finisher!");
        earnedNew = true;
    }

    // 🏆 Achievement: Ocean Master (Hit 100% today)
    if (data.intake >= data.goal && !currentBadges.includes('ocean-master')) {
        currentBadges.push('ocean-master');
        showNotification("🌊 Achievement Unlocked: Ocean Master!");
        earnedNew = true;
    }

    if (earnedNew) {
        data.badges = currentBadges;
        syncToCloud(); // Sync the new badges to MongoDB
    }
}

// NOTIFICATIONS & MOBILE PWA SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('✅ ServiceWorker registered for Mobile Notifications');
        }).catch(err => console.log('SW Registration error:', err));
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // Ask the user for notification permission as soon as they land on the page
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
});

function sendSystemNotification(title, message) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        try {
            const notif = new Notification(title, {
                body: message,
                icon: 'icon-192x192.png',
                tag: 'hydrotrack-system',
                renotify: true
            });
            notif.onclick = () => { window.focus(); };
        } catch (e) {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(title, { body: message, icon: 'icon-192x192.png' });
                }).catch(() => {});
            }
        }
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                sendSystemNotification(title, message);
            }
        });
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

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
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
    // Desktop support
    window.addEventListener('mousemove', (e) => this.onPointerMove(e));
    // Mobile touch support
    window.addEventListener('touchmove', (e) => {
        this.onPointerMove(e.touches[0]);
    }, { passive: true });
    
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
