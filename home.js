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
    mealTimes: { bfast: "", lunch: "", dinner: "" },
    postMealEnabled: false,
    currentLogs: [],
    history: {}
};

// Single persistent BroadcastChannel for cross-tab sync
var _hydroBC = null;
try {
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
        _hydroBC = new BroadcastChannel('hydrotrack_channel');
    }
} catch(e) {}

function saveLocalCache(userData) {
    try {
        const json = JSON.stringify(userData);
        localStorage.setItem('hydro_data_cache', json);
        // Timestamp key triggers 'storage' event in other tabs reliably
        localStorage.setItem('hydro_update_ts', Date.now().toString());
        // BroadcastChannel for same-origin cross-tab updates
        if (_hydroBC) {
            _hydroBC.postMessage({ type: 'DATA_UPDATED', userData });
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

// Attempt instant local render from cache
loadLocalCache();

// Live broadcast listener — only refresh home UI if on home page
if (_hydroBC) {
    _hydroBC.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_UPDATED') {
            data = event.data.userData;
            isDataReady = true;
            if (typeof refreshHome === 'function' && document.getElementById('percent-text')) {
                refreshHome();
            }
        }
    };
}

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
    if (typeof updateTheme === 'function') updateTheme(); 

    // 2. Only run home-specific logic if we're actually on the home page
    // (history.html also loads home.js, so we guard with a home-page-specific element)
    const isHomePage = !!document.getElementById('percent-text');
    if (!isHomePage) return; // history/insights/settings pages handle their own data loading

    // 3. Clear One-Time Reminders locally (Optional UI cleanup)
    if (typeof clearOneTimeReminders === 'function') {
        clearOneTimeReminders();
    }

    // 4. Fetch Fresh Data from Cloud
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
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        ml: ml
    });
    
    saveLocalCache(data); // Immediate local cache & cross-tab sync
    refreshHome();
    syncToCloud(); // Push to MongoDB
    showToast(`Logged ${ml}ml!`);
}

function undoLog() {
    if (!data.currentLogs || data.currentLogs.length === 0) return;

    const removedEntry = data.currentLogs.pop();
    const amountToSubtract = removedEntry.ml || 0;
    data.intake = Math.max(0, data.intake - amountToSubtract);

    saveLocalCache(data); // Immediate local cache & cross-tab sync
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
       6. STREAK RISK CHECK + COACH NUDGE
    ============================================================ */
    checkStreakRisk();
}

/* ================================================================
   ⚠️  STREAK RISK ENGINE
   Calculates current pace and warns if user is on track to miss goal
================================================================ */
function getISTHour() {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.getUTCHours() + ist.getUTCMinutes() / 60;
}

function checkStreakRisk() {
    const banner  = document.getElementById('streak-risk-banner');
    const msgEl   = document.getElementById('streak-risk-msg');
    const iconEl  = document.getElementById('streak-risk-icon');
    if (!banner || !msgEl) return;

    const intake = Number(data.intake) || 0;
    const goal   = Number(data.goal)   || 2500;
    const pct    = (intake / goal) * 100;

    // Already done for the day — hide banner
    if (pct >= 100) { banner.style.display = 'none'; return; }

    const hourNow = getISTHour(); // 0–24 float

    // Don't warn before 9am — user is just starting their day
    if (hourNow < 9) { banner.style.display = 'none'; return; }

    // Hours remaining until end of day
    const hoursRemaining = Math.max(0, 23.99 - hourNow);
    // Pace: ml per hour so far
    const mlPerHour = hourNow > 0 ? intake / hourNow : 0;
    // Projected end-of-day total
    const projected = intake + (mlPerHour * hoursRemaining);
    const projectedPct = Math.round((projected / goal) * 100);

    const intakeMl   = intake;
    const timeStr    = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const neededMl   = Math.max(0, goal - intake);
    const neededL    = (neededMl / 1000).toFixed(1);
    const streak     = data.streak || calculateStreak();

    let icon, msg;

    if (projectedPct >= 90) {
        // On track — no warning needed
        banner.style.display = 'none';
        return;
    } else if (projectedPct >= 60) {
        // Mild warning
        icon = '⚡';
        msg  = `You've had ${(intakeMl/1000).toFixed(1)}L by ${timeStr}. At this pace you'll hit ~${projectedPct}% today — need ${neededL}L more to complete your goal!`;
    } else if (hourNow > 20) {
        // Late night, critical
        icon = '🚨';
        msg  = `Only ${Math.round(pct)}% done with under ${Math.round(hoursRemaining * 60)} mins left! Drink ${neededL}L now to save your ${streak > 0 ? streak + '-day ' : ''}streak!`;
    } else {
        // Severe warning
        icon = '⚠️';
        msg  = `You've only had ${(intakeMl/1000).toFixed(1)}L by ${timeStr}. At this pace you'll hit ~${projectedPct}% — your${streak > 0 ? ' ' + streak + '-day' : ''} streak is at risk!`;
    }

    if (iconEl) iconEl.textContent = icon;
    msgEl.textContent = msg;
    banner.style.display = 'flex';

    // Also nudge the coach bubble
    const notifDot = document.getElementById('coach-bubble-notif');
    if (notifDot && projectedPct < 70) notifDot.style.display = 'block';
}

/* ================================================================
   🤖  HYDRATION COACH — Smart Rule-Based NLP Engine
================================================================ */
var coachOpen = false;
var coachInitialized = false;

function toggleCoach() {
    const panel = document.getElementById('coach-panel');
    if (!panel) return;
    coachOpen = !coachOpen;
    panel.style.display = coachOpen ? 'flex' : 'none';

    // Hide notif dot when opened
    const dot = document.getElementById('coach-bubble-notif');
    if (dot) dot.style.display = 'none';

    if (coachOpen && !coachInitialized) {
        coachInitialized = true;
        initCoach();
    }
}

function initCoach() {
    const intake  = Number(data.intake) || 0;
    const goal    = Number(data.goal)   || 2500;
    const pct     = Math.round((intake / goal) * 100);
    const streak  = data.streak || calculateStreak();
    const hourNow = getISTHour();
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const name    = (data.username || 'there').split(' ')[0];

    // Build opening greeting based on context
    let greeting;
    if (pct >= 100) {
        greeting = `🎉 Amazing, ${name}! You've crushed your ${(goal/1000).toFixed(1)}L goal today. Your ${streak}-day streak is safe. How can I help you?`;
    } else if (hourNow < 12) {
        greeting = `Good morning, ${name}! ☀️ You've had ${(intake/1000).toFixed(1)}L so far. The day is young — let's build a great habit today!`;
    } else if (hourNow < 17) {
        const hoursLeft = Math.round(23.99 - hourNow);
        const needed = Math.max(0, goal - intake);
        greeting = `Hey ${name}! 💧 It's ${timeStr} — you're at ${pct}% (${(intake/1000).toFixed(1)}L / ${(goal/1000).toFixed(1)}L). You need ${(needed/1000).toFixed(1)}L more across ~${hoursLeft} hours. You've got this!`;
    } else if (hourNow < 21) {
        const needed = Math.max(0, goal - intake);
        if (needed > 500) {
            greeting = `Evening check-in, ${name}! 🌆 You're at ${pct}% and still need ${(needed/1000).toFixed(1)}L. The clock is ticking — let's finish strong and protect that streak!`;
        } else {
            greeting = `Almost there, ${name}! 🌆 You're at ${pct}% — just ${needed}ml to go. One more glass and you're done!`;
        }
    } else {
        const needed = Math.max(0, goal - intake);
        if (needed > 200) {
            greeting = `Late night, ${name}! 🌙 You're at ${pct}% — need ${needed}ml more. A quick glass of water now could save your ${streak > 0 ? streak + '-day ' : ''}streak!`;
        } else {
            greeting = `Great work today, ${name}! 🌙 You're at ${pct}% — almost there. Just ${needed}ml to finish the day strong!`;
        }
    }

    addCoachMessage(greeting, 'coach');
    renderCoachChips();
}

function renderCoachChips() {
    const chips = document.getElementById('coach-chips');
    if (!chips) return;
    const questions = [
        "📊 How am I doing today?",
        "⏰ When should I drink next?",
        "🎯 What is my remaining goal?",
        "🔥 How is my streak?",
        "💡 Give me a hydration tip",
        "⚡ Set a reminder in 30 mins"
    ];
    chips.innerHTML = questions.map(q =>
        `<button class="coach-chip" data-q="${q}">${q}</button>`
    ).join('');
    chips.querySelectorAll('.coach-chip').forEach(btn => {
        btn.addEventListener('click', () => handleCoachChip(btn.getAttribute('data-q')));
    });
}

function toggleCoachQuickMenu() {
    const menu = document.getElementById('coach-quick-menu');
    const arrow = document.getElementById('coach-dropup-arrow');
    const btn = document.getElementById('coach-dropup-btn');
    if (!menu) return;
    const isHidden = menu.style.display === 'none' || !menu.style.display;
    if (isHidden) {
        menu.style.display = 'flex';
        if (arrow) arrow.textContent = '▼';
        if (btn) btn.classList.add('active');
    } else {
        menu.style.display = 'none';
        if (arrow) arrow.textContent = '▲';
        if (btn) btn.classList.remove('active');
    }
}

function sendQuickQuestion(text) {
    const menu = document.getElementById('coach-quick-menu');
    const arrow = document.getElementById('coach-dropup-arrow');
    const btn = document.getElementById('coach-dropup-btn');
    if (menu) menu.style.display = 'none';
    if (arrow) arrow.textContent = '▲';
    if (btn) btn.classList.remove('active');

    addCoachMessage(text, 'user');
    setTimeout(() => processCoachQuery(text), 400);
}

function sendCoachMessage() {
    const input = document.getElementById('coach-input');
    if (!input || !input.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    addCoachMessage(msg, 'user');
    setTimeout(() => processCoachQuery(msg), 400);
}


/* ══════════════════════════════════════════════════════════════
   ⏰  COACH ALARM ENGINE — localStorage-persisted
   Survives page refresh / navigation. Fires via sendSystemNotification.
══════════════════════════════════════════════════════════════ */
var coachAlarms = [];           // runtime list (timeoutIds)
var _alarmTimeouts = {};        // id → timeoutId mapping

const ALARM_STORE_KEY = 'hydrotrack_coach_alarms';

/* Save pending alarms to localStorage (without timeoutIds — those can't be serialised) */
function saveAlarmsToStorage() {
    const toSave = coachAlarms.map(a => ({
        id:      a.id,
        label:   a.label,
        fireAt:  a.fireAt,          // ISO string
        fireStr: a.fireStr,
        pct:     a.pct
    })).filter(a => new Date(a.fireAt) > new Date()); // only future alarms
    try { localStorage.setItem(ALARM_STORE_KEY, JSON.stringify(toSave)); } catch(e) {}
}

/* Fire a single alarm by its record */
function fireAlarm(alarm) {
    if (typeof sendSystemNotification === 'function') {
        sendSystemNotification(
            '💧 Hydration Reminder',
            `Coach reminder: "${alarm.label}"\nYou were at ${alarm.pct}% when this was set.`
        );
    } else {
        showToast('⏰ Coach: Time to drink water!');
    }
    // Remove from runtime lists & storage
    coachAlarms = coachAlarms.filter(a => a.id !== alarm.id);
    delete _alarmTimeouts[alarm.id];
    saveAlarmsToStorage();

    // ── Completely DELETE coach alarm from data.reminders & sync to cloud ──
    if (data && Array.isArray(data.reminders)) {
        data.reminders = data.reminders.filter(r => !(r.source === 'coach' && (r.alarmId === alarm.id || r.time === alarm.timeKey)));
        syncToCloud();
        if (typeof renderCloudReminders === 'function') renderCloudReminders();
        if (typeof loadReminders === 'function') loadReminders();
    }
}

/* Register a single alarm into the runtime (schedules the timeout) */
function registerAlarm(alarm) {
    const delayMs = new Date(alarm.fireAt) - Date.now();
    if (delayMs <= 0) return; // already passed, skip silently
    const tid = setTimeout(() => fireAlarm(alarm), delayMs);
    _alarmTimeouts[alarm.id] = tid;
    if (!coachAlarms.find(a => a.id === alarm.id)) coachAlarms.push(alarm);
}

/* ── Called once at DOMContentLoaded to restore alarms after refresh ── */
function restoreCoachAlarms() {
    try {
        const raw = localStorage.getItem(ALARM_STORE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        let updated = false;
        saved.forEach(alarm => {
            if (new Date(alarm.fireAt) > new Date()) {
                registerAlarm(alarm);
            } else {
                // Expired while app/browser was closed — delete from data.reminders
                if (data && Array.isArray(data.reminders)) {
                    data.reminders = data.reminders.filter(r => !(r.source === 'coach' && (r.alarmId === alarm.id || r.time === alarm.timeKey)));
                }
                updated = true;
            }
        });
        saveAlarmsToStorage(); // clean expired ones from localStorage
        if (updated) {
            syncToCloud();
            if (typeof renderCloudReminders === 'function') renderCloudReminders();
        }
    } catch(e) {}
}

/* ── Schedule a brand-new alarm ── */
function scheduleCoachAlarm(delayMs, label, pct) {
    const fireAt  = new Date(Date.now() + delayMs);
    const fireStr = fireAt.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });

    // HH:MM format for data.reminders (24-hr)
    const hh = String(fireAt.getHours()).padStart(2, '0');
    const mm = String(fireAt.getMinutes()).padStart(2, '0');
    const timeKey = `${hh}:${mm}`;

    const alarm = {
        id:      Date.now(),
        label,
        pct,
        fireAt:  fireAt.toISOString(),
        fireStr,
        timeKey  // stored so we can remove it from data.reminders later
    };
    registerAlarm(alarm);
    saveAlarmsToStorage();

    // ── Also push into data.reminders so it appears in Settings ──
    if (data && Array.isArray(data.reminders)) {
        // Avoid duplicate at same minute
        const exists = data.reminders.find(r => r.time === timeKey && r.source === 'coach');
        if (!exists) {
            data.reminders.push({ time: timeKey, daily: false, active: true, source: 'coach', alarmId: alarm.id });
            data.reminders.sort((a, b) => a.time.localeCompare(b.time));
            syncToCloud();
        }
    }

    return alarm;
}

/* ── Cancel all active alarms ── */
function cancelAllCoachAlarms() {
    Object.values(_alarmTimeouts).forEach(tid => clearTimeout(tid));
    _alarmTimeouts = {};
    coachAlarms    = [];
    saveAlarmsToStorage();

    // ── Also remove coach reminders from data.reminders ──
    if (data && Array.isArray(data.reminders)) {
        data.reminders = data.reminders.filter(r => r.source !== 'coach');
        syncToCloud();
    }
}

/* ── List alarms (future only) ── */
function getPendingAlarms() {
    const now = Date.now();
    return coachAlarms.filter(a => new Date(a.fireAt) > now);
}

/* Parse a natural-language time string → milliseconds delay from now, or null */
function parseTimeToMs(q) {
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const currentH = istNow.getUTCHours();
    const currentM = istNow.getUTCMinutes();

    // ── Relative: "in X minutes/hours" ──
    const relMin  = q.match(/in\s+(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|m\b)/i);
    const relHour = q.match(/in\s+(\d+(?:\.\d+)?)\s*(hour?s?|hr?s?)\b/i);
    const relSec  = q.match(/in\s+(\d+)\s*(sec(?:ond)?s?)\b/i);

    if (relSec)  return Math.round(parseFloat(relSec[1]) * 1000);
    if (relMin)  return Math.round(parseFloat(relMin[1]) * 60 * 1000);
    if (relHour) return Math.round(parseFloat(relHour[1]) * 3600 * 1000);

    // Combined "in X hours Y minutes"
    const relComb = q.match(/in\s+(\d+)\s*(?:hour?s?|hr?s?)\s*(?:and\s*)?(\d+)\s*(?:min(?:ute)?s?)/i);
    if (relComb) return (parseInt(relComb[1]) * 3600 + parseInt(relComb[2]) * 60) * 1000;

    // ── Absolute: "at 5pm", "at 8:30", "at 14:30", "at 8:30am" ──
    const absMatch = q.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (absMatch) {
        let h = parseInt(absMatch[1]);
        const m = parseInt(absMatch[2] || '0');
        const ampm = (absMatch[3] || '').toLowerCase();

        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        // If no am/pm and hour < 12 and before that hour, assume later today
        // If no am/pm and hour could be am or pm, prefer the next occurrence
        if (!ampm) {
            if (h < currentH || (h === currentH && m <= currentM)) {
                h += 12; // assume pm if time has passed
            }
        }

        // Build target IST time today
        let targetMs = ((h - currentH) * 60 + (m - currentM)) * 60 * 1000;
        // If negative (already passed), schedule for tomorrow
        if (targetMs <= 0) targetMs += 24 * 3600 * 1000;
        return targetMs;
    }

    // ── Named quick times ──
    const named = {
        'half hour': 30 * 60000, 'half an hour': 30 * 60000,
        'an hour': 3600000, 'one hour': 3600000,
        'fifteen minutes': 15 * 60000, '15 minutes': 15 * 60000,
        'ten minutes': 10 * 60000, '10 minutes': 10 * 60000,
        'two hours': 2 * 3600000, '2 hours': 2 * 3600000,
    };
    for (const [phrase, ms] of Object.entries(named)) {
        if (q.includes(phrase)) return ms;
    }

    return null;
}

function isReminderIntent(q) {
    return /\b(remind|reminder|alarm|alert|notify|wake|ping|set|schedule)\b/.test(q) ||
           /\bin\s+\d/.test(q) || /\bat\s+\d/.test(q);
}

function processCoachQuery(query) {
    const q = query.toLowerCase();
    const intake   = Number(data.intake) || 0;
    const goal     = Number(data.goal)   || 2500;
    const pct      = Math.round((intake / goal) * 100);
    const neededMl = Math.max(0, goal - intake);
    const neededL  = (neededMl / 1000).toFixed(1);
    const streak   = data.streak || calculateStreak();
    const hourNow  = getISTHour();
    const history  = data.history || {};

    // Projected end-of-day
    const mlPerHour = hourNow > 0 ? intake / hourNow : 0;
    const hoursLeft = Math.max(0, 23.99 - hourNow);
    const projected = Math.round(intake + mlPerHour * hoursLeft);
    const projPct   = Math.min(100, Math.round((projected / goal) * 100));

    // 7-day average
    const histDates = Object.keys(history).sort().slice(-7);
    const avg7 = histDates.length > 0
        ? Math.round(histDates.reduce((s, d) => {
              const v = history[d];
              return s + (typeof v === 'object' ? v.total : v);
          }, 0) / histDates.length)
        : 0;

    let reply;

    // ══════════════════════════════════════════════════
    //  ⏰ ALARM / REMINDER — highest priority intent
    // ══════════════════════════════════════════════════
    if (isReminderIntent(q)) {

        // Cancel all alarms
        if (q.includes('cancel') || q.includes('stop') || q.includes('clear') || q.includes('remove')) {
            const pending = getPendingAlarms();
            if (pending.length === 0) {
                reply = "You don't have any active alarms to cancel.";
            } else {
                cancelAllCoachAlarms();
                reply = `🗑️ Cancelled **${pending.length}** alarm${pending.length > 1 ? 's' : ''}. All clear!`;
            }

        // List active alarms
        } else if (q.includes('list') || q.includes('show') || q.includes('what alarms') || q.includes('my alarm')) {
            const pending = getPendingAlarms();
            if (pending.length === 0) {
                reply = "You have no active alarms. Say something like **\"remind me at 5pm\"** or **\"set alarm in 1 hour\"** to set one!";
            } else {
                const list = pending.map((a, i) => `  ${i+1}. ⏰ ${a.label} → **${a.fireStr}**`).join('\n');
                reply = `You have **${pending.length}** active alarm${pending.length > 1 ? 's' : ''}:\n${list}`;
            }

        // Set a new alarm
        } else {
            const delayMs = parseTimeToMs(q);

            if (delayMs === null) {
                reply = `I couldn't figure out the time from that. Try:\n• **"remind me at 5pm"**\n• **"set alarm in 30 minutes"**\n• **"notify me in 2 hours"**\n• **"alert me at 8:30am"**`;
            } else if (delayMs < 5000) {
                reply = `⚠️ That's less than 5 seconds — please set a longer reminder!`;
            } else {
                if (Notification.permission !== 'granted') {
                    // Ask for permission first
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            const alarm = scheduleCoachAlarm(delayMs, query, pct);
                            const mins = Math.round(delayMs / 60000);
                            addCoachMessage(`✅ Alarm set! I'll remind you at **${alarm.fireStr}** (in ${mins > 60 ? Math.round(mins/60*10)/10+'h' : mins+'min'}). You're currently at **${pct}%**.`, 'coach');
                        } else {
                            addCoachMessage(`❌ Notifications are blocked. Please go to **Settings → Notifications** and enable them, then try again.`, 'coach');
                        }
                    });
                    return; // async — message will be added in callback
                }

                const alarm = scheduleCoachAlarm(delayMs, query, pct);
                const mins  = Math.round(delayMs / 60000);
                const durStr = delayMs < 60000
                    ? `${Math.round(delayMs/1000)}s`
                    : mins < 60
                        ? `${mins} min`
                        : `${Math.round(mins/6)/10}h`;

                reply = `✅ Alarm set! I'll remind you at **${alarm.fireStr}** (in ${durStr}).\n\nYou have **${coachAlarms.length}** active alarm${coachAlarms.length > 1 ? 's' : ''}. Say **"list alarms"** or **"cancel alarms"** to manage them.`;
            }
        }

    // ══════════════════════════════════════════════════
    //  📊 Progress / Status
    // ══════════════════════════════════════════════════
    } else if (q.includes('how am i') || q.includes('doing today') || q.includes('progress') || q.includes('status')) {
        if (pct >= 100) {
            reply = `🎉 You've hit 100% today — ${(intake/1000).toFixed(1)}L done! Your ${streak}-day streak is safe. Amazing discipline!`;
        } else {
            const pace = mlPerHour > 0
                ? `At your current pace of ${Math.round(mlPerHour)}ml/hr, you're projected to reach ~${projPct}% by midnight.`
                : `You haven't logged anything yet today.`;
            reply = `📊 You're at **${pct}%** — ${(intake/1000).toFixed(1)}L of ${(goal/1000).toFixed(1)}L. ${pace} You need ${neededL}L more to complete your goal.`;
        }

    // ══════════════════════════════════════════════════
    //  🎯 Remaining goal
    // ══════════════════════════════════════════════════
    } else if (q.includes('remaining') || q.includes('how much more') || q.includes('left') || q.includes('what is my remaining')) {
        if (neededMl <= 0) {
            reply = `🏆 Nothing left — you've hit your goal! Goal: ${(goal/1000).toFixed(1)}L, Achieved: ${(intake/1000).toFixed(1)}L.`;
        } else {
            const glasses = Math.ceil(neededMl / 250);
            reply = `🎯 You need **${neededL}L** more (~${glasses} glasses of 250ml) to hit your ${(goal/1000).toFixed(1)}L goal today.`;
        }

    // ══════════════════════════════════════════════════
    //  🔥 Streak
    // ══════════════════════════════════════════════════
    } else if (q.includes('streak') || q.includes('how is my streak') || q.includes('🔥')) {
        if (streak === 0) {
            reply = `Your streak is at 0. No worries — today is a fresh start! Log ${(goal/1000).toFixed(1)}L today to begin a new one 💪`;
        } else if (pct >= 100) {
            reply = `🔥 Your streak is **${streak} days** and it's safe — you've already hit your goal today!`;
        } else {
            reply = `🔥 Current streak: **${streak} days**. You're at ${pct}% today — drink ${neededL}L more to protect it!`;
        }

    // ══════════════════════════════════════════════════
    //  ⏰ When to drink (schedule advice)
    // ══════════════════════════════════════════════════
    } else if (q.includes('when') || q.includes('next drink') || q.includes('schedule')) {
        if (neededMl <= 0) {
            reply = `✅ You've hit your goal — no more water needed today! 🎉`;
        } else {
            const mlPerRemainingHour = hoursLeft > 0 ? Math.ceil(neededMl / hoursLeft) : neededMl;
            reply = `⏰ To finish your goal, aim to drink **~${Math.round(mlPerRemainingHour)}ml every hour** for the next ${Math.round(hoursLeft)} hours. That's just ${Math.ceil(mlPerRemainingHour / 250)} glass(es) per hour!`;
        }

    // ══════════════════════════════════════════════════
    //  💡 Tips
    // ══════════════════════════════════════════════════
    } else if (q.includes('tip') || q.includes('advice') || q.includes('suggest')) {
        const tips = [
            `💡 Start your morning with 500ml right after waking up — it kickstarts your metabolism.`,
            `💡 Drink a glass of water before every meal. It also aids digestion.`,
            `💡 Keep a water bottle visible on your desk — out of sight, out of mind!`,
            `💡 If plain water bores you, try infusing it with lemon, cucumber or mint.`,
            `💡 Thirst is already a sign of mild dehydration. Drink on a schedule, not when thirsty.`,
            `💡 Cold water is absorbed faster. Warm water aids digestion. Both count!`,
            `💡 After exercise, drink 500ml for every 30 minutes of activity.`,
        ];
        reply = tips[Math.floor(Math.random() * tips.length)];

    // ══════════════════════════════════════════════════
    //  📈 Weekly average
    // ══════════════════════════════════════════════════
    } else if (q.includes('average') || q.includes('week') || q.includes('history')) {
        if (avg7 > 0) {
            const avgPct = Math.round((avg7 / goal) * 100);
            reply = `📈 Your 7-day average is **${(avg7/1000).toFixed(1)}L/day** (${avgPct}% of goal). ${avg7 >= goal ? "Excellent consistency! 🏆" : "Keep pushing — consistency is key!"}`;
        } else {
            reply = `📈 Not enough history yet. Keep logging daily and I'll track your trends!`;
        }

    // ══════════════════════════════════════════════════
    //  👋 Greeting
    // ══════════════════════════════════════════════════
    } else if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('what can you')) {
        reply = `Hey! 👋 I'm your Hydration Coach. I can:\n• ⏰ **Set alarms** — "remind me at 5pm" / "set alarm in 2 hours"\n• 📊 **Track progress** — "how am I doing?"\n• 🎯 **Show remaining goal** — "how much left?"\n• 🔥 **Check streak** — "how is my streak?"\n• 💡 **Give tips** — "give me a tip"\n• 📈 **Weekly trends** — "show my average"\n\nJust tell me what to do!`;

    // ══════════════════════════════════════════════════
    //  Fallback
    // ══════════════════════════════════════════════════
    } else {
        reply = `I'm not sure about that. Here's your current status: **${pct}%** done (${(intake/1000).toFixed(1)}L / ${(goal/1000).toFixed(1)}L). ${neededMl > 0 ? `Need ${neededL}L more.` : `Goal complete! 🎉`}\n\nTry: **"remind me at 6pm"**, **"how am I doing?"**, or **"give me a tip"**.`;
    }

    addCoachMessage(reply, 'coach');
}

function addCoachMessage(text, sender) {
    const container = document.getElementById('coach-messages');
    if (!container) return;

    const wrap = document.createElement('div');
    wrap.className = `coach-msg-wrap ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = `coach-msg ${sender}`;
    // Support basic **bold** markdown
    bubble.innerHTML = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

    wrap.appendChild(bubble);
    container.appendChild(wrap);

    // Smooth scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Speak the reply if voice mode is on
    if (sender === 'coach') speakCoachReply(text);
}

/* ================================================================
   🎤  COACH VOICE ENGINE
   Speech-to-Text (mic input) + Text-to-Speech (spoken replies)
================================================================ */
var voiceRecognition   = null;
var voiceListening     = false;
var coachVoiceEnabled  = false; // TTS toggle

/* ── Speech-to-Text ── */
function toggleVoiceInput() {
    if (voiceListening) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

function startVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        addCoachMessage("⚠️ Your browser doesn't support voice input. Try Chrome on Android or desktop.", 'coach');
        return;
    }

    voiceRecognition = new SpeechRec();
    voiceRecognition.lang = 'en-IN';
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.maxAlternatives = 1;

    const micBtn     = document.getElementById('coach-mic-btn');
    const statusBar  = document.getElementById('coach-voice-status');
    const label      = document.getElementById('coach-voice-label');
    const inputBox   = document.getElementById('coach-input');

    // Show animated status bar
    voiceListening = true;
    if (micBtn)    { micBtn.classList.add('listening'); micBtn.textContent = '🔴'; }
    if (statusBar) statusBar.style.display = 'flex';
    if (label)     label.textContent = 'Listening...';

    voiceRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        // Show interim result in input box for visual feedback
        if (inputBox) inputBox.value = transcript;
        if (label)    label.textContent = `"${transcript}"`;
    };

    voiceRecognition.onend = () => {
        const finalText = inputBox ? inputBox.value.trim() : '';
        stopVoiceInput();
        if (finalText) {
            // Small delay so user can see what was captured
            setTimeout(() => {
                addCoachMessage(finalText, 'user');
                if (inputBox) inputBox.value = '';
                const chips = document.getElementById('coach-chips');
                if (chips) chips.innerHTML = '';
                setTimeout(() => processCoachQuery(finalText), 400);
            }, 200);
        }
    };

    voiceRecognition.onerror = (event) => {
        stopVoiceInput();
        const errMap = {
            'not-allowed':  '❌ Microphone access denied. Please allow mic permission in your browser settings.',
            'no-speech':    '🔇 No speech detected. Tap the mic and try again.',
            'network':      '🌐 Network error during voice recognition. Check your connection.',
            'aborted':      null,  // user cancelled — no message needed
        };
        const msg = errMap[event.error] || `⚠️ Voice error: ${event.error}`;
        if (msg) addCoachMessage(msg, 'coach');
    };

    voiceRecognition.start();
}

function stopVoiceInput() {
    voiceListening = false;
    if (voiceRecognition) { try { voiceRecognition.stop(); } catch(e) {} voiceRecognition = null; }

    const micBtn    = document.getElementById('coach-mic-btn');
    const statusBar = document.getElementById('coach-voice-status');
    if (micBtn)    { micBtn.classList.remove('listening'); micBtn.textContent = '🎤'; }
    if (statusBar) statusBar.style.display = 'none';
}

/* ── Text-to-Speech ── */
function toggleCoachVoice() {
    coachVoiceEnabled = !coachVoiceEnabled;
    const btn = document.getElementById('coach-voice-toggle');
    if (btn) btn.textContent = coachVoiceEnabled ? '🔊' : '🔇';
    if (!coachVoiceEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
    if (coachVoiceEnabled) addCoachMessage('🔊 Voice responses enabled. I\'ll speak my replies!', 'coach');
}

function speakCoachReply(text) {
    if (!coachVoiceEnabled) return;
    if (!window.speechSynthesis) return;

    // Strip markdown bold and emojis for cleaner TTS
    const clean = text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/[\u{1F300}-\u{1FAD6}]/gu, '')
        .replace(/•/g, '')
        .replace(/\n/g, '. ')
        .trim();

    window.speechSynthesis.cancel(); // cancel any ongoing speech
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang  = 'en-IN';
    utter.rate  = 1.05;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    // Pick a good English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        (v.lang === 'en-IN' || v.lang.startsWith('en')) && !v.name.includes('Google')
    ) || voices.find(v => v.lang.startsWith('en')) || null;
    if (preferred) utter.voice = preferred;

    window.speechSynthesis.speak(utter);
}

// 7. Navigation & Session Logic
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
        saveLocalCache(data); // Sync cloud response to local cache
        
        // Update Sidebar UI from Cloud response
        const displayElement = document.getElementById('username-display');
        const initialElement = document.getElementById('user-initial');
        const mobileInitialElement = document.getElementById('mobile-user-initial');
        if (displayElement && data.username) displayElement.innerText = data.username.toUpperCase();
        if (initialElement && data.username) initialElement.innerText = data.username[0].toUpperCase();
        if (mobileInitialElement && data.username) mobileInitialElement.innerText = data.username[0].toUpperCase();
        
        // Refresh the progress ring and stats
        refreshHome();
        checkBadges();

        // 🔔 Push reminders into the Service Worker background alarm clock
        syncRemindersToSW();

    } catch (err) {
        console.error("Cloud connection failed:", err);
        showToast("Error loading profile from Cloud.");
    }
}

// ── DELETE ACCOUNT MODAL LOGIC ──
function togglePassVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = '🔒';
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

function syncRemindersToSW() { /* intentionally empty */ }

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
       The page setInterval drives timing; sendSystemNotification
       routes through SW controller for the actual popup.
    ============================================================ */
    if (data && Array.isArray(data.reminders)) {
        let changed = false;
        data.reminders.forEach((r) => {
            if (r && r.active !== false && r.time === currentTime) {
                if (r.lastFiredMinute !== currentTime) {
                    r.lastFiredMinute = currentTime;
                    const randomMsg = typeof getRandomReminder === 'function' ? getRandomReminder() : "Time to stay hydrated!";
                    sendSystemNotification("💧 Hydration Reminder", `🔔 ${r.time} — ${randomMsg}`);
                    if (r.daily === false && r.source !== 'coach') r.active = false;
                    changed = true;
                }
            }
        });
        // Permanently delete coach alarms after they fire
        const initialLen = data.reminders.length;
        data.reminders = data.reminders.filter(r => !(r.source === 'coach' && r.lastFiredMinute === currentTime));
        if (data.reminders.length !== initialLen || changed) {
            if (typeof renderCloudReminders === 'function') renderCloudReminders();
            if (typeof loadReminders === 'function') loadReminders();
            if (typeof syncToCloud === 'function') syncToCloud();
        }
    }

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
       3. POST-MEAL REMINDERS
    ============================================================ */
    if (data.postMealEnabled && data.mealTimes) {
        const mealKeys  = ['bfast', 'lunch', 'dinner'];
        const mealNames = { bfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

        mealKeys.forEach(key => {
            const mealTime = data.mealTimes[key];
            if (mealTime) {
                let [hours, minutes] = mealTime.split(':').map(Number);
                minutes += 30;
                if (minutes >= 60) { hours = (hours + 1) % 24; minutes -= 60; }
                const triggerTime = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
                if (triggerTime === currentTime) {
                    sendSystemNotification('🥗 Post-Meal Reminder', `30 mins since ${mealNames[key]} — time to hydrate!`);
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

// NOTIFICATIONS & MOBILE PWA SERVICE WORKER WITH WEB PUSH
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function registerPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const reg = await navigator.serviceWorker.ready;

        // Fetch current VAPID public key from server
        const keyRes = await fetch(`${API_URL}/api/push/vapid-public-key`);
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        const existingSub = await reg.pushManager.getSubscription();
        const storedVapidKey = localStorage.getItem('ht_vapid_key');

        if (existingSub && storedVapidKey === publicKey) {
            // ✅ Stable existing subscription with same VAPID key — just re-save to server
            // DO NOT unsubscribe — this keeps the endpoint stable for FCM delivery
            // even when browser is closed
            await fetch(`${API_URL}/api/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, subscription: existingSub })
            });
            console.log('✅ Push subscription confirmed (stable endpoint preserved)');
            return;
        }

        // VAPID key changed or no existing subscription — create fresh one
        if (existingSub) {
            try { await existingSub.unsubscribe(); } catch(e) {}
        }

        const newSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Store the VAPID key used so we can detect key changes later
        localStorage.setItem('ht_vapid_key', publicKey);

        const saveRes = await fetch(`${API_URL}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, subscription: newSub })
        });
        const saveData = await saveRes.json();
        console.log('✅ New Web Push subscription registered:', saveData.message);
    } catch (err) {
        console.warn('Push registration error (non-fatal):', err.message || err);
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('✅ ServiceWorker registered');
            registerPushSubscription();
        }).catch(err => console.log('SW Registration error:', err));
    });
}

// Web Audio API Chime for Alarms — plays even from background tabs
function playAlarmSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // Resume suspended context (browsers suspend AudioContext for background tabs)
        const doPlay = () => {
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
            gain1.gain.setValueAtTime(0.4, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc1.connect(gain1); gain1.connect(ctx.destination);
            osc1.start(); osc1.stop(ctx.currentTime + 0.5);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.2); osc2.stop(ctx.currentTime + 0.7);
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(doPlay).catch(() => {});
        } else {
            doPlay();
        }
    } catch(e) {}
}

// Full-screen alarm modal that cannot be missed
function showAlarmModal(title, message) {
    // Remove existing modal if present
    const existing = document.getElementById('hydrotrack-alarm-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'hydrotrack-alarm-modal';
    modal.innerHTML = `
        <div style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999999;
            background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
            animation: fadeInModal 0.3s ease;
        ">
            <div style="
                background: linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #1976d2 100%);
                border-radius: 24px; padding: 40px 36px; text-align: center; max-width: 360px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5); color: white;
                animation: bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
            ">
                <div style="font-size: 64px; margin-bottom: 12px;">💧</div>
                <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 800;">${title}</h2>
                <p style="margin: 0 0 28px; font-size: 15px; opacity: 0.9; line-height: 1.5;">${message}</p>
                <button onclick="document.getElementById('hydrotrack-alarm-modal').remove()" style="
                    background: white; color: #1565c0; border: none; border-radius: 12px;
                    padding: 12px 32px; font-size: 15px; font-weight: 700; cursor: pointer;
                ">Dismiss ✓</button>
            </div>
        </div>
        <style>
            @keyframes fadeInModal { from { opacity: 0 } to { opacity: 1 } }
            @keyframes bounceIn { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        </style>
    `;
    document.body.appendChild(modal);

    // Auto-dismiss after 60 seconds
    setTimeout(() => { if (document.getElementById('hydrotrack-alarm-modal')) modal.remove(); }, 60000);
}

function sendSystemNotification(title, message) {
    // 1. Play alarm chime
    playAlarmSound();

    // 2. Show in-app toast (always)
    if (typeof showToast === 'function') showToast(`🔔 ${title}`);

    // 3. Show full-screen alarm modal (cannot be missed)
    showAlarmModal(title, message);

    // 4. OS-level notification (for when app is NOT visible)
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Try new Notification() directly first (most reliable for open browser tabs)
    try {
        const n = new Notification(title, {
            body: message,
            icon: './icon-192x192.png',
            tag: 'hydrotrack-' + Date.now(),
            renotify: true,
            requireInteraction: true
        });
        n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {
        // Fallback to SW showNotification (required in some browsers for PWA context)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, {
                    body: message,
                    icon: './icon-192x192.png',
                    badge: './icon-192x192.png',
                    tag: 'hydrotrack-' + Date.now(),
                    renotify: true,
                    requireInteraction: true,
                    vibrate: [200, 100, 200]
                });
            }).catch(() => {});
        }
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
    lineColor: "rgba(56, 165, 235, 0.35)",
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
try { localStorage.removeItem('pwa_installed'); } catch(e) {}

function isAppStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') ||
           window.location.search.includes('mode=standalone');
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function updatePWAInstallButtons() {
    const standalone = isAppStandalone();
    const btns = document.querySelectorAll('.install-app-btn');

    // If running inside standalone app mode, hide install button completely
    if (standalone) {
        btns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));
        return;
    }

    // In web browser mode: ALWAYS show install button so user can download/install
    btns.forEach(btn => {
        btn.style.setProperty('display', 'flex', 'important');
    });
}

/* iOS: Show a custom "Add to Home Screen" tip banner */
function showIOSInstallBanner() {
    if (!isIOS() || isAppStandalone() || localStorage.getItem('ios_banner_dismissed')) return;

    const existing = document.getElementById('ios-install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'ios-install-banner';
    banner.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(10,20,40,0.95); color: #fff; border-radius: 18px;
        padding: 14px 20px; z-index: 999999; max-width: 320px; width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35); backdrop-filter: blur(12px);
        font-size: 0.875rem; text-align: center; line-height: 1.5;
        border: 1px solid rgba(255,255,255,0.15); animation: slideUpFade 0.4s ease;
    `;
    banner.innerHTML = `
        <div style="font-size:1.5rem;margin-bottom:6px">📲</div>
        <strong style="display:block;margin-bottom:6px;font-size:1rem">Install Hydro Tracker</strong>
        Tap <strong>Share</strong> <span style="font-size:1.1rem">⬆️</span> then
        <strong>"Add to Home Screen"</strong> to install as an app.
        <button onclick="document.getElementById('ios-install-banner').remove();localStorage.setItem('ios_banner_dismissed','true')"
            style="display:block;margin:10px auto 0;padding:7px 22px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:30px;color:#fff;font-size:0.8rem;cursor:pointer;">
            Got it
        </button>
    `;
    document.body.appendChild(banner);

    setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 10000);
}

/* Chrome / Android / Desktop Install Guide Banner */
function showBrowserInstallBanner() {
    const existing = document.getElementById('browser-install-banner');
    if (existing) { existing.remove(); return; }

    const banner = document.createElement('div');
    banner.id = 'browser-install-banner';
    banner.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(10,20,40,0.95); color: #fff; border-radius: 18px;
        padding: 16px 20px; z-index: 999999; max-width: 340px; width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35); backdrop-filter: blur(12px);
        font-size: 0.875rem; text-align: center; line-height: 1.5;
        border: 1px solid rgba(255,255,255,0.15); animation: slideUpFade 0.4s ease;
    `;
    banner.innerHTML = `
        <div style="font-size:1.5rem;margin-bottom:6px">📲</div>
        <strong style="display:block;margin-bottom:6px;font-size:1rem">Install Hydro Tracker</strong>
        Tap browser menu <strong style="font-size:1.1rem">⋮</strong> or Share icon, then select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong>.
        <button onclick="document.getElementById('browser-install-banner').remove()"
            style="display:block;margin:12px auto 0;padding:7px 24px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:30px;color:#fff;font-size:0.8rem;cursor:pointer;font-weight:700;">
            Got it
        </button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 12000);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    window.deferredPWAInstallPrompt = e;
    updatePWAInstallButtons();
});

async function triggerPWAInstall() {
    if (deferredPWAInstallPrompt) {
        deferredPWAInstallPrompt.prompt();
        try {
            const choice = await deferredPWAInstallPrompt.userChoice;
            if (choice && choice.outcome === 'accepted') {
                deferredPWAInstallPrompt = null;
                window.deferredPWAInstallPrompt = null;
                updatePWAInstallButtons();
            }
        } catch(e) {}
    } else if (isIOS()) {
        localStorage.removeItem('ios_banner_dismissed');
        showIOSInstallBanner();
    } else {
        showBrowserInstallBanner();
    }
}

window.addEventListener('appinstalled', () => {
    deferredPWAInstallPrompt = null;
    window.deferredPWAInstallPrompt = null;
    updatePWAInstallButtons();
    if (typeof showToast === 'function') showToast('Hydro Tracker Installed Successfully! 🎉');
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        updatePWAInstallButtons();
        if (isIOS() && !isAppStandalone()) setTimeout(showIOSInstallBanner, 1500);
        restoreCoachAlarms(); // ⏰ Re-register any coach alarms saved before this page refresh
    });
} else {
    updatePWAInstallButtons();
    if (isIOS() && !isAppStandalone()) setTimeout(showIOSInstallBanner, 1500);
    restoreCoachAlarms(); // ⏰ Re-register any coach alarms saved before this page refresh
}

