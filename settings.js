/* ═══════════════════════════════════════════════
   THEME ENGINE — settings.js
   Five presets. Each entry maps to the CSS-variable
   keys defined in home.css :root.
   ═══════════════════════════════════════════════ */
var API_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : "http://localhost:5000";

var token = localStorage.getItem('token');
var isDataReady = typeof isDataReady !== 'undefined' ? isDataReady : false;
var data = typeof data !== 'undefined' ? data : {
    username: "Loading...",
    goal: 2500,
    reminders: [
        { time: "08:00", daily: true, active: true },
        { time: "12:00", daily: true, active: true },
        { time: "18:00", daily: true, active: true },
        { time: "21:00", daily: true, active: true }
    ],
    mealTimes: { bfast: "08:30", lunch: "13:30", dinner: "20:30" },
    postMealEnabled: false
};

async function loadUserData() {
    if (!token) return window.location.href = 'index.html';

    try {
        const response = await fetch(`${API_URL}/api/user/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Unauthorized");

        const cloudData = await response.json(); 
        data = cloudData;
        
        if (!data.mealTimes || !data.mealTimes.bfast) {
            data.mealTimes = { bfast: "08:30", lunch: "13:30", dinner: "20:30" };
        }
        if (!data.reminders || data.reminders.length === 0) {
            data.reminders = [
                { time: "08:00", daily: true, active: true },
                { time: "12:00", daily: true, active: true },
                { time: "18:00", daily: true, active: true },
                { time: "21:00", daily: true, active: true }
            ];
        }

        isDataReady = true;     

        const displayElement = document.getElementById('username-display');
        const initialElement = document.getElementById('user-initial');
        const mobileInitialElement = document.getElementById('mobile-user-initial');
        if (displayElement && data.username) displayElement.innerText = data.username.toUpperCase();
        if (initialElement && data.username) initialElement.innerText = data.username[0].toUpperCase();
        if (mobileInitialElement && data.username) mobileInitialElement.innerText = data.username[0].toUpperCase();

    } catch (err) {
        console.error("Cloud connection failed:", err);
    }
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

async function syncToCloud() {
    if (!isDataReady || !token || data.username === "Loading...") return;

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
const THEME_KEYS = [
    '--accent','--accent-light','--accent-dark','--accent-rgb',
    '--accent-glow','--accent-subtle','--bg-gradient',
    '--glass-bg','--glass-border','--text-primary','--text-secondary',
    '--sidebar-bg','--sidebar-border','--sidebar-brand-text','--nav-text'
];
const THEME_PRESETS = {
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

function applyTheme(name) {
    if (!THEME_PRESETS[name]) name = 'ocean';
    const vals = THEME_PRESETS[name];
    const root = document.documentElement.style;
    THEME_KEYS.forEach((k, i) => root.setProperty(k, vals[i]));
    localStorage.setItem('hydroTheme', name);
    // Highlight the active swatch
    document.querySelectorAll('.theme-swatch').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === name);
    });
    showToast(`Theme: ${name.charAt(0).toUpperCase() + name.slice(1)} 🎨`);
}

// Apply stored theme immediately (prevents flash)
(function() {
    let name = localStorage.getItem('hydroTheme') || 'ocean';
    if (!THEME_PRESETS[name]) { name = 'ocean'; localStorage.setItem('hydroTheme', 'ocean'); }
    const vals = THEME_PRESETS[name];
    const root = document.documentElement.style;
    THEME_KEYS.forEach((k, i) => root.setProperty(k, vals[i]));
})();

// Dataset: 100 Unique Reminders

const hydrationTexts = [

"💧 Time for a splash! Drink some water.",
"Your brain is 75% water. Feed it!",
"Stay hydrated, stay legendary.",
"Glow from the inside out. Sip now!",
"One glass now = More energy later.",
"Feeling tired? Water is the cure.",
"H2O is the way to go!",
"Sip, sip, hooray!",
"Don't wait for thirst, hydrate first.",
"Water: The original energy drink.",

"Refill your energy with water.",
"A sip a day keeps fatigue away.",
"Hydrate your greatness.",
"Clear mind starts with clear water.",
"Drink now, thank yourself later.",
"Hydration = Power.",
"Stay fresh, drink water.",
"Water fuels your hustle.",
"Hydrate like a champion.",
"Take a break, take a sip.",

"Small sips, big benefits.",
"Water today, wellness tomorrow.",
"Be cool, drink water.",
"Keep calm and hydrate.",
"Hydrate your hustle.",
"Drink up, level up.",
"Water makes everything better.",
"Hydrate and dominate.",
"Fuel your focus with water.",
"Drink water, stay unstoppable.",

"Your body will thank you.",
"Hydration is self-care.",
"Hydrate to feel great.",
"Drink water, boost power.",
"A hydrated body is a happy body.",
"Every sip counts.",
"Refuel with water.",
"Stay hydrated, stay sharp.",
"Water keeps you winning.",
"Sip smart, live well.",

"Water is life.",
"Drink water, stay awesome.",
"Hydrate for success.",
"Be a hydration hero.",
"Keep the water flowing.",
"Stay hydrated, stay focused.",
"Water boosts your mood.",
"Hydration is motivation.",
"Drink water, feel better.",
"Keep sipping greatness.",

"Hydration unlocks energy.",
"Refresh your body.",
"Hydrate to elevate.",
"Your body needs water now.",
"Sip your way to health.",
"Stay cool with water.",
"Hydration keeps you going.",
"Drink water, power up.",
"Stay hydrated, shine bright.",
"Hydrate for clarity.",

"Water keeps you balanced.",
"Sip some happiness.",
"Hydrate for strength.",
"Drink water, feel alive.",
"Stay hydrated, stay happy.",
"Water fuels your day.",
"Drink to think better.",
"Hydrate your potential.",
"Stay hydrated, stay winning.",
"Refresh your mind.",

"Drink water, conquer the day.",
"Hydrate for productivity.",
"Water keeps you energized.",
"Hydration builds stamina.",
"Drink water, stay vibrant.",
"Hydrate your ambition.",
"Stay refreshed with water.",
"Hydrate to dominate.",
"Drink water for clarity.",
"Water powers performance.",

"Hydrate your body and mind.",
"Drink water for strength.",
"Hydrate and shine.",
"Water keeps your brain sharp.",
"Stay refreshed, stay hydrated.",
"Drink water and thrive.",
"Hydrate for endurance.",
"Water is pure energy.",
"Stay hydrated, stay unstoppable.",
"Drink water and glow.",

"Hydration is your superpower.",
"Drink water, feel unstoppable.",
"Hydrate for greatness.",
"Stay hydrated, stay powerful.",
"Drink water and succeed.",
"Hydration is victory fuel.",
"Water strengthens your focus.",
"Drink water, achieve more.",
"Hydrate your dreams.",
"Stay hydrated, stay legendary.",

"Drink water for peak performance.",
"Hydrate to recharge.",
"Water refreshes everything.",
"Stay hydrated, stay fearless.",
"Drink water and conquer.",
"Hydrate your confidence.",
"Water keeps you sharp.",
"Drink water and power through.",
"Hydrate your inner champion.",
"Stay hydrated and unstoppable.",

"Water boosts your brilliance.",
"Drink water for a fresh start.",
"Hydrate and feel amazing.",
"Water fuels creativity.",
"Stay hydrated and thrive.",
"Drink water and keep moving.",
"Hydrate your success.",
"Water keeps the momentum.",
"Stay hydrated and energized.",
"Drink water and stay strong."

];

function getRandomReminder() {
    return hydrationTexts[Math.floor(Math.random() * hydrationTexts.length)];
}

// Safety alias so old browser caches calling showNotification don't throw ReferenceError
if (typeof window.showNotification !== 'function') {
    window.showNotification = function(msg) {
        if (typeof showToast === 'function') showToast(msg);
    };
}

// Show the current notification permission status in the banner
function updateNotifPermissionBanner() {
    const statusEl = document.getElementById('notif-permission-status');
    const btn = document.getElementById('notif-enable-btn');
    if (!statusEl || !("Notification" in window)) return;

    const perm = Notification.permission;
    if (perm === 'granted') {
        statusEl.textContent = '✅ Notifications are enabled';
        statusEl.style.color = '#2e7d32';
        if (btn) { btn.textContent = '✔ Enabled'; btn.disabled = true; btn.style.opacity = '0.6'; }
    } else if (perm === 'denied') {
        statusEl.textContent = '🚫 Blocked — Click the 🔒 icon in your browser address bar to Allow';
        statusEl.style.color = '#c62828';
        if (btn) { btn.textContent = 'Blocked'; btn.disabled = true; btn.style.opacity = '0.6'; }
    } else {
        statusEl.textContent = '⚠️ Tap "Enable" to receive hydration reminders';
        statusEl.style.color = '#e65100';
    }
}

// Must be called from a direct user click — browsers block auto-prompts
function requestNotifPermission() {
    if (!("Notification" in window)) {
        showToast("Your browser doesn't support notifications.");
        return;
    }
    if (Notification.permission === 'granted') {
        showToast("Notifications are already enabled!");
        return;
    }
    Notification.requestPermission().then(permission => {
        updateNotifPermissionBanner();
        if (permission === 'granted') {
            // Fire a test notification via Service Worker so the user sees it immediately
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification('💧 HydroTrack', {
                        body: 'Notifications enabled! You will get hydration reminders.',
                        icon: 'icon-192x192.png',
                        badge: 'icon-192x192.png',
                        tag: 'hydrotrack-test',
                        vibrate: [200, 100, 200]
                    });
                });
            }
            if (typeof registerPushSubscription === 'function') {
                registerPushSubscription();
            }
            showToast("Notifications enabled! ✅");
        } else {
            showToast("Permission denied. Enable from browser settings.");
        }
    });
}

// Run banner update and register push subscription on settings page load
document.addEventListener('DOMContentLoaded', () => {
    updateNotifPermissionBanner();
    if (typeof registerPushSubscription === 'function') {
        registerPushSubscription();
    }
});

async function testPushNotification() {
    const token = localStorage.getItem('token');
    if (!token) return showToast("Please log in first.");

    if (Notification.permission !== 'granted') {
        return showToast("Please click 'Enable Notifications' first!");
    }

    // 1. Immediately trigger a local native OS notification banner to test OS display
    if (typeof sendSystemNotification === 'function') {
        sendSystemNotification("💧 HydroTrack Test", "Local test notification! OS banner pipeline is active.");
    }

    // 2. Refresh push subscription token with server
    if (typeof registerPushSubscription === 'function') {
        await registerPushSubscription();
    }

    // 3. Send Web Push request to Render server
    try {
        showToast("Requesting server Web Push...");
        const res = await fetch(`${API_URL}/api/push/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || "Test push sent! Check your device notifications.");
        } else {
            showToast("Push error: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        showToast("Push test error: " + err.message);
    }
}

function sendDesktopAlert(title, message) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Always use Service Worker showNotification — works in both browser and installed PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
                body: message,
                icon: 'icon-192x192.png',
                badge: 'icon-192x192.png',
                tag: 'hydrotrack-alert',
                renotify: true,
                vibrate: [200, 100, 200]
            });
        }).catch(() => {
            try { new Notification(title, { body: message, icon: 'icon-192x192.png' }); } catch (e) {}
        });
    } else {
        try { new Notification(title, { body: message, icon: 'icon-192x192.png' }); } catch (e) {}
    }
}


function setNotifMode(mode) {
    const btnSpecific = document.getElementById('btn-specific');
    const btnInterval = document.getElementById('btn-interval');
    const specOptions = document.getElementById('specific-options');
    const intOptions = document.getElementById('interval-options');

    // Only update if the elements exist in the HTML
    if (btnSpecific) btnSpecific.className = mode === 'specific' ? 'active' : '';
    if (btnInterval) btnInterval.className = mode === 'interval' ? 'active' : '';
    
    if (specOptions) specOptions.style.display = mode === 'specific' ? 'block' : 'none';
    if (intOptions) intOptions.style.display = mode === 'interval' ? 'block' : 'none';
}

async function saveGlobalGoal() {
    const goalInput = document.getElementById('goal-val');
    if (!goalInput) return;

    const newGoalLiters = parseFloat(goalInput.value);

    // 1. Validation
    if (newGoalLiters > 0) {
        // Update the global data object (Cloud state)
        // Convert Liters to milliliters for the MERN schema
        data.goal = newGoalLiters * 1000; 
        
        // 2. Sync to MongoDB using the central function
        // This avoids hardcoding URLs and redundant fetch blocks
        await syncToCloud(); 

        showToast(`🎯 Target updated to ${newGoalLiters}L!`);
        
        // 3. Optional: Redirect after cloud confirmation
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1200);
    } else {
        showToast("❌ Please enter a valid number (e.g., 2.5)");
    }
}



async function updatePassword() {
    const currP = document.getElementById('curr-pass').value.trim();
    const newP  = document.getElementById('new-pass').value.trim();
    const confP = document.getElementById('conf-pass').value.trim();

    if (!currP || !newP || !confP) {
        return showToast("❌ Please fill in all password fields.");
    }
    if (newP !== confP) {
        return showToast("❌ New passwords do not match.");
    }
    if (newP.length < 6) {
        return showToast("❌ Password must be at least 6 characters.");
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/update-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, currentPassword: currP, newPassword: newP })
        });

        const result = await response.json();

        if (response.ok) {
            showToast("✅ Password updated successfully!");
            clearPassFields();
        } else {
            showToast(`❌ ${result.error}`);
        }
    } catch (err) {
        showToast("❌ Cloud connection failed. Please try again.");
    }
}

function clearPassFields() {
    document.getElementById('curr-pass').value = "";
    document.getElementById('new-pass').value = "";
    document.getElementById('conf-pass').value = "";
}

function loadReminders() {
    const list = document.getElementById('reminders-list');
    if (!list || !data || !data.reminders) return;

    list.innerHTML = "";

    // FIX: Filter by 'active' (the checkbox) rather than 'daily' (the toggle)
    const activeReminders = data.reminders.filter(rem => rem.active === true);

    if (activeReminders.length === 0) {
        list.innerHTML = `<p style="text-align:center; opacity:0.5; padding:20px;">No active reminders.</p>`;
        return;
    }

    activeReminders.forEach(rem => {
        const reminderDiv = document.createElement('div');
        reminderDiv.className = 'reminder-item';
        
        // Show whether it is a Daily or One-Time (Once) alarm
        const typeLabel = rem.daily ? '🔁 DAILY' : '⏱️ ONCE';

        reminderDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="time-tag">🔔 ${rem.time}</span> 
                <span style="font-size:0.7rem; color:#1565c0; font-weight:bold; background:#f0f4f8; padding:2px 8px; border-radius:5px;">
                    ${typeLabel} • ACTIVE
                </span>
            </div>
            <span class="msg-tag">"${getRandomReminder()}"</span>
        `;
        list.appendChild(reminderDiv);
    });
}

// Helper to uncheck a box and refresh
function removeReminder(time) {
    const box = document.querySelector(`.dummy-times input[value="${time}"]`);
    if (box) box.checked = false;
    loadReminders();
}

async function toggleIntervalFeature() {
    const isEnabled = document.getElementById('interval-master-toggle').checked;
    const inputArea = document.getElementById('interval-input-area');
    
    if (isEnabled) {
        // Corrected camelCase for JavaScript styles
        inputArea.style.opacity = "1";
        inputArea.style.pointerEvents = "auto"; 
        showToast("Interval reminders active! 💧");
    } else {
        inputArea.style.opacity = "0.5";
        inputArea.style.pointerEvents = "none";
        showToast("Interval reminders disabled.");
    }

    // Save the toggle state to our global data object and sync to MongoDB 
    data.intervalEnabled = isEnabled;
    await syncToCloud();
}


async function addManualTime() {
    const timeInput = document.getElementById('manual-t');
    const timeValue = timeInput.value;

    if (!timeValue) return showToast("❌ Select a time.");

    // Create the new reminder object
    const newReminder = {
        time: timeValue,
        daily: true, 
        active: true
    };

    // Push to existing array instead of overwriting
    if (!data.reminders) data.reminders = [];
    data.reminders.push(newReminder);

    // Sort times so they appear in chronological order
    data.reminders.sort((a, b) => a.time.localeCompare(b.time));

    await syncToCloud(); // Save to MongoDB
    if (typeof syncRemindersToSW === 'function') syncRemindersToSW();
    renderCloudReminders(); // Re-render the list
    timeInput.value = "";
    showToast(`✅ Added ${timeValue}`);
}

async function deleteReminder(index) {
    // Remove the item from the local data array immediately
    const deletedTime = data.reminders[index].time;
    data.reminders.splice(index, 1); 

    // Sync the change to MongoDB
    await syncToCloud(); 

    // Re-render the UI so the row disappears
    renderCloudReminders(); 

    // Use your existing toast for non-intrusive feedback
    showToast(`🗑️ Deleted reminder for ${deletedTime}`);
}

async function updateReminderStatus(index, isChecked) {
    data.reminders[index].active = isChecked;
    await syncToCloud();
    loadReminders();
}

async function updateReminderType(index, isDaily) {
    data.reminders[index].daily = isDaily;
    await syncToCloud();
    loadReminders();
}

// Function to validate and toggle Post-Meal reminders
async function togglePostMeal() {
    const toggle = document.getElementById('post-meal-toggle');
    if (!toggle) return;
    
    if (!data.mealTimes || typeof data.mealTimes !== 'object') {
        data.mealTimes = { bfast: "08:30", lunch: "13:30", dinner: "20:30" };
    }
    if (!data.mealTimes.bfast) data.mealTimes.bfast = "08:30";
    if (!data.mealTimes.lunch) data.mealTimes.lunch = "13:30";
    if (!data.mealTimes.dinner) data.mealTimes.dinner = "20:30";

    data.postMealEnabled = toggle.checked; 
    await syncToCloud();
    
    showToast(data.postMealEnabled ? "🥗 Post-Meal Reminders Active!" : "Post-Meal Reminders Disabled");
}

async function toggleLeaderboardOptIn() {
    const toggle = document.getElementById('leaderboard-toggle');
    if (!toggle) return;

    data.leaderboardOptIn = toggle.checked;
    saveLocalCache(data);
    await syncToCloud();

    showToast(data.leaderboardOptIn ? "🏆 Joined Community Leaderboard!" : "Hidden from Leaderboard");
}

function renderCloudReminders() {
    const container = document.querySelector('.dummy-times');
    if (!container || !data.reminders) return;

    container.innerHTML = ""; 

    data.reminders.forEach((rem, index) => {
        const row = document.createElement('div');
        row.className = 'time-toggle-row';
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <label class="switch small" title="Toggle On/Off">
                    <input type="checkbox" value="${rem.time}" ${rem.active ? 'checked' : ''} 
                           onchange="updateReminderStatus(${index}, this.checked)"> 
                    <span class="slider"></span>
                </label>
                <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary, #0c4a6e);">🔔 ${rem.time}</span>
            </div>
            <div class="daily-wrapper">
                <span>Daily</span>
                <label class="switch small">
                    <input type="checkbox" class="daily-toggle" ${rem.daily ? 'checked' : ''} 
                           onchange="updateReminderType(${index}, this.checked)">
                    <span class="slider"></span>
                </label>
                <button onclick="deleteReminder(${index})" style="background:none; border:none; margin-left:10px; cursor:pointer;" title="Delete Reminder">🗑️</button>
            </div>
        `;
        container.appendChild(row);
    });

    // CRITICAL: Refresh the summary list whenever the main list is rendered
    loadReminders(); 
}

// Helper to display human-readable time
function formatTo12Hr(time24) {
    if (!time24) return "";
    let [hours, minutes] = time24.split(':');
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}


window.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial UI Setup
    setNotifMode('specific');

    // 2. Fetch Fresh Data from MongoDB
    // We 'await' this so the 'data' object is fully populated before we touch the UI
    await loadUserData(); 

    // ✅ FIX 1: Update Sidebar Profile with Cloud Data
    if (data && data.username) {
        const nameDisplay = document.getElementById('username-display');
        const initialDisplay = document.getElementById('user-initial');
        const mobileInitialDisplay = document.getElementById('mobile-user-initial');
        
        if (nameDisplay) nameDisplay.innerText = data.username.toUpperCase();
        if (initialDisplay) initialDisplay.innerText = data.username[0].toUpperCase();
        if (mobileInitialDisplay) mobileInitialDisplay.innerText = data.username[0].toUpperCase();
    }

    // ✅ FIX 2: Sync Post-Meal Toggle (Ensures it stays ON if saved in Cloud)
    const postMealToggle = document.getElementById('post-meal-toggle');
    if (postMealToggle) {
        // Use a direct boolean check from the cloud data
        postMealToggle.checked = (data.postMealEnabled === true);
    }

    // ✅ FIX 3: Sync Leaderboard Participation Toggle (ON by default)
    const leaderboardToggle = document.getElementById('leaderboard-toggle');
    if (leaderboardToggle) {
        leaderboardToggle.checked = (data.leaderboardOptIn !== false);
    }

    // 3. Goal Input Initialization
    const goalInput = document.getElementById('goal-val');
    if (goalInput && data.goal) {
        goalInput.value = (data.goal / 1000).toFixed(1); 
    }

    // 4. Handle Default Reminders (Only for first-time users)
    if (!data.reminders || data.reminders.length === 0) {
        data.reminders = [
            { time: "07:00", daily: true, active: false },
            { time: "11:00", daily: true, active: false },
            { time: "14:00", daily: true, active: false },
            { time: "17:00", daily: true, active: false }
        ];

        // Save these defaults to the cloud so they persist
        await syncToCloud(); 
    }

    // 5. Render the UI
    renderCloudReminders();

    // 6. Initialize theme swatches
    const savedTheme = localStorage.getItem('hydroTheme') || 'ocean';
    document.querySelectorAll('.theme-swatch').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });
});



function checkIntervalInput() {
    const input = document.getElementById('interval-min');
    const doneBtn = document.getElementById('interval-done-btn');
    
    // Show the button as soon as there is any text in the box
    if (input.value.length > 0) {
        doneBtn.style.display = 'block';
    } else {
        doneBtn.style.display = 'none';
    }
}

// Add this inside your script or at the top of settings.js
function handlePointer(e) {
    const b = document.getElementById('waves-bg').getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Update the global mouse object used by the WaterWaves class
    if (window.wavesInstance) {
        window.wavesInstance.mouse.x = x - b.left;
        window.wavesInstance.mouse.y = y - b.top;
        window.wavesInstance.mouse.set = true;
    }
}

window.addEventListener('mousemove', handlePointer);
window.addEventListener('touchmove', handlePointer, { passive: true });

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-msg'; // Styling from insights.css or global
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}


function saveInterval() {
    const intervalValue = document.getElementById('interval-min').value;
    if (!intervalValue || intervalValue <= 0) {
        showToast("❌ Please enter a valid interval");
    } else {
        showToast(`✅ Reminders set every ${intervalValue} minutes`);
    }
}


function togglePass(inputId) {
    const input = document.getElementById(inputId);
    const eye = event.currentTarget; // The span that was clicked

    if (input.type === "password") {
        input.type = "text";
        eye.innerText = "🔒"; // Change icon to locked when visible
    } else {
        input.type = "password";
        eye.innerText = "👁️"; // Change back to eye when hidden
    }
}

/* ── PWA INSTALLATION & OPEN IN APP LOGIC ── */
var deferredPWAInstallPrompt = window.deferredPWAInstallPrompt || null;

function isAppStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

function updatePWAInstallButtons() {
    if (isAppStandalone()) {
        document.querySelectorAll('.install-app-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        return;
    }

    const isInstalled = localStorage.getItem('pwa_installed') === 'true';
    const btns = document.querySelectorAll('.install-app-btn');

    btns.forEach(btn => {
        if (isInstalled) {
            btn.style.display = 'flex';
            const icon = btn.querySelector('.nav-icon, .mob-nav-icon');
            const label = btn.querySelector('.nav-label, .mob-nav-label');
            if (icon) icon.textContent = '🚀';
            if (label) label.textContent = btn.classList.contains('mob-nav-item') ? 'Open App' : 'Open App';
        } else if (deferredPWAInstallPrompt) {
            btn.style.display = 'flex';
            const icon = btn.querySelector('.nav-icon, .mob-nav-icon');
            const label = btn.querySelector('.nav-label, .mob-nav-label');
            if (icon) icon.textContent = '📲';
            if (label) label.textContent = btn.classList.contains('mob-nav-item') ? 'Install' : 'Install App';
        } else {
            btn.style.display = 'none';
        }
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    window.deferredPWAInstallPrompt = e;
    updatePWAInstallButtons();
});

function openInApp() {
    const currentHost = window.location.host;
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    const intentUrl = `intent://${currentHost}${currentPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`;

    if (/android/i.test(navigator.userAgent)) {
        window.location.href = intentUrl;
    } else {
        window.location.href = 'settings.html';
    }
}

async function triggerPWAInstall() {
    const isInstalled = localStorage.getItem('pwa_installed') === 'true';
    if (isInstalled || !deferredPWAInstallPrompt) {
        openInApp();
        return;
    }

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

// ── COMMUNITY LEADERBOARD OPT-IN TOGGLE ──
async function toggleLeaderboardOptIn() {
    const toggle = document.getElementById('leaderboard-toggle');
    if (!toggle) return;

    const optIn = toggle.checked;
    data.leaderboardOptIn = optIn;
    saveLocalCache(data);

    try {
        await fetch(`${API_URL}/api/user/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ leaderboardOptIn: optIn })
        });
        showToast(optIn ? '🏆 You are now on the community leaderboard!' : '👤 Removed from community leaderboard.');
    } catch (err) {
        console.error('Failed to update leaderboard opt-in:', err);
        showToast('Could not save setting. Try again.');
        // Revert toggle on failure
        toggle.checked = !optIn;
        data.leaderboardOptIn = !optIn;
    }
}

// Mobile avatar dropdown toggle (for pages that don't load home.js)
function toggleMobileLogout() {
    const menu = document.getElementById('mobile-logout-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

