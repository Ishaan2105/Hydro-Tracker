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
    const email = document.getElementById('regEmail').value;
    const username = document.getElementById('regUser').value;
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
        } else {
            // Displays the specific error from your MongoDB logic (e.g., "Email already exists")
            showNotification(data.error || "Signup failed");
        }
    } catch (err) {
        // This triggers if the Render service is "sleeping" or down
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
    document.getElementById('recoveryForm').style.display = 'block';
    document.getElementById('form-title').innerText = 'Recover';
}

function hideRecovery() {
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
            showNotification(result.message || "Temporary password generated!");
            if (resultBox) {
                if (result.tempPass) {
                    // Auto-fill login form for convenience
                    const loginUser = document.getElementById('loginUser');
                    const loginPass = document.getElementById('loginPass');
                    if (loginUser && result.username) loginUser.value = result.username;
                    if (loginPass && result.tempPass) loginPass.value = result.tempPass;

                    resultBox.innerHTML = `
                        <div style="font-size: 0.95rem; margin-bottom: 8px;">🔑 <strong>Temporary Password</strong></div>
                        <div style="background: rgba(255,255,255,0.9); color: #0284c7; font-size: 1.25rem; font-weight: 800; padding: 10px; border-radius: 8px; border: 1px dashed #0284c7; letter-spacing: 2px; user-select: all; margin: 8px 0;">
                            ${result.tempPass}
                        </div>
                        <div style="font-size: 0.78rem; opacity: 0.9; margin-bottom: 10px;">
                            ${result.emailSent ? "📧 Also sent to your email inbox." : "⚠️ Email service offline. Use this temporary password to log in."}
                        </div>
                        <button type="button" onclick="navigator.clipboard.writeText('${result.tempPass}'); if(typeof showNotification==='function') showNotification('Password copied to clipboard! 📋');"
                            style="padding: 6px 16px; background: #1565c0; color: #fff; border: none; border-radius: 20px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
                            📋 Copy Password & Login
                        </button>
                    `;
                } else {
                    resultBox.innerHTML = result.message;
                }
                resultBox.style.display = 'block';
            }
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
