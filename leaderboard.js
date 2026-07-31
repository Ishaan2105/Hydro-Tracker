/* ── Theme Boot (runs immediately on parse, before DOM) ── */
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
    }

    loadLeaderboard();
});

/* ── LOAD LEADERBOARD FROM API ── */
async function loadLeaderboard() {
    if (!token) return window.location.href = 'index.html';

    const listEl = document.getElementById('leaderboard-list');

    try {
        const response = await fetch(`${API_URL}/api/leaderboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch leaderboard");

        const result = await response.json();
        const leaderboard = result.leaderboard || [];

        renderPodium(leaderboard);
        renderMyRankBanner(leaderboard);
        renderLeaderboardList(leaderboard);

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
        if (pctEl) pctEl.innerText = item.pct + '%';
        if (titleEl) titleEl.innerText = item.rankTitle;
        if (avatarEl) avatarEl.innerText = item.username[0].toUpperCase();
    } else {
        if (nameEl) nameEl.innerText = '--';
        if (pctEl) pctEl.innerText = '0%';
        if (titleEl) titleEl.innerText = 'Empty';
    }
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
    } else {
        banner.style.display = 'none';
    }
}

function renderLeaderboardList(list) {
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;

    if (list.length === 0) {
        listEl.innerHTML = `<div class="loading-state">No users participating on the leaderboard yet.</div>`;
        return;
    }

    listEl.innerHTML = '';

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = `leaderboard-item ${item.isCurrent ? 'current-user' : ''}`;

        const cappedPct = Math.min(100, item.pct);

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
                <div class="item-pct-val">${item.pct}%</div>
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

/* ── PWA INSTALLATION PROMPT ── */
var deferredPWAInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPWAInstallPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn && !window.matchMedia('(display-mode: standalone)').matches) {
        installBtn.style.display = 'flex';
    }
});

async function triggerPWAInstall() {
    if (!deferredPWAInstallPrompt) return;
    deferredPWAInstallPrompt.prompt();
    try {
        const choice = await deferredPWAInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
            const installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) installBtn.style.display = 'none';
        }
    } catch(e) {}
    deferredPWAInstallPrompt = null;
}

window.addEventListener('appinstalled', () => {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'none';
    if (typeof showToast === 'function') showToast('HydroTrack Installed Successfully! 🎉');
});
