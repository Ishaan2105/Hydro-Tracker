const API_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? window.location.origin
    : "http://localhost:5000";

// ── Session Persistence / Auto-login check ──
(function checkAutoLogin() {
    try {
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
            const parts = savedToken.split('.');
            if (parts.length === 3) {
                window.location.href = 'home.html';
            }
        }
    } catch(e) {}
})();

const rainContainer = document.getElementById('rain-container');
const rippleContainer = document.getElementById('ripple-container');
const bottle = document.getElementById('bottle');
let isLogin = true;

// Mouse Tracking for Magnetic Effect
let mouseX = -1000;
let mouseY = -1000;
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Universal Tracking for Magnetic Effect & Rain
function handlePointer(e) {
    if (e.touches) {
        // Mobile touch
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
    } else {
        // Desktop mouse
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
}

window.addEventListener('mousemove', handlePointer);
window.addEventListener('touchmove', (e) => {
    handlePointer(e);
    // Prevent scrolling while interacting with the "magnetic" rain if desired
    // e.preventDefault(); 
}, { passive: false });

// 1. Time-of-Day Theme Logic
function updateTheme() {
    const hour = new Date().getHours();
    document.body.className = ''; // Reset

    if (hour >= 6 && hour < 10) document.body.classList.add('theme-morning');
    else if (hour >= 10 && hour < 16) document.body.classList.add('theme-day');
    else if (hour >= 16 && hour < 18) document.body.classList.add('theme-evening');
    else document.body.classList.add('theme-night');
}
updateTheme();

// 2. Splash Creator
function createSplash(x, y) {
    const splash = document.createElement('div');
    splash.className = 'splash';
    splash.style.left = x + 'px';
    splash.style.top = y + 'px';
    rippleContainer.appendChild(splash);
    setTimeout(() => splash.remove(), 300);
}

// 3. Magnetic Rain Logic
function createRain() {
    const drop = document.createElement('div');
    drop.className = 'drop';
    
    let currentX = Math.random() * window.innerWidth;
    let pos = -20;
    const speed = Math.random() * 5 + 8;
    
    drop.style.left = currentX + 'px';
    rainContainer.appendChild(drop);

    function fall() {
        pos += speed;

        // MAGNETIC INTERACTION
        const dx = currentX - mouseX;
        const dy = pos - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 120) {
            const force = (120 - distance) / 15;
            currentX += dx > 0 ? force : -force;
        }

        drop.style.top = pos + 'px';
        drop.style.left = currentX + 'px';

        const bottleRect = bottle.getBoundingClientRect();

        // Bottle Collision
        if (currentX > bottleRect.left && currentX < bottleRect.right && 
            pos >= bottleRect.top && pos < bottleRect.top + 20) {
            createSplash(currentX, bottleRect.top);
            drop.remove();
            return;
        }

        // Floor Collision
        if (pos > window.innerHeight - 10) {
            createSplash(currentX, window.innerHeight - 5);
            drop.remove();
            return;
        }

        if (pos < window.innerHeight) {
            requestAnimationFrame(fall);
        } else {
            drop.remove();
        }
    }
    requestAnimationFrame(fall);
}

// Rain Density
// setInterval(() => {
//     createRain();
//     createRain();
//     createRain();
// }, 50);

// 4. Bottle Logic
function updateBottle() {
    const formId = isLogin ? 'loginForm' : 'signupForm';
    const inputs = document.querySelectorAll(`#${formId} input`);
    let filled = 0;
    inputs.forEach(i => { if(i.value.trim() !== "") filled++; });
    
    const height = (filled / inputs.length) * 70 + 15; // Range 15% to 85%
    document.getElementById('bottleWater').style.height = height + "%";
}

function toggleForm() {
    // Always close the recovery form first
    const recoveryForm = document.getElementById('recoveryForm');
    const resultBox = document.getElementById('recovery-result-box');
    if (recoveryForm) recoveryForm.style.display = 'none';
    if (resultBox) { resultBox.style.display = 'none'; resultBox.innerHTML = ''; }

    isLogin = !isLogin;
    document.getElementById('loginForm').style.display = isLogin ? 'block' : 'none';
    document.getElementById('signupForm').style.display = isLogin ? 'none' : 'block';
    document.getElementById('form-title').innerText = isLogin ? 'Login' : 'Sign Up';
    document.getElementById('switch-text').innerHTML = isLogin ?
        'New here? <a href="#" onclick="toggleForm()">Sign Up</a>' :
        'Already a member? <a href="#" onclick="toggleForm()">Login</a>';
    updateBottle();
}

function togglePass(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// 5. LocalStorage Auth
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value;
    const confirm  = document.getElementById('regConfirm').value;

    if (password !== confirm) {
        showNotification('Passwords do not match!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();

        if (response.ok) {
            showNotification("Account created! Please login.");
            toggleForm();
        } else if (response.status === 409 && (data.code === 'USERNAME_TAKEN' || (data.error && data.error.toLowerCase().includes('username')))) {
            openUsernameAlertModal(username);
        } else {
            showNotification(data.error || "Signup failed");
        }
    } catch (err) {
        showNotification("Cloud connection error. Please try again.");
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

    try {
        // UPDATED: Now points to your live Render backend
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();

        if (response.ok) {
            // Store the JWT token for session persistence
            localStorage.setItem('token', data.token);

            // ── Cache the full user profile at login time ──
            // This ensures username and data are available on ALL pages instantly,
            // even before the home page cloud fetch runs.
            if (data.user) {
                try {
                    localStorage.setItem('hydro_data_cache', JSON.stringify(data.user));
                    localStorage.setItem('hydro_update_ts', Date.now().toString());
                } catch(e) {}
            }

            window.location.href = 'home.html';
        } else {
            // Display the specific error from your MongoDB (e.g., "User not found")
            showNotification(data.error || "Login failed. Please check credentials.");
        }
    } catch (err) {
        // Helpful message for the Render "cold start" phase
        showNotification("Cloud connection failed. Please try again in a few seconds.");
    }
});

// --- 1. Enhanced Registration (Check Username AND Email) ---


// --- 2. Forgot Password Logic ---
function showRecovery() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('recoveryForm').style.display = 'block';
    document.getElementById('form-title').innerText = 'Recover';
    // Make sure we're in "login" mode so Back to Login works correctly
    isLogin = true;
    const switchText = document.getElementById('switch-text');
    if (switchText) switchText.innerHTML = 'New here? <a href="#" onclick="toggleForm()">Sign Up</a>';
}

function hideRecovery() {
    const resultBox = document.getElementById('recovery-result-box');
    if (resultBox) { resultBox.style.display = 'none'; resultBox.innerHTML = ''; }
    document.getElementById('recoveryForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('form-title').innerText = 'Login';
}

async function recoverPassword() {
    const emailInput = document.getElementById('recoveryEmail');
    const inputVal = emailInput.value.trim();
    const resultBox = document.getElementById('recovery-result-box');
    if (resultBox) resultBox.style.display = 'none';

    if (!inputVal) return showNotification("Please enter your registered email or username.");

    try {
        const response = await fetch(`${API_URL}/api/auth/recover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: inputVal })
        });
        
        const result = await response.json();

        if (response.ok) {
            if (resultBox) {
                if (result.emailSent) {
                    // Email was sent — show clean confirmation only, no password on screen
                    resultBox.innerHTML = `
                        <div style="text-align:center; padding: 8px 0;">
                            <div style="font-size: 2rem; margin-bottom: 8px;">📧</div>
                            <div style="font-size: 1rem; font-weight: 700; margin-bottom: 6px;">Email Sent!</div>
                            <div style="font-size: 0.82rem; opacity: 0.9; line-height: 1.5;">
                                A temporary password has been sent to<br>
                                <strong>${result.maskedEmail || 'your registered email'}</strong>.<br>
                                Please check your <strong>Inbox</strong> and <strong>Spam/Junk</strong> folder.
                            </div>
                            <button type="button" onclick="hideRecovery()"
                                style="margin-top: 12px; padding: 7px 20px; background: #1565c0; color: #fff; border: none; border-radius: 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">
                                ← Back to Login
                            </button>
                        </div>
                    `;
                } else {
                    // Email failed — still don't show password, just ask them to contact support or retry
                    resultBox.innerHTML = `
                        <div style="text-align:center; padding: 8px 0;">
                            <div style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>
                            <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 6px;">Email Service Unavailable</div>
                            <div style="font-size: 0.82rem; opacity: 0.9; line-height: 1.5;">
                                We couldn't send the email right now.<br>
                                Please try again in a few minutes or<br>contact support.
                            </div>
                            <button type="button" onclick="hideRecovery()"
                                style="margin-top: 12px; padding: 7px 20px; background: #888; color: #fff; border: none; border-radius: 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">
                                ← Back to Login
                            </button>
                        </div>
                    `;
                }
                resultBox.style.display = 'block';
            }
            showNotification(result.emailSent ? "📧 Check your inbox for your temporary password!" : "⚠️ Email delivery failed. Please try again.");
        } else {
            showNotification(result.error || "Recovery failed.");
            if (resultBox) {
                resultBox.innerHTML = `<span style="color:#d32f2f;">❌ ${result.error || "Recovery failed."}</span>`;
                resultBox.style.display = 'block';
            }
        }
    } catch (err) {
        showNotification("Cloud connection failed. Please try again in a few seconds.");
    }
}

// Notification System
function showNotification(message) {
    const container = document.getElementById('notification-container');
    if (!container) return; 
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- USERNAME CONFLICT ALERT MODAL LOGIC ---
function openUsernameAlertModal(attemptedUsername) {
    const modal = document.getElementById('username-alert-modal');
    const suggestEl = document.getElementById('modal-suggested-username');
    if (suggestEl && attemptedUsername) {
        suggestEl.innerText = `${attemptedUsername}_${Math.floor(10 + Math.random() * 89 + 10)}`;
    }
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeUsernameAlertModal() {
    const modal = document.getElementById('username-alert-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    const regUserInput = document.getElementById('regUser');
    if (regUserInput) {
        regUserInput.focus();
        regUserInput.select();
    }
}

// --- USERNAME PREDICTION / AUTOCOMPLETE LOGIC ---
let _usernameDebounceTimer = null;

function handleUsernameInput(inputEl) {
    if (typeof updateBottle === 'function') updateBottle();

    const query = inputEl.value.trim();
    const dropdown = document.getElementById('username-suggestions');
    if (!dropdown) return;

    if (_usernameDebounceTimer) clearTimeout(_usernameDebounceTimer);

    if (!query) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
    }

    _usernameDebounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/predict-username?q=${encodeURIComponent(query)}`);
            if (!res.ok) {
                dropdown.style.display = 'none';
                return;
            }
            const data = await res.json();
            const suggestions = data.suggestions || [];

            if (suggestions.length === 0) {
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
                return;
            }

            dropdown.innerHTML = '';
            suggestions.forEach(username => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';

                let matchHtml = '';
                const lowerUser = username.toLowerCase();
                const lowerQuery = query.toLowerCase();

                if (lowerUser.startsWith(lowerQuery)) {
                    const matchPart = username.substring(0, query.length);
                    const restPart = username.substring(query.length);
                    matchHtml = `<span class="match-highlight">${escapeHtml(matchPart)}</span><span class="rest-text">${escapeHtml(restPart)}</span>`;
                } else {
                    matchHtml = `<span>${escapeHtml(username)}</span>`;
                }

                item.innerHTML = `
                    <div>👤 ${matchHtml}</div>
                    <span style="font-size:0.7rem; opacity:0.6;">Select ↵</span>
                `;

                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectSuggestedUsername(username);
                });

                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        } catch(e) {
            dropdown.style.display = 'none';
        }
    }, 150);
}

function selectSuggestedUsername(username) {
    const input = document.getElementById('loginUser');
    const dropdown = document.getElementById('username-suggestions');
    if (input) {
        input.value = username;
        if (typeof updateBottle === 'function') updateBottle();
    }
    if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    }
    const passInput = document.getElementById('loginPass');
    if (passInput) passInput.focus();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Close suggestion dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('username-suggestions');
    const wrapper = document.querySelector('.username-predict-wrapper');
    if (dropdown && wrapper && !wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// ── PWA: Hide install button if app is already installed ──
(function hidePWABtnIfInstalled() {
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');

    if (isStandalone) {
        document.querySelectorAll('.install-app-btn').forEach(btn =>
            btn.style.setProperty('display', 'none', 'important')
        );
    }
})();
