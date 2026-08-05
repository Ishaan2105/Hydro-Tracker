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

if (typeof API_URL === 'undefined') {
    window.API_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
        ? window.location.origin
        : "http://localhost:5000";
}
if (typeof token === 'undefined') {
    window.token = localStorage.getItem('token');
}

// Use 'var' or check 'window' to allow sharing across scripts
if (typeof isDataReady === 'undefined') {
    window.isDataReady = false; 
}

// Merge or initialize the cloud data object
if (typeof data === 'undefined') {
    window.data = {
        username: "Loading...",
        goal: 2500,
        intake: 0,
        history: {},
        mealTimes: { bfast: "", lunch: "", dinner: "" }
    };
}
window.addEventListener('DOMContentLoaded', () => {
    // START HERE: Fetch from Cloud FIRST
    loadCloudData();
});

function calculateHydration() {
    const weightInput = document.getElementById('weight');
    const heightInput = document.getElementById('height');
    const resultBox = document.getElementById('calc-result');
    const displayLiters = document.getElementById('suggested-liters');

    if (!weightInput || !heightInput) return;

    const w = parseFloat(weightInput.value);
    const h = parseFloat(heightInput.value);

    if (w > 0 && h > 0) {
        // Standard formula: 0.033 Liters per kg
        let suggestion = w * 0.033;
        if (h > 180) suggestion += 0.3; 
        
        if (resultBox) resultBox.style.display = 'block';
        if (displayLiters) {
            displayLiters.innerText = suggestion.toFixed(1) + " L";
        }
        
        // FIX: Store directly in your 'data' object instead of window
        // This keeps the temporary value tied to your app state
        data.tempGoal = Math.round(suggestion * 1000); 
    } else {
        showToast("❌ Enter valid weight and height.");
    }
}


function showToast(message) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999;";
    document.body.appendChild(div);
    return div;
}


function applyGoal() {
    if (!data.tempGoal) return;
    data.goal = data.tempGoal;
    syncToCloud(); 
    showToast(`Goal updated: ${(data.goal / 1000).toFixed(1)} L`);
}


async function saveMealSchedule() {
    // 1. Capture the values from the time inputs
    const bfast = document.getElementById('bfast-time').value;
    const lunch = document.getElementById('lunch-time').value;
    const dinner = document.getElementById('dinner-time').value;

    // 2. VALIDATION: Ensure all three meals are set
    // This prevents the 'togglePostMeal' safety check from failing later.
    if (!bfast || !lunch || !dinner) {
        showToast("⚠️ Please set times for all three meals.");
        return;
    }

    // 3. Update the global data object
    data.mealTimes = {
        bfast: bfast,
        lunch: lunch,
        dinner: dinner
    };
    
    // 4. Push to MongoDB
    // We await this so the UI only updates after the cloud confirms the save.
    await syncToCloud();
    
    // 5. Refresh the UI labels (e.g., "08:00 AM")
    updateMealDisplay();
    
    showToast("🥗 Meal schedule synced to cloud!");
}

const RANKS_TIERS = [
    { min: 0,  max: 9,   name: "Desert Dweller",   icon: "🌵", nextReqPct: 10 },
    { min: 10, max: 19,  name: "Mist Seeker",      icon: "🌫️", nextReqPct: 20 },
    { min: 20, max: 39,  name: "Dew Dropper",      icon: "🧊", nextReqPct: 40 },
    { min: 40, max: 49,  name: "Stream Sailor",    icon: "🛶", nextReqPct: 50 },
    { min: 50, max: 59,  name: "River Guide",      icon: "🚣", nextReqPct: 60 },
    { min: 60, max: 69,  name: "Current Commander",icon: "🌊", nextReqPct: 70 },
    { min: 70, max: 79,  name: "Wave Rider",       icon: "🏄", nextReqPct: 80 },
    { min: 80, max: 89,  name: "Shield Guardian",  icon: "🛡️", nextReqPct: 90 },
    { min: 90, max: 100, name: "Ocean Master",     icon: "🔱", nextReqPct: 100 }
];

function renderRankRoadmap() {
    const iconEl = document.getElementById('current-rank-icon');
    const nameEl = document.getElementById('current-rank-name');
    const nextNameEl = document.getElementById('next-rank-name');
    const neededEl = document.getElementById('next-rank-needed');
    const fillEl = document.getElementById('roadmap-bar-fill');

    if (!iconEl || !nameEl || !data) return;

    const goal = data.goal || 2500;
    const intake = data.intake || 0;
    const pct = Math.round((intake / goal) * 100);

    let currIdx = 0;
    for (let i = 0; i < RANKS_TIERS.length; i++) {
        if (pct >= RANKS_TIERS[i].min) {
            currIdx = i;
        }
    }

    const currRank = RANKS_TIERS[currIdx];
    iconEl.innerText = currRank.icon;
    nameEl.innerText = currRank.name;

    if (currIdx < RANKS_TIERS.length - 1) {
        const nextRank = RANKS_TIERS[currIdx + 1];
        const reqTargetMl = Math.ceil((nextRank.nextReqPct / 100) * goal);
        const neededMl = Math.max(0, reqTargetMl - intake);
        const currTierStartMl = Math.ceil((currRank.min / 100) * goal);
        const tierSpanMl = Math.max(1, reqTargetMl - currTierStartMl);
        const progressInTierMl = Math.max(0, intake - currTierStartMl);
        const barPct = Math.min(100, Math.max(0, Math.round((progressInTierMl / tierSpanMl) * 100)));

        if (nextNameEl) nextNameEl.innerText = `${nextRank.icon} ${nextRank.name}`;
        if (neededEl) neededEl.innerText = `${neededMl}ml away`;
        if (fillEl) fillEl.style.width = `${barPct}%`;
    } else {
        if (nextNameEl) nextNameEl.innerText = `🔱 Max Tier Unlocked!`;
        if (neededEl) neededEl.innerText = `Ocean Master 🏆`;
        if (fillEl) fillEl.style.width = `100%`;
    }
}

async function loadCloudData() {
    if (!token) return window.location.href = 'index.html';
    try {
        const response = await fetch(`${API_URL}/api/user/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Unauthorized");
        
        const cloudData = await response.json();
        data = cloudData;
        isDataReady = true;

        // NOW populate the UI
        loadMealTimes();
        renderRealTimeTrend();
        renderMonthlyGrid();
        renderStreakCard();
        renderProgressRing();
        renderBestWorstDay();
        renderGoalHitRate();
        renderRankRoadmap();
        
        // Update Sidebar
        const uDisp = document.getElementById('username-display');
        const uInit = document.getElementById('user-initial');
        const uMobile = document.getElementById('mobile-user-initial');
        if (uDisp && data.username) uDisp.innerText = data.username.toUpperCase();
        if (uInit && data.username) uInit.innerText = data.username[0].toUpperCase();
        if (uMobile && data.username) uMobile.innerText = data.username[0].toUpperCase();
    } catch (err) {
        showToast("Cloud fetch failed. Check connection.");
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
    if (!isDataReady) return; // Prevent overwriting with blank data

    try {
        const response = await fetch(`${API_URL}/api/user/sync`, { // Added /api/
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userData: data })
        });
        if (!response.ok) throw new Error("Sync failed");
    } catch (err) {
        showToast("Cloud sync failed.");
    }
}

function generateMockGraph() {
    const container = document.getElementById('trend-graph');
    const graphSection = document.querySelector('.graph-section');
    
    // Safety check: exit if elements are missing
    if (!container || !graphSection) return;

    const history = data.history || {};
    const todayISO = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    let last7DaysData = [];

    // 1. Collect data for the last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        let dateStr = typeof getLocalDateString === 'function' ? getLocalDateString(d) : d.toISOString().split('T')[0];
        
        let val = 0;
        if (dateStr === todayISO) {
            val = Number(data.intake) || 0;
        } else {
            const entry = history[dateStr];
            // Handle both old (number) and new (object {total, logs}) formats
            val = (entry && typeof entry === 'object') ? (entry.total || 0) : (entry || 0);
        }
        last7DaysData.push(val);
    }

    // 2. FORCE VISIBILITY
    // We remove the old "if (!hasAnyData)" check entirely
    graphSection.style.display = 'block'; 

    // 3. RENDER THE BARS
    container.innerHTML = "";
    
    // Determine the highest point of the graph. 
    // We use Math.max to ensure the scale is at least your goal OR 2000ml.
    const maxVal = Math.max(...last7DaysData, data.goal || 2000, 2000); 

    last7DaysData.forEach((val, index) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        
        // Calculate height percentage
        const heightPct = (val / maxVal) * 100;
        
        // Tooltip: Format to liters (e.g., 0.5L)
        const displayVal = (val / 1000).toFixed(1) + "L";
        bar.setAttribute('data-value', displayVal);
        
        // Accessibility: ensure the bar exists in DOM even if height is 0
        bar.style.height = "0%"; 

        // Animation delay for a "staggered" appearance
        setTimeout(() => {
            // Even if the value is 0, heightPct will be 0. 
            // Your CSS min-height will handle the visibility.
            bar.style.height = heightPct + "%";
        }, 100 * index);

        container.appendChild(bar);
    });
}

async function renderRealTimeTrend() {
    const container = document.getElementById('trend-graph');
    const graphSection = document.querySelector('.graph-section');
    if (!container) return;

    // 1. FRESH DATA FETCH (Now using the correct /api/ path)
    if (token) {
        try {
            const response = await fetch(`${API_URL}/api/user/data`, { // Added /api/
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const cloudData = await response.json();
                
                // CRITICAL: Overwrite the local 'data' object, NOT window.data
                data = cloudData; 
                isDataReady = true; 
            }
        } catch (err) {
            console.warn("Graph update: Cloud fetch failed.", err);
            return; // Stop if we can't get data to prevent showing wrong stats
        }
    }

    // 2. Force visibility if we have data
    if (graphSection) graphSection.style.display = 'block';

    const history = data.history || {};
    const todayISO = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    const dailyGoal = data.goal || 2500;
    
    let last7DaysData = [];
    let totalPct = 0;

    // 3. Collect 7 days of data from the Cloud object
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        
        let dateStr = typeof getLocalDateString === 'function' ? getLocalDateString(d) : (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        
        let val = 0;
        if (dateStr === todayISO) {
            val = Number(data.intake) || 0;
        } else {
            const entry = history[dateStr];
            val = (entry && typeof entry === 'object') ? (entry.total || 0) : (Number(entry) || 0);
        }
        last7DaysData.push({ val, date: dateStr });
        totalPct += Math.min(100, (val / dailyGoal) * 100);
    }

    // 4. Render Bars
    container.innerHTML = "";
    const maxVal = Math.max(...last7DaysData.map(d => d.val), dailyGoal, 1000); 

    last7DaysData.forEach((item, index) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        
        const heightPct = (item.val / maxVal) * 100;
        const displayVal = (item.val / 1000).toFixed(1) + "L";
        
        bar.setAttribute('data-value', displayVal);
        
        // Tooltip interaction using the correct date for each bar
        bar.addEventListener('touchstart', () => {
            if (typeof showToast === 'function') {
                showToast(`${item.date}: ${displayVal}`);
            }
        }, { passive: true });

        // Animation
        setTimeout(() => {
            bar.style.height = heightPct + "%";
        }, 100 * index);

        container.appendChild(bar);
    });

    // 5. Update Weekly Review based on 100% Cloud Data
    if (typeof updateWeeklyReview === 'function') {
        updateWeeklyReview(totalPct / 7);
    }
}

// 12-Hour Format Display Logic
function formatTo12Hr(time24) {
    if (!time24) return "";
    let [hours, minutes] = time24.split(':');
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

function renderMonthlyGrid() {
    const container = document.getElementById('monthly-grid');
    if (!container || !isDataReady) return; // Ensure data is actually loaded from cloud

    const history = data.history || {};
    const goal = data.goal || 2500;
    
    container.innerHTML = "";
    
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        // FIX: Build YYYY-MM-DD manually to match your database keys exactly
        const dateStr = d.getFullYear() + '-' + 
                         String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(d.getDate()).padStart(2, '0');
        
        const entry = history[dateStr];
        const val = (entry && typeof entry === 'object') ? (entry.total || 0) : (Number(entry) || 0);
        
        const square = document.createElement('div');
        square.className = 'grid-square';
        
        // Visual feedback based on goal
        if (val >= goal) square.style.background = "#1565c0"; 
        else if (val > 0) square.style.background = "#bbdefb"; 
        else square.style.background = "rgba(0,0,0,0.05)"; 

        square.addEventListener('touchstart', () => {
            showToast(`${dateStr}: ${(val/1000).toFixed(1)}L`);
        });
        
        container.appendChild(square);
    }
}



function updateMealDisplay() {
    if (data.mealTimes) {
        document.getElementById('bfast-display').innerText = formatTo12Hr(data.mealTimes.bfast) || "--:-- --";
        document.getElementById('lunch-display').innerText = formatTo12Hr(data.mealTimes.lunch) || "--:-- --";
        document.getElementById('dinner-display').innerText = formatTo12Hr(data.mealTimes.dinner) || "--:-- --";
    }
}

function loadMealTimes() {
    if (data.mealTimes) {
        document.getElementById('bfast-time').value = data.mealTimes.bfast || "";
        document.getElementById('lunch-time').value = data.mealTimes.lunch || "";
        document.getElementById('dinner-time').value = data.mealTimes.dinner || "";
        updateMealDisplay();
    }
}

function updateWeeklyReview(avgPercent) {
    const reviewContainer = document.getElementById('review-content');
    let status = "";
    let message = "";
    let tip = "";

if (avgPercent >= 90) {
    status = "🌟 Hydration Master!";
    message = "Your consistency this week has been incredible. You are hitting your targets almost perfectly, boosting your energy and focus.";
    tip = "💡 Tip: Keep maintaining this rhythm; your body is perfectly primed!";

} else if (avgPercent >= 80) {
    status = "🏆 Almost Perfect!";
    message = "You're extremely close to perfect hydration. Just a tiny improvement will make your routine flawless.";
    tip = "💡 Tip: Add one extra glass during your least active hour.";

} else if (avgPercent >= 70) {
    status = "📈 Great Progress!";
    message = "You've been very consistent this week with only minor dips.";
    tip = "💡 Tip: Keep a glass of water near your bed to start strong tomorrow.";

} else if (avgPercent >= 60) {
    status = "👍 Good Going";
    message = "You're doing well, but there are a few missed opportunities for better hydration.";
    tip = "💡 Tip: Try drinking water right after meals.";

} else if (avgPercent >= 50) {
    status = "⚖️ Balanced but Improving";
    message = "You're halfway to optimal hydration. Some days are good, others need attention.";
    tip = "💡 Tip: Set fixed drinking times to build consistency.";

} else if (avgPercent >= 40) {
    status = "⚠️ Room for Improvement";
    message = "You're starting to build the habit, but you're missing your goal on several days.";
    tip = "💡 Tip: Use 'Interval Reminders' in settings to stay consistent.";

} else if (avgPercent >= 30) {
    status = "📉 Inconsistent Hydration";
    message = "Your hydration pattern is quite inconsistent. This may affect your energy levels.";
    tip = "💡 Tip: Keep a water bottle visible at all times.";

} else if (avgPercent >= 20) {
    status = "😓 Low Intake";
    message = "You're not drinking enough water regularly. Your body may feel tired or sluggish.";
    tip = "💡 Tip: Start with small sips every hour.";

} else if (avgPercent >= 10) {
    status = "🚨 Very Low Hydration";
    message = "Your hydration level is critically low. Immediate improvement is needed.";
    tip = "💡 Tip: Drink at least one glass every 1–2 hours.";

} else {
    status = "🧊 Dehydration Alert";
    message = "Your intake has been significantly lower than your goal this week. This can lead to fatigue and headaches.";
    tip = "💡 Tip: Start your day with 2 glasses of water and build from there.";
}

    reviewContainer.innerHTML = `
        <span class="review-status">${status}</span>
        <p class="review-text">${message}</p>
        <div class="review-tip">${tip}</div>
    `;
}

/* ============================================================
   NEW INSIGHT CARDS
   ============================================================ */

// Helper: get a day's intake from data.history or today's data.intake
function getDayIntake(dateStr) {
    const todayISO = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    if (dateStr === todayISO) return Number(data.intake) || 0;
    const entry = (data.history || {})[dateStr];
    return (entry && typeof entry === 'object') ? (entry.total || 0) : (Number(entry) || 0);
}

// Helper: format YYYY-MM-DD -> "Mon, Jul 28"
function formatDateFriendly(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// 🔥 Streak Tracker Card
function renderStreakCard() {
    const goal = data.goal || 2500;
    const history = data.history || {};
    const todayISO = new Date().toLocaleDateString('en-CA');

    // Build sorted list of dates that met goal
    const allDates = [];
    for (let i = 365; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toLocaleDateString('en-CA');
        allDates.push(ds);
    }

    // Current streak (working backwards from today)
    let currentStreak = 0;
    for (let i = 0; i < allDates.length; i++) {
        const ds = allDates[allDates.length - 1 - i];
        const val = getDayIntake(ds);
        if (val >= goal) currentStreak++;
        else break;
    }

    // Best ever streak
    let bestStreak = 0, tempStreak = 0;
    for (const ds of allDates) {
        const val = getDayIntake(ds);
        if (val >= goal) {
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
    }

    // Update DOM
    const curEl = document.getElementById('current-streak');
    const bestEl = document.getElementById('best-streak');
    const captionEl = document.getElementById('streak-caption');
    const flameEl = document.getElementById('streak-flame');
    if (!curEl) return;

    curEl.textContent = currentStreak + ' day' + (currentStreak !== 1 ? 's' : '');
    bestEl.textContent = bestStreak + ' day' + (bestStreak !== 1 ? 's' : '');

    if (currentStreak === 0) {
        captionEl.textContent = 'Log water today to start your streak!';
        flameEl.style.filter = 'grayscale(1)';
        flameEl.style.opacity = '0.4';
    } else if (currentStreak >= 7) {
        captionEl.textContent = '🌟 Outstanding! You are on fire!';
        flameEl.style.filter = 'drop-shadow(0 0 8px orange)';
    } else if (currentStreak >= 3) {
        captionEl.textContent = "Keep it up! Don't break the chain!";
    } else {
        captionEl.textContent = 'Good start — build that streak!';
    }
}

// 💧 Daily Progress Ring
function renderProgressRing() {
    const intake = Number(data.intake) || 0;
    const goal   = Number(data.goal) || 2500;
    const pct    = Math.min(100, Math.round((intake / goal) * 100));
    const circumference = 314; // 2 * π * 50
    const offset = circumference - (pct / 100) * circumference;

    const ring    = document.getElementById('ring-fill');
    const pctEl   = document.getElementById('ring-pct');
    const subEl   = document.getElementById('ring-sub');
    const caption = document.getElementById('ring-caption');
    if (!ring) return;

    // Animate after paint
    requestAnimationFrame(() => {
        ring.style.strokeDashoffset = offset;
    });

    if (pct >= 100) ring.classList.add('complete');

    pctEl.textContent = pct + '%';
    subEl.textContent = (intake / 1000).toFixed(1) + ' / ' + (goal / 1000).toFixed(1) + ' L';

    if (pct >= 100)      caption.textContent = '🎉 Goal reached! Amazing work today!';
    else if (pct >= 75)  caption.textContent = 'Almost there — just a bit more!';
    else if (pct >= 50)  caption.textContent = 'Halfway through — keep going!';
    else if (pct >= 25)  caption.textContent = 'Good start — stay consistent!';
    else if (pct > 0)    caption.textContent = 'Just getting started — keep drinking!';
    else                 caption.textContent = 'No intake logged yet today.';
}

// 📅 Best & Worst Day (this week)
function renderBestWorstDay() {
    const goal = data.goal || 2500;
    const days = [];
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toLocaleDateString('en-CA');
        const val = getDayIntake(ds);
        days.push({ ds, val, label: formatDateFriendly(ds) });
    }

    // Only consider days that have any intake logged
    const logged = days.filter(d => d.val > 0);

    const bestDayLabelEl = document.getElementById('best-day-label');
    const bestDayValEl   = document.getElementById('best-day-val');
    const worstDayLabelEl = document.getElementById('worst-day-label');
    const worstDayValEl   = document.getElementById('worst-day-val');
    const noteEl = document.getElementById('bw-note');
    if (!bestDayLabelEl) return;

    if (logged.length === 0) {
        bestDayLabelEl.textContent  = 'No data yet';
        worstDayLabelEl.textContent = 'No data yet';
        bestDayValEl.textContent    = '—';
        worstDayValEl.textContent   = '—';
        return;
    }

    const sorted = [...logged].sort((a, b) => b.val - a.val);
    const best   = sorted[0];
    const worst  = sorted[sorted.length - 1];

    bestDayLabelEl.textContent  = best.label;
    bestDayValEl.textContent    = (best.val / 1000).toFixed(2) + ' L';
    worstDayLabelEl.textContent = worst.label;
    worstDayValEl.textContent   = (worst.val / 1000).toFixed(2) + ' L';

    if (best.ds === worst.ds) noteEl.textContent = 'Only one day logged this week';
    else noteEl.textContent = 'Based on this week\'s data';
}

// 🎯 Goal Hit Rate
function renderGoalHitRate() {
    const goal = data.goal || 2500;
    const todayISO = new Date().toLocaleDateString('en-CA');
    const circumference = 201; // 2 * π * 32

    let hitCount = 0;
    const dotStates = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toLocaleDateString('en-CA');
        const val = getDayIntake(ds);
        const isToday = ds === todayISO;
        const hit = val >= goal;
        if (hit) hitCount++;
        dotStates.push({ hit, isToday, val });
    }

    const pct = Math.round((hitCount / 7) * 100);
    const offset = circumference - (hitCount / 7) * circumference;

    const arc      = document.getElementById('hit-arc');
    const fracEl   = document.getElementById('hit-fraction');
    const pctEl    = document.getElementById('hit-pct');
    const dotsEl   = document.getElementById('hit-dots');
    const caption  = document.getElementById('hit-caption');
    if (!arc) return;

    requestAnimationFrame(() => {
        arc.style.strokeDashoffset = offset;
    });

    // Color the arc based on hit rate
    if (pct >= 80) arc.style.stroke = '#2e7d32';
    else if (pct >= 50) arc.style.stroke = 'var(--accent, #1565c0)';
    else arc.style.stroke = '#e65100';

    fracEl.textContent = hitCount + '/7';
    pctEl.textContent  = pct + '%';

    // Day dots
    dotsEl.innerHTML = '';
    dotStates.forEach(s => {
        const dot = document.createElement('span');
        dot.className = 'hit-dot ' + (s.isToday ? 'today' : (s.hit ? 'success' : 'fail'));
        dot.title = (s.val / 1000).toFixed(1) + 'L';
        dotsEl.appendChild(dot);
    });

    if (pct === 100)      caption.textContent = '🏆 Perfect week — every single goal hit!';
    else if (pct >= 70)  caption.textContent = '💪 Strong week! A few days shy of perfect.';
    else if (pct >= 50)  caption.textContent = 'Halfway there — push for more hits!';
    else if (pct > 0)    caption.textContent = 'Room to grow — set reminders to help!';
    else                 caption.textContent = 'No goals hit yet this week.';
}

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
    const nav = document.querySelector('.mobile-bottom-nav');

    // If running inside standalone app mode, hide install button
    if (standalone) {
        btns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));
        if (nav) nav.classList.remove('has-install-btn');
        return;
    }

    // iOS Safari: show install button that triggers iOS banner (no beforeinstallprompt)
    const iosInstallable = isIOS() && !standalone;

    btns.forEach(btn => {
        if (deferredPWAInstallPrompt || iosInstallable) {
            btn.style.setProperty('display', 'flex', 'important');
            if (nav) nav.classList.add('has-install-btn');
        } else {
            btn.style.setProperty('display', 'none', 'important');
            if (nav) nav.classList.remove('has-install-btn');
        }
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
        background: rgba(10,20,40,0.92); color: #fff; border-radius: 18px;
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

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 10000);
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
        // On iOS: show instruction banner
        localStorage.removeItem('ios_banner_dismissed');
        showIOSInstallBanner();
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
    });
} else {
    updatePWAInstallButtons();
    if (isIOS() && !isAppStandalone()) setTimeout(showIOSInstallBanner, 1500);
}
