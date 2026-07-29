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
        
        // Update Sidebar
        document.getElementById('username-display').innerText = data.username;
        document.getElementById('user-initial').innerText = data.username[0].toUpperCase();
    } catch (err) {
        showToast("Cloud fetch failed. Check connection.");
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
    const todayISO = new Date().toISOString().split('T')[0];
    let last7DaysData = [];

    // 1. Collect data for the last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        
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
    const todayISO = new Date().toISOString().split('T')[0];
    const dailyGoal = data.goal || 2500;
    
    let last7DaysData = [];
    let totalPct = 0;

    // 3. Collect 7 days of data from the Cloud object
    for (let i = 6; i >= 0; i--) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        
        // Manual construction ensures it matches your server's lastLogDate format
        let dateStr = d.getFullYear() + '-' + 
                      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(d.getDate()).padStart(2, '0');
        
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





