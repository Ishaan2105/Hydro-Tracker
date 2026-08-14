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

loadLocalCache();

/* ── BroadcastChannel & storage events for live updates ── */
var _hydroBC = null;
try { _hydroBC = new BroadcastChannel('hydrotrack_channel'); } catch(e) {}

if (_hydroBC) {
    _hydroBC.onmessage = function(event) {
        if (event.data && event.data.type === 'DATA_UPDATED') {
            loadLeaderboard();
        }
    };
}

window.addEventListener('storage', function(event) {
    if (event.key === 'hydro_update_ts') {
        loadLeaderboard();
    }
});

/* ── DOMContentLoaded Init ── */
window.addEventListener('DOMContentLoaded', () => {
    if (typeof updateTheme === 'function') updateTheme();

    // Instant username from cache/token
    const userDisplay = document.getElementById('username-display');
    const avatar = document.getElementById('user-initial');

    const cachedRaw = localStorage.getItem('hydro_data_cache');
    let cachedName = null;
    try {
        const cachedObj = JSON.parse(cachedRaw);
        if (cachedObj && cachedObj.username && cachedObj.username !== 'Loading...') {
            cachedName = cachedObj.username;
        }
    } catch(e) {}

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
        const mobileAvatar = document.getElementById('mobile-user-initial');
        if (mobileAvatar) mobileAvatar.innerText = cachedName[0].toUpperCase();
    }

    loadLeaderboard();
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

/* ── LOAD LEADERBOARD FROM API ── */
var currentLbMode = 'solo';

function switchLeaderboardMode(mode) {
    currentLbMode = mode;
    const tabSolo = document.getElementById('lb-tab-solo');
    const tabDuo  = document.getElementById('lb-tab-duo');
    const mainHeading = document.getElementById('lb-main-heading');
    const subHeading  = document.getElementById('lb-sub-heading');

    if (mode === 'duo') {
        if (tabSolo) tabSolo.classList.remove('active');
        if (tabDuo)  tabDuo.classList.add('active');
        if (mainHeading) mainHeading.textContent = "👥 Duo Team Leaderboard";
        if (subHeading)  subHeading.textContent  = "Rankings of active Hydration Duo Teams based on Shared Co-Op Streaks & Combined Intake!";
    } else {
        if (tabDuo)  tabDuo.classList.remove('active');
        if (tabSolo) tabSolo.classList.add('active');
        if (mainHeading) mainHeading.textContent = "Global Leaderboard 🏆";
        if (subHeading)  subHeading.textContent  = "Rankings based on daily goal completion, streaks, and hydration consistency!";
    }

    loadLeaderboard();
}

async function loadLeaderboard() {
    if (!token) return window.location.href = 'index.html';

    const listEl = document.getElementById('leaderboard-list');

    try {
        const response = await fetch(`${API_URL}/api/leaderboard?mode=${currentLbMode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch leaderboard");

        const result = await response.json();
        const leaderboard = result.leaderboard || [];
        const todayKey = result.date || '';

        renderPodium(leaderboard);
        renderMyRankBanner(leaderboard);
        renderLeaderboardList(leaderboard, todayKey);

    } catch (err) {
        console.error("Leaderboard fetch error:", err);
        if (listEl) {
            listEl.innerHTML = `<div class="loading-state">Unable to connect to community leaderboard. Please try again.</div>`;
        }
    }
}

function renderPodium(list) {
    const first = list[0] || null;
    const second = list[1] || null;
    const third = list[2] || null;

    updatePodiumCard('podium-1', first);
    updatePodiumCard('podium-2', second);
    updatePodiumCard('podium-3', third);
}

function updatePodiumCard(cardId, item) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const nameEl = card.querySelector('.podium-name');
    const pctEl = card.querySelector('.podium-pct');
    const titleEl = card.querySelector('.podium-title');
    const avatarEl = card.querySelector('.podium-avatar');

    if (item) {
        if (nameEl) nameEl.innerText = item.username.toUpperCase();
        if (pctEl) pctEl.innerText = `🔥 ${item.streak}d • ${item.pct}%`;
        if (titleEl) titleEl.innerText = item.rankTitle;
        if (avatarEl) avatarEl.innerText = item.username[0].toUpperCase();
    } else {
        if (nameEl) nameEl.innerText = '--';
        if (pctEl) pctEl.innerText = '0%';
        if (titleEl) titleEl.innerText = 'Empty';
    }
}

function highlightMyRankCard(pct) {
    const cards = document.querySelectorAll('.rank-tier-card');
    if (!cards || cards.length === 0) return;
    cards.forEach(card => {
        const min = parseInt(card.dataset.min, 10);
        const max = parseInt(card.dataset.max, 10);
        card.classList.remove('active-rank');
        if (pct >= min && (pct <= max || (max === 100 && pct >= 90))) {
            card.classList.add('active-rank');
        }
    });
}

function renderMyRankBanner(list) {
    const myItem = list.find(item => item.isCurrent);
    const banner = document.getElementById('my-rank-banner');
    if (!banner) return;

    if (myItem) {
        banner.style.display = 'flex';
        document.getElementById('my-rank-num').innerText = `#${myItem.rank}`;
        document.getElementById('my-rank-username').innerText = myItem.username.toUpperCase();
        document.getElementById('my-rank-title').innerText = myItem.rankTitle;
        document.getElementById('my-rank-pct').innerText = `${myItem.pct}%`;
        document.getElementById('my-rank-streak').innerText = `🔥 ${myItem.streak} Days`;
        highlightMyRankCard(myItem.pct);
    } else {
        banner.style.display = 'none';
        if (data && data.goal) {
            const userPct = Math.round(((data.intake || 0) / data.goal) * 100);
            highlightMyRankCard(userPct);
        }
    }
}

function renderLeaderboardList(list, todayKey) {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;

    if (list.length === 0) {
        listEl.innerHTML = `<div class="loading-state">No users participating on the leaderboard yet.</div>`;
        return;
    }

    // Format today's date nicely for the header
    let dateLabel = 'Today';
    if (todayKey) {
        const d = new Date(todayKey + 'T00:00:00');
        dateLabel = 'Today — ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    listEl.innerHTML = `
        <div style="text-align:center; font-size:0.78rem; font-weight:700; letter-spacing:0.08em;
            color: var(--accent); opacity:0.75; padding: 8px 0 14px; text-transform:uppercase;">
            📅 ${dateLabel} &nbsp;•&nbsp; Ranked by Streak
        </div>
    `;

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = `leaderboard-item ${item.isCurrent ? 'current-user' : ''}`;

        const cappedPct = Math.min(100, item.pct);
        const intakeDisplay = item.intake > 0 ? `${item.intake}ml` : '0ml';

        div.innerHTML = `
            <div class="rank-number">#${item.rank}</div>
            <div class="item-avatar">${item.username[0].toUpperCase()}</div>
            <div class="item-details">
                <div class="item-header">
                    <span class="item-name">${item.username.toUpperCase()}</span>
                    <span class="item-rank-tag">${item.rankTitle}</span>
                </div>
                <div class="item-progress-bar">
                    <div class="item-progress-fill" style="width: ${cappedPct}%"></div>
                </div>
            </div>
            <div class="item-meta">
                <div class="item-pct-val">${cappedPct}%</div>
                <div class="item-streak-val">🔥 ${item.streak}d</div>
            </div>
        `;

        listEl.appendChild(div);
    });
}

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

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
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
    });
} else {
    updatePWAInstallButtons();
    if (isIOS() && !isAppStandalone()) setTimeout(showIOSInstallBanner, 1500);
}

// EFFECTS — matches all other pages
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
        const handlePointer = (e) => this.onPointerMove(e.touches ? e.touches[0] : e);
        window.addEventListener('mousemove', handlePointer);
        window.addEventListener('touchmove', (e) => { handlePointer(e); }, { passive: true });
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

/* ── HYDRATION DUO & BUDDY CO-OP DUEL LOGIC ── */

async function fetchBuddyStatus() {
    token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/api/user/buddy/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();

        // 1. Show Nudges Popup if any pending
        if (data.nudges && data.nudges.length > 0) {
            data.nudges.forEach(n => {
                showToast(n.message || `💧 ${n.from} nudged you to drink water!`);
            });
        }

        // Show Decline Alerts if any pending
        if (data.declineAlerts && data.declineAlerts.length > 0) {
            data.declineAlerts.forEach(a => {
                showToast(`❌ ${a.username} declined your Hydration Duo invitation.`);
            });
        }

        // 2. Render Incoming Requests
        const incBox = document.getElementById('incoming-requests-container');
        const incList = document.getElementById('incoming-requests-list');
        if (incBox && incList) {
            if (data.incomingRequests && data.incomingRequests.length > 0) {
                incBox.style.display = 'block';
                incList.innerHTML = data.incomingRequests.map(r => `
                    <div class="inc-req-item">
                        <span><strong>${r.username}</strong> wants to be your Hydration Buddy!</span>
                        <div class="inc-req-btns">
                            <button class="btn-acc" onclick="respondBuddyRequest('${r.username}', 'accept')">Accept ✅</button>
                            <button class="btn-dec" onclick="respondBuddyRequest('${r.username}', 'decline')">Decline ❌</button>
                        </div>
                    </div>
                `).join('');
            } else {
                incBox.style.display = 'none';
            }
        }

        // 3. Render Buddy Cards State
        const noPartnerBlock = document.getElementById('buddy-no-partner');
        const activePartnerBlock = document.getElementById('buddy-active-partner');
        const pendingMsg = document.getElementById('buddy-pending-msg');
        const pendingName = document.getElementById('pending-buddy-name');

        if (!data.hasBuddy) {
            if (activePartnerBlock) activePartnerBlock.style.display = 'none';
            if (noPartnerBlock) noPartnerBlock.style.display = 'block';

            if (data.buddyState && data.buddyState.status === 'pending') {
                if (pendingMsg) pendingMsg.style.display = 'block';
                if (pendingName) pendingName.textContent = data.buddyState.username;
            } else {
                if (pendingMsg) pendingMsg.style.display = 'none';
            }
            return;
        }

        // Active Buddy state!
        if (noPartnerBlock) noPartnerBlock.style.display = 'none';
        if (activePartnerBlock) activePartnerBlock.style.display = 'block';

        // Render Streak
        const streakVal = document.getElementById('coop-streak-val');
        if (streakVal) streakVal.textContent = `${data.coopStreak || 0} Day${(data.coopStreak === 1) ? '' : 's'}`;

        // Render My Stats
        const myVal = document.getElementById('versus-my-val');
        const myBar = document.getElementById('versus-my-bar');
        const myPct = document.getElementById('versus-my-pct');
        if (myVal) myVal.textContent = `${(data.myStatus.intake / 1000).toFixed(1)} / ${(data.myStatus.goal / 1000).toFixed(1)}L`;
        if (myBar) myBar.style.width = `${Math.min(100, data.myStatus.pct)}%`;
        if (myPct) myPct.textContent = `${data.myStatus.pct}%`;

        // Render Buddy Stats
        const bName = document.getElementById('versus-buddy-name');
        const bVal  = document.getElementById('versus-buddy-val');
        const bBar  = document.getElementById('versus-buddy-bar');
        const bPct  = document.getElementById('versus-buddy-pct');
        if (bName) bName.textContent = data.buddyState.username;
        if (bVal)  bVal.textContent  = `${(data.buddyState.intake / 1000).toFixed(1)} / ${(data.buddyState.goal / 1000).toFixed(1)}L`;
        if (bBar)  bBar.style.width  = `${Math.min(100, data.buddyState.pct)}%`;
        if (bPct)  bPct.textContent  = `${data.buddyState.pct}%`;

    } catch (err) {
        console.error("fetchBuddyStatus error:", err);
    }
}

async function sendBuddyInvite() {
    const input = document.getElementById('buddy-search-input');
    if (!input) return;
    const targetUsername = input.value.trim();
    if (!targetUsername) {
        showToast("Please enter a friend's username.");
        return;
    }

    token = localStorage.getItem('token');
    if (!token) {
        showToast("Please log in to add a buddy.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/user/buddy/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token, targetUsername })
        });
        const json = await res.json();
        if (!res.ok) {
            showToast(`⚠️ ${json.error || "Failed to send request."}`);
            return;
        }

        showToast(json.message);
        input.value = '';
        fetchBuddyStatus();
    } catch (e) {
        showToast("⚠️ Network error sending request.");
    }
}

async function respondBuddyRequest(senderUsername, action) {
    token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/api/user/buddy/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token, senderUsername, action })
        });
        const json = await res.json();
        showToast(json.message || "Updated request.");
        fetchBuddyStatus();
    } catch (e) {
        showToast("⚠️ Error updating request.");
    }
}

async function nudgeBuddy() {
    token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/api/user/buddy/nudge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
        });
        const json = await res.json();
        if (!res.ok) {
            showToast(`⚠️ ${json.error || "Failed to send nudge."}`);
            return;
        }
        showToast(json.message);
    } catch (e) {
        showToast("⚠️ Error sending nudge.");
    }
}

async function unlinkBuddy() {
    if (!confirm("Are you sure you want to unlink your Hydration Buddy?")) return;
    token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/api/user/buddy/remove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
        });
        const json = await res.json();
        showToast(json.message || "Buddy unlinked.");
        fetchBuddyStatus();
    } catch (e) {
        showToast("⚠️ Error unlinking buddy.");
    }
}

/* ── BUDDY AUTOCOMPLETE SUGGESTIONS ── */
let _buddySearchDebounce = null;

function handleBuddySearchInput(inputEl) {
    const query = inputEl.value.trim();
    const dropdown = document.getElementById('buddy-search-dropdown');
    if (!dropdown) return;

    if (_buddySearchDebounce) clearTimeout(_buddySearchDebounce);

    if (!query) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    _buddySearchDebounce = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/predict-username?q=${encodeURIComponent(query)}`);
            if (!res.ok) {
                dropdown.style.display = 'none';
                return;
            }
            const json = await res.json();
            let suggestions = json.suggestions || [];

            const myUsername = (data && data.username) ? data.username.toLowerCase() : '';
            suggestions = suggestions.filter(u => u.toLowerCase() !== myUsername);

            if (suggestions.length === 0) {
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
                return;
            }

            dropdown.innerHTML = '';
            suggestions.forEach(uname => {
                const item = document.createElement('div');
                item.className = 'buddy-suggestion-item';

                const lowerUser = uname.toLowerCase();
                const lowerQuery = query.toLowerCase();
                let matchHtml = '';

                if (lowerUser.startsWith(lowerQuery)) {
                    const matchPart = uname.substring(0, query.length);
                    const restPart = uname.substring(query.length);
                    matchHtml = `<span class="match-highlight">${escapeHtml(matchPart)}</span><span class="rest-text">${escapeHtml(restPart)}</span>`;
                } else {
                    matchHtml = `<span>${escapeHtml(uname)}</span>`;
                }

                item.innerHTML = `
                    <div>👤 ${matchHtml}</div>
                    <span style="font-size:0.7rem; opacity:0.6; font-weight:700;">Select ↵</span>
                `;

                item.onclick = function() {
                    inputEl.value = uname;
                    dropdown.style.display = 'none';
                    dropdown.innerHTML = '';
                    sendBuddyInvite();
                };

                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        } catch (e) {
            dropdown.style.display = 'none';
        }
    }, 150);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('click', function(e) {
    const wrap = document.querySelector('.buddy-search-wrap');
    const dropdown = document.getElementById('buddy-search-dropdown');
    if (wrap && dropdown && !wrap.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        fetchBuddyStatus();
        setInterval(fetchBuddyStatus, 15000);
    });
} else {
    fetchBuddyStatus();
    setInterval(fetchBuddyStatus, 15000);
}

