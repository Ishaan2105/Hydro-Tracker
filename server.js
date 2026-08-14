require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const path = require('path');
const webpush = require('web-push');
const cron = require('node-cron');

const JWT_SECRET = process.env.JWT_SECRET || 'hydrotrack_super_secret_jwt_key_2026';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- WEB PUSH SETUP ---
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BG7CQF2LD7Iw16k9JEbGhNn0wwd02wVRDfn7-jMnU6B1c_Psv1cbhqL6-AfzKWS0Aa34k1BkIowguxqFnjbIMy8";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "C1YzP94Hs_GnXKEeB-3w0QZ2yDHwYZYvtRJLnwBC5tc";
const EMAIL_USER = process.env.EMAIL_USER || "ishaanhingway@gmail.com";

webpush.setVapidDetails(
    `mailto:${EMAIL_USER}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const allowedOrigins = [
    "https://hydro-tracker.onrender.com",
    "https://hydro-track.onrender.com",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.options(/.*/, cors());

// --- 1. MONGODB CONNECTION ---
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hydrotrack';

mongoose.connect(mongoUri)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => {
        console.error("⚠️ MongoDB Connection Error:", err.message);
        console.log("ℹ️ Continuing without a live MongoDB connection. Set MONGO_URI in your environment to enable database-backed auth and sync features.");
    });

// --- 2. USER SCHEMA & MODEL ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    goal: { type: Number, default: 2500 },
    reminders: { 
        type: Array, 
        default: [
            { time: "08:00", daily: true, active: true },
            { time: "12:00", daily: true, active: true },
            { time: "18:00", daily: true, active: true },
            { time: "21:00", daily: true, active: true }
        ] 
    },
    intake: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastLogDate: String,
    history: { type: Map, of: Object },
    currentLogs: Array,
    mealTimes: {
        type: Object,
        default: { bfast: "", lunch: "", dinner: "" }
    },
    badges: { type: Array, default: [] },
    postMealEnabled: { type: Boolean, default: false },
    notes: { type: Map, of: String, default: {} },
    pushSubscriptions: { type: Array, default: [] },
    leaderboardOptIn: { type: Boolean, default: true },
    buddy: {
        type: Object,
        default: null // { username: String, status: 'pending'|'accepted' }
    },
    incomingBuddyRequests: { type: Array, default: [] },
    coopStreak: { type: Number, default: 0 },
    pendingNudges: { type: Array, default: [] },
    declineAlerts: { type: Array, default: [] },
    duoLeaderboardOptIn: { type: Boolean, default: false },
    createdAtDate: { type: String, default: () => new Date().toISOString().substring(0, 10) }
});

const User = mongoose.model('User', UserSchema);

// --- 3. AUTHENTICATION ROUTES ---

// Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const cleanUsername = String(username || "").trim();
        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!cleanUsername || !cleanEmail || !password) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // 1. Check if Username already exists (case-insensitive)
        const escapedUsername = cleanUsername.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const existingUsername = await User.findOne({ 
            username: new RegExp(`^${escapedUsername}$`, 'i') 
        });
        if (existingUsername) {
            return res.status(409).json({ 
                code: "USERNAME_TAKEN",
                error: "This username already exists. Please add extra unique symbols or numbers to your username to make it unique from others." 
            });
        }

        // 2. Check if Email already exists (case-insensitive)
        const escapedEmail = cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const existingEmail = await User.findOne({ 
            email: new RegExp(`^${escapedEmail}$`, 'i') 
        });
        if (existingEmail) {
            return res.status(409).json({ 
                code: "EMAIL_TAKEN",
                error: "An account with this email address already exists. Please log in or use another email." 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        const newUser = new User({ 
            username: cleanUsername, 
            email: cleanEmail, 
            password: hashedPassword,
            lastLogDate: todayISO,
            goal: 2500,
            reminders: [
                { time: "08:00", daily: true, active: true },
                { time: "12:00", daily: true, active: true },
                { time: "18:00", daily: true, active: true },
                { time: "21:00", daily: true, active: true }
            ],
            mealTimes: { bfast: "", lunch: "", dinner: "" },
            postMealEnabled: false,
            leaderboardOptIn: true
        });

        await newUser.save();
        res.status(201).json({ message: "User created!" });
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(400).json({ error: "Signup failed. Username or email may already exist." });
    }
});

// Predict username route for login autocomplete
app.get('/api/auth/predict-username', async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        if (!query || query.length < 1) {
            return res.json({ suggestions: [] });
        }

        const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const prefixMatches = await User.find({
            username: new RegExp(`^${escapedQuery}`, 'i')
        }).select('username').limit(5);

        let suggestions = prefixMatches.map(u => u.username);

        if (suggestions.length < 5) {
            const subMatches = await User.find({
                username: new RegExp(escapedQuery, 'i'),
                _id: { $nin: prefixMatches.map(u => u._id) }
            }).select('username').limit(5 - suggestions.length);
            suggestions = suggestions.concat(subMatches.map(u => u.username));
        }

        res.json({ suggestions });
    } catch (err) {
        res.json({ suggestions: [] });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '365d' });
    res.json({ token, user });
});

// Get Public Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let currentUserId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                currentUserId = decoded.id;
            } catch(e) {}
        }

        // Today's date key in IST — same format the app uses for lastLogDate
        const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        const mode = String(req.query.mode || 'solo').toLowerCase();

        if (mode === 'duo') {
            // DUO LEADERBOARD
            const duoUsers = await User.find({
                "buddy.status": "accepted",
                duoLeaderboardOptIn: true
            }).select('username goal streak lastLogDate intake history buddy duoLeaderboardOptIn');

            const duoMap = new Map();

            for (const u of duoUsers) {
                if (!u.buddy || !u.buddy.username) continue;
                
                const pairKey = [u.username.toLowerCase(), u.buddy.username.toLowerCase()].sort().join('::');
                
                if (!duoMap.has(pairKey)) {
                    const partner = await User.findOne({ username: new RegExp(`^${u.buddy.username}$`, 'i') })
                        .select('username goal streak lastLogDate intake history duoLeaderboardOptIn');
                    
                    if (partner) {
                        const u1Goal = u.goal || 2500;
                        const u2Goal = partner.goal || 2500;
                        
                        let u1Intake = (u.lastLogDate === todayKey) ? (u.intake || 0) : 0;
                        let u2Intake = (partner.lastLogDate === todayKey) ? (partner.intake || 0) : 0;

                        const u1Pct = Math.min(100, Math.round((u1Intake / u1Goal) * 100));
                        const u2Pct = Math.min(100, Math.round((u2Intake / u2Goal) * 100));

                        const avgPct = Math.round((u1Pct + u2Pct) / 2);
                        const totalMl = u1Intake + u2Intake;

                        const historyMe = u.history || new Map();
                        const historyB  = partner.history || new Map();
                        let coopStreak  = (u1Pct >= 100 && u2Pct >= 100) ? 1 : 0;

                        for (let i = 1; i <= 30; i++) {
                            let d = new Date();
                            d.setDate(d.getDate() - i);
                            let dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                            const eMe = historyMe.get ? historyMe.get(dateStr) : historyMe[dateStr];
                            const eB  = historyB.get ? historyB.get(dateStr) : historyB[dateStr];
                            const vMe = (eMe && typeof eMe === 'object') ? (eMe.total || 0) : (Number(eMe) || 0);
                            const vB  = (eB && typeof eB === 'object')  ? (eB.total || 0)  : (Number(eB)  || 0);
                            if (vMe >= u1Goal && vB >= u2Goal) coopStreak++;
                            else break;
                        }

                        const isCurrentDuo = currentUserId ? (u._id.toString() === currentUserId.toString() || partner._id.toString() === currentUserId.toString()) : false;

                        duoMap.set(pairKey, {
                            id: pairKey,
                            username: `${u.username} & ${partner.username}`,
                            pct: avgPct,
                            streak: coopStreak,
                            totalMl: totalMl,
                            rankTitle: `🔥 ${coopStreak}d Shared Streak`,
                            isCurrent: isCurrentDuo
                        });
                    }
                }
            }

            let duoList = Array.from(duoMap.values());

            duoList.sort((a, b) => {
                if (b.streak !== a.streak) return b.streak - a.streak;
                if (b.pct !== a.pct) return b.pct - a.pct;
                return b.totalMl - a.totalMl;
            });

            duoList.forEach((item, index) => {
                item.rank = index + 1;
            });

            return res.json({ mode: 'duo', leaderboard: duoList, date: todayKey });
        }

        // SOLO LEADERBOARD
        const users = await User.find({ leaderboardOptIn: { $ne: false } })
            .select('username goal streak lastLogDate intake history');

        const rankedList = users.map(u => {
            const goal = u.goal || 2500;

            let todayIntake = 0;
            if (u.lastLogDate === todayKey) {
                todayIntake = u.intake || 0;
            } else if (u.history) {
                const todayData = u.history.get ? u.history.get(todayKey) : u.history[todayKey];
                if (todayData) todayIntake = todayData.total || todayData.intake || 0;
            }

            const pct = Math.min(100, Math.round((todayIntake / goal) * 100));
            const streak = u.streak || 0;

            let rankTitle = "🌵 Desert Dweller";
            if (pct >= 90) rankTitle = "🔱 Ocean Master";
            else if (pct >= 80) rankTitle = "🛡️ Shield Guardian";
            else if (pct >= 70) rankTitle = "🏄 Wave Rider";
            else if (pct >= 60) rankTitle = "🌊 Current Commander";
            else if (pct >= 50) rankTitle = "🚣 River Guide";
            else if (pct >= 40) rankTitle = "🛶 Stream Sailor";
            else if (pct >= 20) rankTitle = "🧊 Dew Dropper";
            else if (pct >= 10) rankTitle = "🌫️ Mist Seeker";

            return {
                id: u._id.toString(),
                username: u.username,
                intake: todayIntake,
                goal: goal,
                streak: streak,
                pct: pct,
                rankTitle: rankTitle,
                lastLogDate: u.lastLogDate || null,
                isCurrent: currentUserId ? (u._id.toString() === currentUserId.toString()) : false
            };
        });

        rankedList.sort((a, b) => {
            if (b.streak !== a.streak) return b.streak - a.streak;
            if (b.pct !== a.pct) return b.pct - a.pct;
            return b.intake - a.intake;
        });

        const finalLeaderboard = rankedList.map((item, index) => ({
            rank: index + 1,
            ...item
        }));

        res.json({ mode: 'solo', leaderboard: finalLeaderboard, date: todayKey });
    } catch (err) {
        console.error("Leaderboard error:", err);
        res.status(500).json({ error: "Failed to fetch leaderboard." });
    }
});

// Update Duo Leaderboard Opt-In Preference
app.post('/api/user/duo-optin', async (req, res) => {
    try {
        const { token, enabled } = req.body;
        const decoded = verifyUserToken(token);
        if (!decoded) return res.status(401).json({ error: "Unauthorized" });

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.duoLeaderboardOptIn = Boolean(enabled);
        await user.save();

        res.json({ message: `Duo Leaderboard set to ${user.duoLeaderboardOptIn ? 'ENABLED ✅' : 'DISABLED ❌'}`, duoLeaderboardOptIn: user.duoLeaderboardOptIn });
    } catch (err) {
        res.status(500).json({ error: "Failed to update Duo Leaderboard setting." });
    }
});


// Delete Account Permanently
app.post('/api/auth/delete-account', async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
        return res.status(400).json({ error: "Please enter current password and confirmation." });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ error: "User account not found." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Incorrect current password." });
        }

        await User.findByIdAndDelete(decoded.id);

        res.json({ message: "Account deleted permanently." });
    } catch (err) {
        res.status(401).json({ error: "Unauthorized or session expired." });
    }
});

// --- 4. HYDRATION DATA ROUTES ---

// Sync/Save User Data (Replaces your saveData() function)
app.post('/api/user/sync', async (req, res) => {
    const { token, userData } = req.body;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Use $set to only update the specific fields provided
        // This protects against accidentally deleting fields not sent in the request
        await User.findByIdAndUpdate(decoded.id, { $set: userData }); 
        
        res.json({ message: "Cloud Sync Successful!" });
    } catch (err) {
        res.status(401).json({ error: "Unauthorized Session" });
    }
});

// --- PUSH NOTIFICATION API ENDPOINTS ---

// Get Public VAPID Key
app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save Push Subscription
app.post('/api/push/subscribe', async (req, res) => {
    const { token, subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Invalid subscription" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Tag subscription with current VAPID public key fingerprint
        subscription._vapidKey = VAPID_PUBLIC_KEY;

        // Purge ALL subscriptions from a different (old) VAPID key — they are permanently invalid
        // Keep only subscriptions matching current VAPID key (excluding same endpoint which we'll replace)
        let validSubs = (user.pushSubscriptions || []).filter(sub =>
            sub._vapidKey === VAPID_PUBLIC_KEY && sub.endpoint !== subscription.endpoint
        );
        validSubs.push(subscription);

        user.pushSubscriptions = validSubs;
        await user.save();

        res.json({ message: `Push Subscription Saved! ${validSubs.length} active device(s).` });
    } catch (err) {
        res.status(401).json({ error: "Unauthorized" });
    }
});


// Test Web Push endpoint (Sends immediate push notification to user's registered devices)
app.post('/api/push/test', async (req, res) => {
    const { token } = req.body;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
            return res.status(400).json({ error: "No active push subscription found for your account. Please click 'Enable Notifications'." });
        }

        const payload = JSON.stringify({
            title: "🧪 Web Push Test | HydroTracker",
            body: "Server-side Web Push is working! Alarms will ring even when app is closed.",
            icon: "./icon-192x192.png",
            badge: "./icon-192x192.png"
        });

        let successCount = 0;
        const validSubs = [];

        for (const sub of user.pushSubscriptions) {
            try {
                await webpush.sendNotification(sub, payload);
                successCount++;
                validSubs.push(sub);
            } catch (e) {
                console.log(`Pruning stale subscription endpoint: ${e.statusCode || e.message}`);
                // Automatically prune expired/invalid subscription endpoints
            }
        }

        // Save pruned subscriptions list
        if (validSubs.length !== user.pushSubscriptions.length) {
            user.pushSubscriptions = validSubs;
            await user.save();
        }

        if (successCount > 0) {
            res.json({ message: `Test push sent to ${successCount} device(s)!` });
        } else {
            res.status(400).json({ error: "Push delivery failed for saved endpoints. Re-subscribing device..." });
        }
    } catch (err) {
        res.status(401).json({ error: "Unauthorized" });
    }
});


app.post('/api/auth/update-password', async (req, res) => {
    const { token, currentPassword, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        // Verify the current password before allowing the change
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Current password is incorrect." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await User.findByIdAndUpdate(decoded.id, { password: hashedPassword });
        res.json({ message: "Password updated!" });
    } catch (err) {
        res.status(401).json({ error: "Unauthorized" });
    }
});

// Fetch User Data (For initial load)
app.get('/api/user/data', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        let user = await User.findById(decoded.id).select('-password');
        
        const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

        // --- SERVER-SIDE DAILY RESET LOGIC ---
        // Only trigger a reset if lastLogDate exists AND is strictly earlier than today (e.g. YYYY-MM-DD < todayISO)
        if (user.lastLogDate && user.lastLogDate < todayISO) {
            const cleanOldDate = user.lastLogDate.substring(0, 10);
            const historyEntry = {
                total: user.intake || 0,
                logs: user.currentLogs || []
            };

            user = await User.findByIdAndUpdate(decoded.id, {
                $set: {
                    [`history.${cleanOldDate}`]: historyEntry,
                    intake: 0,
                    currentLogs: [],
                    lastLogDate: todayISO
                }
            }, { new: true }).select('-password');
        } else if (user.lastLogDate !== todayISO) {
            // Ensure lastLogDate matches todayISO without wiping current intake or logs
            user = await User.findByIdAndUpdate(decoded.id, {
                $set: { lastLogDate: todayISO }
            }, { new: true }).select('-password');
        }

        if (!user.createdAtDate) {
            let earliest = todayISO;
            if (user.history) {
                const keys = Array.from(user.history.keys ? user.history.keys() : Object.keys(user.history)).sort();
                if (keys.length > 0 && keys[0] < earliest) earliest = keys[0];
            }
            if (user.lastLogDate && user.lastLogDate < earliest) earliest = user.lastLogDate;
            user = await User.findByIdAndUpdate(decoded.id, {
                $set: { createdAtDate: earliest }
            }, { new: true }).select('-password');
        }

        res.json(user);
    } catch (err) {
        res.status(401).json({ error: "Unauthorized" });
    }
});

const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

function maskEmail(email) {
    if (!email || !email.includes('@')) return email || '';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}***@${domain}`;
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

// ── Primary: Gmail REST API via HTTPS (works on Render — no SMTP ports needed) ──
async function sendViaGmailAPI({ to, subject, html }) {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_USER } = process.env;
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !EMAIL_USER) {
        throw new Error('Missing OAuth2 env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_USER');
    }

    const oauth2Client = new OAuth2(
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const messageParts = [
        `From: HydroTracker <${EMAIL_USER}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html
    ];
    const raw = Buffer.from(messageParts.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
    });
    console.log('[Gmail API] Sent OK — id:', result.data.id);
    return result.data;
}

// ── Fallback: App Password SMTP (for local dev) ──
async function sendViaSMTP({ to, subject, html }) {
    const { EMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
    if (!EMAIL_USER || !GMAIL_APP_PASSWORD) throw new Error('Missing EMAIL_USER or GMAIL_APP_PASSWORD');
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: EMAIL_USER.trim(), pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') }
    });
    const info = await transporter.sendMail({
        from: `HydroTracker <${EMAIL_USER}>`, to, subject, html
    });
    console.log('[SMTP] Sent OK:', info.response);
    return info;
}

// ── Unified send function: tries Gmail API first, then SMTP ──
async function sendEmail({ to, subject, html }) {
    try {
        await sendViaGmailAPI({ to, subject, html });
        return { method: 'gmail-api' };
    } catch (apiErr) {
        console.warn('[Gmail API] failed:', apiErr.message, '— trying SMTP fallback...');
        await sendViaSMTP({ to, subject, html });
        return { method: 'smtp' };
    }
}

// ── Debug Email Test Endpoint ──────────────────────────────
// GET /api/test-email
app.get('/api/test-email', async (req, res) => {
    console.log('[test-email] ENV CHECK — EMAIL_USER:', process.env.EMAIL_USER,
        '| CLIENT_ID exists:', !!process.env.GMAIL_CLIENT_ID,
        '| REFRESH_TOKEN exists:', !!process.env.GMAIL_REFRESH_TOKEN,
        '| APP_PASS exists:', !!process.env.GMAIL_APP_PASSWORD);
    try {
        const result = await sendEmail({
            to: process.env.EMAIL_USER || 'ishaanhingway@gmail.com',
            subject: '✅ HydroTracker Email Test',
            html: '<h2>✅ It works!</h2><p>Email delivery from Render is working correctly via Gmail API.</p>'
        });
        res.json({ ok: true, method: result.method });
    } catch (err) {
        console.error('[test-email] FAIL:', err.message);
        res.json({ ok: false, error: err.message });
    }
});

// Forgot Password Route
app.post('/api/auth/recover', async (req, res) => {
    const { email } = req.body;
    try {
        const cleanInput = String(email || "").trim();
        if (!cleanInput) {
            return res.status(400).json({ error: "Please enter your registered email or username." });
        }

        // 1. Find user by email OR username (case-insensitive)
        const escapedInput = cleanInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const user = await User.findOne({
            $or: [
                { email: new RegExp(`^${escapedInput}$`, 'i') },
                { username: new RegExp(`^${escapedInput}$`, 'i') }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: "No account found matching this email or username." });
        }

        // 2. Generate temp password
        const tempPass = "TEMP-" + Math.floor(1000 + Math.random() * 9000);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPass, salt);

        // 3. Always update user's password in DB so temp password works for login
        await User.findByIdAndUpdate(user._id, { password: hashedPassword });

        const targetEmail = user.email || cleanInput;
        const masked = maskEmail(targetEmail);

        // 4. Send email via Gmail API (HTTPS) with SMTP fallback
        try {
            await sendEmail({
                to: targetEmail,
                subject: "Your Temporary Password | HydroTracker",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e3f2fd; border-radius: 10px; max-width: 480px;">
                        <h2 style="color: #1565c0;">💧 HydroTracker Recovery</h2>
                        <p>Hello <strong>${user.username}</strong>,</p>
                        <p>You requested a password reset. Use your temporary password below to log in:</p>
                        <div style="background: #f0f4f8; padding: 15px; font-size: 1.4rem; font-weight: bold; text-align: center; border-radius: 5px; color: #1565c0; letter-spacing: 2px; margin: 16px 0;">
                            ${tempPass}
                        </div>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 15px;">
                            ⚠️ Please change your password immediately after logging in from the <strong>Settings</strong> page.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e3f2fd; margin: 20px 0;">
                        <p style="color: #aaa; font-size: 0.75rem;">HydroTracker — Stay Hydrated 💧</p>
                    </div>
                `
            });
            res.json({
                success: true,
                emailSent: true,
                targetEmail,
                maskedEmail: masked,
                username: user.username,
                message: `📧 Temporary password sent to ${masked}! Please check your inbox (and Spam/Junk folder).`
            });
        } catch (emailErr) {
            console.error("⚠️ Email delivery failed (all methods):", emailErr.message || emailErr);
            res.json({
                success: true,
                emailSent: false,
                targetEmail,
                maskedEmail: masked,
                username: user.username,
                message: `Email delivery failed. Please contact support.`
            });
        }

    } catch (error) {
        console.error("Recovery Route Error:", error);
        res.status(500).json({ error: "Server error during recovery. Please try again." });
    }
});





const fs = require('fs');

// Clean URL routes
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, 'history.html')));
app.get('/insights', (req, res) => res.sendFile(path.join(__dirname, 'insights.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'settings.html')));

// --- 6. BUDDY & CO-OP DUEL ROUTES ---

function extractToken(reqOrToken) {
    if (!reqOrToken) return null;
    if (typeof reqOrToken === 'string') {
        let str = reqOrToken.trim();
        if (str.startsWith('Bearer ')) str = str.slice(7).trim();
        return str;
    }
    const req = reqOrToken;
    let token = (req.body && req.body.token) ? req.body.token : null;
    if (!token && req.headers && req.headers.authorization) {
        token = req.headers.authorization;
    }
    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }
    if (typeof token === 'string') {
        token = token.trim();
        if (token.startsWith('Bearer ')) token = token.slice(7).trim();
    }
    return token;
}

function verifyUserToken(reqOrToken) {
    const tokenStr = extractToken(reqOrToken);
    if (!tokenStr || tokenStr === 'null' || tokenStr === 'undefined') return null;
    try { 
        return jwt.verify(tokenStr, JWT_SECRET); 
    } catch (e) { 
        return null; 
    }
}

app.post('/api/user/buddy/request', async (req, res) => {
    try {
        const { targetUsername } = req.body;
        const decoded = verifyUserToken(req);
        if (!decoded) return res.status(401).json({ error: "Unauthorized — please log in again." });

        const sender = await User.findById(decoded.id);
        if (!sender) return res.status(404).json({ error: "User not found" });

        const targetName = String(targetUsername || "").trim();
        if (!targetName) return res.status(400).json({ error: "Username required" });

        if (targetName.toLowerCase() === sender.username.toLowerCase()) {
            return res.status(400).json({ error: "You cannot add yourself as a buddy!" });
        }

        const targetUser = await User.findOne({ username: new RegExp(`^${targetName}$`, 'i') });
        if (!targetUser) return res.status(404).json({ error: `User "${targetName}" not found` });

        if (sender.buddy && sender.buddy.status === 'accepted') {
            return res.status(400).json({ error: `You already have a buddy (${sender.buddy.username}). Unlink first to add a new buddy.` });
        }
        if (targetUser.buddy && targetUser.buddy.status === 'accepted') {
            return res.status(400).json({ error: `${targetUser.username} already has a buddy.` });
        }

        const exists = targetUser.incomingBuddyRequests.find(r => r.username.toLowerCase() === sender.username.toLowerCase());
        if (!exists) {
            targetUser.incomingBuddyRequests.push({ username: sender.username, date: new Date().toISOString() });
            targetUser.markModified('incomingBuddyRequests');
            await targetUser.save();
        }

        sender.buddy = { username: targetUser.username, status: 'pending' };
        sender.markModified('buddy');
        await sender.save();

        // ✉️ Send Email Invitation to targetUser.email
        if (targetUser.email) {
            try {
                const inviteToken = jwt.sign(
                    { senderUsername: sender.username, targetUsername: targetUser.username, action: 'buddy-invite' },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                const host = req.get('host') || 'localhost:5000';
                const protocol = req.protocol || 'http';
                const acceptUrl = `${protocol}://${host}/api/user/buddy/email-respond?token=${inviteToken}&action=accept`;
                const declineUrl = `${protocol}://${host}/api/user/buddy/email-respond?token=${inviteToken}&action=decline`;

                const emailHtml = `
                    <div style="font-family:'Outfit', Arial, sans-serif; background-color:#f0f9ff; padding:30px 15px; color:#0c4a6e;">
                        <div style="max-width:540px; margin:0 auto; background:#ffffff; border-radius:20px; padding:25px 30px; box-shadow:0 8px 30px rgba(2,132,199,0.12); border:1px solid #e0f2fe;">
                            <div style="text-align:center; margin-bottom:20px;">
                                <span style="font-size:2.8rem;">💧</span>
                                <h2 style="color:#0284c7; margin:6px 0 0 0; font-size:1.5rem; font-weight:800;">Hydration Duo Invitation!</h2>
                            </div>
                            <p style="font-size:1rem; line-height:1.6; color:#334155; margin-bottom:20px;">
                                Hey <strong>${targetUser.username}</strong>,<br><br>
                                <strong>${sender.username}</strong> wants to pair up with you as a <strong>Hydration Duo Partner</strong> on HydroTracker!
                            </p>
                            <div style="background:#e0f2fe; border-left:4px solid #0284c7; padding:12px 16px; border-radius:8px; margin-bottom:24px; font-size:0.9rem; color:#0369a1;">
                                🔥 <strong>Track a Shared Co-Op Streak:</strong> Compete daily, monitor each other's water goals, and send instant hydration pings!
                            </div>
                            <div style="display:flex; justify-content:center; gap:12px; margin-bottom:25px;">
                                <a href="${acceptUrl}" style="background:linear-gradient(135deg,#0284c7,#0369a1); color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:30px; font-weight:700; font-size:0.92rem; display:inline-block;">Accept Invitation ✅</a>
                                <a href="${declineUrl}" style="background:#f43f5e; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:30px; font-weight:700; font-size:0.92rem; display:inline-block;">Decline ❌</a>
                            </div>
                            <p style="font-size:0.78rem; color:#94a3b8; text-align:center; margin:0;">
                                HydroTracker • Stay hydrated together!
                            </p>
                        </div>
                    </div>
                `;

                const masked = maskEmail(targetUser.email);
                console.log(`[Buddy Invite] Dispatching email to ${masked}...`);

                await sendEmail({
                    to: targetUser.email,
                    subject: `💧 Hydration Duo Invite from ${sender.username} on HydroTracker!`,
                    html: emailHtml
                });

                console.log(`[Buddy Invite] Sent email to ${masked} OK`);
                return res.json({ 
                    message: `📧 Buddy request & email invite sent to ${targetUser.username} (${masked})! 🎉`, 
                    emailSent: true,
                    maskedEmail: masked,
                    buddy: sender.buddy 
                });

            } catch (emailErr) {
                console.error("[Buddy Invite] Email send failed:", emailErr.message);
            }
        }

        res.json({ message: `Buddy request sent to ${targetUser.username}! 🎉`, buddy: sender.buddy });
    } catch (err) {
        console.error("Buddy request error:", err);
        res.status(500).json({ error: "Failed to send buddy request." });
    }
});

// 1-Click Email Response Endpoint (Accept/Decline from inbox)
app.get('/api/user/buddy/email-respond', async (req, res) => {
    try {
        const { token, action } = req.query;
        if (!token || !action) return res.status(400).send("Invalid response link.");

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(400).send("<h2>Link expired or invalid.</h2>");
        }

        const sender = await User.findOne({ username: new RegExp(`^${decoded.senderUsername}$`, 'i') });
        const target = await User.findOne({ username: new RegExp(`^${decoded.targetUsername}$`, 'i') });

        if (!sender || !target) {
            return res.status(404).send("<h2>User not found.</h2>");
        }

        // Remove incoming request from target
        target.incomingBuddyRequests = (target.incomingBuddyRequests || []).filter(r => r.username.toLowerCase() !== sender.username.toLowerCase());
        target.markModified('incomingBuddyRequests');

        if (action === 'accept') {
            // Check if sender (inviter) is already in an active duo with someone else
            if (sender.buddy && sender.buddy.status === 'accepted' && sender.buddy.username.toLowerCase() !== target.username.toLowerCase()) {
                await target.save();
                return res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Already in a Duo ⚠️</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap" rel="stylesheet">
                        <style>
                            body { font-family:'Outfit',sans-serif; text-align:center; padding:40px 20px; background:#fefce8; color:#713f12; margin:0; }
                            .card { max-width:480px; margin:40px auto; background:#fff; padding:36px 28px; border-radius:24px; box-shadow:0 12px 36px rgba(234,179,8,0.18); border:1px solid #fef08a; }
                            .btn-open { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#ca8a04,#a16207); color:#fff; text-decoration:none; font-weight:800; border-radius:30px; font-size:0.95rem; box-shadow:0 6px 20px rgba(202,138,4,0.3); }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div style="font-size:3.5rem; margin-bottom:12px;">👥</div>
                            <h2 style="color:#ca8a04; margin-bottom:12px; font-size:1.6rem;">Already In A Hydration Duo!</h2>
                            <p style="font-size:1rem; line-height:1.6; color:#475569; margin-bottom:24px;">
                                <strong>${sender.username}</strong> is already in an active Hydration Duo with <strong>${sender.buddy.username}</strong>.
                            </p>
                            <a href="/leaderboard.html" class="btn-open">Go to Leaderboard 🏆</a>
                        </div>
                    </body>
                    </html>
                `);
            }

            // Check if target (recipient) is already in an active duo with someone else
            if (target.buddy && target.buddy.status === 'accepted' && target.buddy.username.toLowerCase() !== sender.username.toLowerCase()) {
                await target.save();
                return res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>You're in a Duo ⚠️</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap" rel="stylesheet">
                        <style>
                            body { font-family:'Outfit',sans-serif; text-align:center; padding:40px 20px; background:#fefce8; color:#713f12; margin:0; }
                            .card { max-width:480px; margin:40px auto; background:#fff; padding:36px 28px; border-radius:24px; box-shadow:0 12px 36px rgba(234,179,8,0.18); border:1px solid #fef08a; }
                            .btn-open { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#ca8a04,#a16207); color:#fff; text-decoration:none; font-weight:800; border-radius:30px; font-size:0.95rem; box-shadow:0 6px 20px rgba(202,138,4,0.3); }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div style="font-size:3.5rem; margin-bottom:12px;">⚠️</div>
                            <h2 style="color:#ca8a04; margin-bottom:12px; font-size:1.6rem;">You Are Already In A Duo</h2>
                            <p style="font-size:1rem; line-height:1.6; color:#475569; margin-bottom:24px;">
                                You are currently paired up with <strong>${target.buddy.username}</strong>. Please unlink from your current partner first if you wish to join a new Duo.
                            </p>
                            <a href="/leaderboard.html" class="btn-open">Go to Leaderboard 🏆</a>
                        </div>
                    </body>
                    </html>
                `);
            }

            // Check if sender (inviter) has withdrawn/cancelled this invitation
            if (!sender.buddy || sender.buddy.username.toLowerCase() !== target.username.toLowerCase() || sender.buddy.status !== 'pending') {
                await target.save();
                return res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Invitation Withdrawn 🚫</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap" rel="stylesheet">
                        <style>
                            body { font-family:'Outfit',sans-serif; text-align:center; padding:40px 20px; background:#fff1f2; color:#be123c; margin:0; }
                            .card { max-width:480px; margin:40px auto; background:#fff; padding:36px 28px; border-radius:24px; box-shadow:0 12px 36px rgba(244,63,94,0.15); border:1px solid #fecdd3; }
                            .btn-open { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#f43f5e,#be123c); color:#fff; text-decoration:none; font-weight:800; border-radius:30px; font-size:0.95rem; box-shadow:0 6px 20px rgba(244,63,94,0.3); }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div style="font-size:3.5rem; margin-bottom:12px;">🚫</div>
                            <h2 style="color:#f43f5e; margin-bottom:12px; font-size:1.6rem;">Invitation Withdrawn</h2>
                            <p style="font-size:1rem; line-height:1.6; color:#475569; margin-bottom:24px;">
                                <strong>${sender.username}</strong> has withdrawn this Hydration Duo invitation.
                            </p>
                            <a href="/leaderboard.html" class="btn-open">Go to Leaderboard 🏆</a>
                        </div>
                    </body>
                    </html>
                `);
            }

            target.buddy = { username: sender.username, status: 'accepted' };
            sender.buddy = { username: target.username, status: 'accepted' };
            
            target.markModified('buddy');
            sender.markModified('buddy');
            await target.save();
            await sender.save();

            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Hydration Duo Accepted 🎉</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap" rel="stylesheet">
                    <style>
                        body { font-family:'Outfit',sans-serif; text-align:center; padding:40px 20px; background:#f0f9ff; color:#0c4a6e; margin:0; }
                        .card { max-width:480px; margin:40px auto; background:#fff; padding:36px 28px; border-radius:24px; box-shadow:0 12px 36px rgba(2,132,199,0.15); border:1px solid #e0f2fe; }
                        .btn-open { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#0284c7,#0369a1); color:#fff; text-decoration:none; font-weight:800; border-radius:30px; font-size:0.95rem; box-shadow:0 6px 20px rgba(2,132,199,0.3); }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div style="font-size:3.5rem; margin-bottom:12px;">🎉</div>
                        <h2 style="color:#0284c7; margin-bottom:12px; font-size:1.6rem;">Hydration Duo Activated!</h2>
                        <p style="font-size:1rem; line-height:1.6; color:#475569; margin-bottom:20px;">
                            Awesome! You and <strong>${sender.username}</strong> are now official <strong>Hydration Duo</strong> partners!
                        </p>
                        <p style="font-size:0.88rem; color:#0284c7; font-weight:700; margin-bottom:24px;" id="redirect-status">
                            📲 Redirecting to HydroTracker App / Website in <span id="countdown">3</span>s...
                        </p>
                        <a href="/leaderboard.html?duo_accepted=true" id="app-btn" class="btn-open">Open App / Website 🚀</a>
                    </div>

                    <script>
                        let seconds = 3;
                        const countdownEl = document.getElementById('countdown');
                        const targetUrl = window.location.origin + '/leaderboard.html?duo_accepted=true';

                        const timer = setInterval(() => {
                            seconds--;
                            if (countdownEl) countdownEl.textContent = seconds;
                            if (seconds <= 0) {
                                clearInterval(timer);
                                window.location.href = targetUrl;
                            }
                        }, 1000);
                    </script>
                </body>
                </html>
            `);
        } else {
            // Decline
            if (sender.buddy && sender.buddy.username.toLowerCase() === target.username.toLowerCase()) {
                sender.buddy = null;
            }
            sender.declineAlerts.push({ username: target.username, date: new Date().toISOString() });
            sender.markModified('declineAlerts');
            sender.markModified('buddy');
            await sender.save();
            await target.save();

            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Invitation Declined</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&display=swap" rel="stylesheet">
                </head>
                <body style="font-family:'Outfit',sans-serif; text-align:center; padding:40px 20px; background:#fff1f2; color:#be123c; margin:0;">
                    <div style="max-width:480px; margin:40px auto; background:#fff; padding:36px 28px; border-radius:24px; box-shadow:0 12px 36px rgba(244,63,94,0.15);">
                        <div style="font-size:3.5rem; margin-bottom:12px;">❌</div>
                        <h2 style="color:#f43f5e; margin-bottom:12px; font-size:1.6rem;">Invitation Declined</h2>
                        <p style="font-size:1rem; line-height:1.6; color:#475569; margin-bottom:24px;">
                            You have declined the Hydration Duo invite from <strong>${sender.username}</strong>.
                        </p>
                        <a href="/leaderboard.html" style="display:inline-block; padding:14px 32px; background:#475569; color:#fff; text-decoration:none; font-weight:800; border-radius:30px; font-size:0.95rem;">Return to App 🏠</a>
                    </div>
                </body>
                </html>
            `);
        }

    } catch (err) {
        console.error("Email respond error:", err);
        res.status(500).send("Error processing response.");
    }
});

app.post('/api/user/buddy/respond', async (req, res) => {
    try {
        const { senderUsername, action } = req.body;
        const decoded = verifyUserToken(req);
        if (!decoded) return res.status(401).json({ error: "Unauthorized" });

        const me = await User.findById(decoded.id);
        if (!me) return res.status(404).json({ error: "User not found" });

        const sender = await User.findOne({ username: new RegExp(`^${senderUsername}$`, 'i') });

        me.incomingBuddyRequests = (me.incomingBuddyRequests || []).filter(r => r.username.toLowerCase() !== String(senderUsername).toLowerCase());
        me.markModified('incomingBuddyRequests');

        if (action === 'accept' && sender) {
            if (sender.buddy && sender.buddy.status === 'accepted' && sender.buddy.username.toLowerCase() !== me.username.toLowerCase()) {
                await me.save();
                return res.status(400).json({ error: `⚠️ ${sender.username} is already in an active Hydration Duo with ${sender.buddy.username}.` });
            }

            if (me.buddy && me.buddy.status === 'accepted' && me.buddy.username.toLowerCase() !== sender.username.toLowerCase()) {
                await me.save();
                return res.status(400).json({ error: `⚠️ You are already in an active Hydration Duo with ${me.buddy.username}. Please unlink first.` });
            }

            me.buddy = { username: sender.username, status: 'accepted' };
            sender.buddy = { username: me.username, status: 'accepted' };
            
            me.markModified('buddy');
            sender.markModified('buddy');
            await me.save();
            await sender.save();
            return res.json({ message: `🎉 You and ${sender.username} are now Hydration Buddies!`, status: 'accepted' });
        } else {
            if (sender) {
                if (sender.buddy && sender.buddy.username.toLowerCase() === me.username.toLowerCase()) {
                    sender.buddy = null;
                    sender.markModified('buddy');
                }
                sender.declineAlerts.push({ username: me.username, date: new Date().toISOString() });
                sender.markModified('declineAlerts');
                await sender.save();
            }
            await me.save();
            return res.json({ message: "Buddy request declined." });
        }
    } catch (err) {
        console.error("Buddy respond error:", err);
        res.status(500).json({ error: "Failed to respond to request." });
    }
});

app.post('/api/user/buddy/nudge', async (req, res) => {
    try {
        const decoded = verifyUserToken(req);
        if (!decoded) return res.status(401).json({ error: "Unauthorized" });

        const me = await User.findById(decoded.id);
        if (!me || !me.buddy || me.buddy.status !== 'accepted') {
            return res.status(400).json({ error: "You don't have an active buddy to nudge." });
        }

        const buddyUser = await User.findOne({ username: new RegExp(`^${me.buddy.username}$`, 'i') });
        if (!buddyUser) return res.status(404).json({ error: "Buddy user not found." });

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        buddyUser.pendingNudges.push({
            from: me.username,
            message: `💧 ${me.username} sent you a hydration nudge! Time to drink water!`,
            time: timeStr
        });
        buddyUser.markModified('pendingNudges');
        await buddyUser.save();

        if (buddyUser.pushSubscriptions && buddyUser.pushSubscriptions.length > 0) {
            const payload = JSON.stringify({
                title: "💧 Buddy Hydration Nudge!",
                body: `Hey! ${me.username} is asking you to drink water now!`,
                icon: 'icon-192x192.png'
            });
            for (const sub of buddyUser.pushSubscriptions) {
                try { await webpush.sendNotification(sub, payload); } catch (e) {}
            }
        }

        res.json({ message: `💧 Nudge sent to ${me.buddy.username}!` });
    } catch (err) {
        console.error("Buddy nudge error:", err);
        res.status(500).json({ error: "Failed to send nudge." });
    }
});

app.post('/api/user/buddy/remove', async (req, res) => {
    try {
        const decoded = verifyUserToken(req);
        if (!decoded) return res.status(401).json({ error: "Unauthorized" });

        const me = await User.findById(decoded.id);
        if (!me) return res.status(404).json({ error: "User not found" });

        if (me.buddy && me.buddy.username) {
            const buddyUser = await User.findOne({ username: new RegExp(`^${me.buddy.username}$`, 'i') });
            if (buddyUser && buddyUser.buddy && buddyUser.buddy.username.toLowerCase() === me.username.toLowerCase()) {
                buddyUser.buddy = null;
                buddyUser.markModified('buddy');
                await buddyUser.save();
            }
        }
        me.buddy = null;
        me.markModified('buddy');
        await me.save();

        res.json({ message: "Buddy unlinked." });
    } catch (err) {
        res.status(500).json({ error: "Failed to remove buddy." });
    }
});

app.post('/api/user/buddy/cancel', async (req, res) => {
    try {
        const decoded = verifyUserToken(req);
        if (!decoded) return res.status(401).json({ error: "Unauthorized" });

        const me = await User.findById(decoded.id);
        if (!me) return res.status(404).json({ error: "User not found" });

        if (me.buddy && me.buddy.username) {
            const targetName = me.buddy.username;
            const targetUser = await User.findOne({ username: new RegExp(`^${targetName}$`, 'i') });
            
            if (targetUser && targetUser.incomingBuddyRequests) {
                targetUser.incomingBuddyRequests = targetUser.incomingBuddyRequests.filter(r => r.username.toLowerCase() !== me.username.toLowerCase());
                targetUser.markModified('incomingBuddyRequests');
                await targetUser.save();
            }
        }

        me.buddy = null;
        me.markModified('buddy');
        await me.save();

        res.json({ message: "🚫 Hydration Duo invitation withdrawn." });
    } catch (err) {
        console.error("Cancel buddy invite error:", err);
        res.status(500).json({ error: "Failed to cancel invitation." });
    }
});

app.get('/api/user/buddy/status', async (req, res) => {
    try {
        const decoded = verifyUserToken(req);
        if (!decoded) return res.status(401).json({ error: "Unauthorized" });

        const me = await User.findById(decoded.id);
        if (!me) return res.status(404).json({ error: "User not found" });

        const nudges = [...(me.pendingNudges || [])];
        if (nudges.length > 0) {
            me.pendingNudges = [];
            me.markModified('pendingNudges');
        }

        const declineAlerts = [...(me.declineAlerts || [])];
        if (declineAlerts.length > 0) {
            me.declineAlerts = [];
            me.markModified('declineAlerts');
        }

        if (nudges.length > 0 || declineAlerts.length > 0) {
            await me.save();
        }

        const myIntake = me.intake || 0;
        const myGoal   = me.goal || 2500;
        const myPct    = Math.round((myIntake / myGoal) * 100);

        if (!me.buddy || !me.buddy.username) {
            return res.json({
                hasBuddy: false,
                buddyState: null,
                myStatus: { intake: myIntake, goal: myGoal, pct: myPct },
                incomingRequests: me.incomingBuddyRequests || [],
                nudges,
                declineAlerts
            });
        }

        if (me.buddy.status === 'pending') {
            return res.json({
                hasBuddy: false,
                buddyState: { username: me.buddy.username, status: 'pending' },
                myStatus: { intake: myIntake, goal: myGoal, pct: myPct },
                incomingRequests: me.incomingBuddyRequests || [],
                nudges,
                declineAlerts
            });
        }

        const buddyUser = await User.findOne({ username: new RegExp(`^${me.buddy.username}$`, 'i') });
        if (!buddyUser) {
            return res.json({
                hasBuddy: false,
                buddyState: null,
                myStatus: { intake: myIntake, goal: myGoal, pct: myPct },
                incomingRequests: me.incomingBuddyRequests || [],
                nudges,
                declineAlerts
            });
        }

        const bIntake = buddyUser.intake || 0;
        const bGoal   = buddyUser.goal || 2500;
        const bPct    = Math.round((bIntake / bGoal) * 100);

        const historyMe = me.history || new Map();
        const historyB  = buddyUser.history || new Map();
        let coopStreak  = (myPct >= 100 && bPct >= 100) ? 1 : 0;

        for (let i = 1; i <= 30; i++) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            
            const eMe = historyMe.get ? historyMe.get(dateStr) : historyMe[dateStr];
            const eB  = historyB.get ? historyB.get(dateStr) : historyB[dateStr];

            const vMe = (eMe && typeof eMe === 'object') ? (eMe.total || 0) : (Number(eMe) || 0);
            const vB  = (eB && typeof eB === 'object')  ? (eB.total || 0)  : (Number(eB)  || 0);

            if (vMe >= myGoal && vB >= bGoal) {
                coopStreak++;
            } else {
                break;
            }
        }

        res.json({
            hasBuddy: true,
            buddyState: {
                username: buddyUser.username,
                status: 'accepted',
                intake: bIntake,
                goal: bGoal,
                pct: bPct,
                metGoalToday: bPct >= 100
            },
            myStatus: {
                intake: myIntake,
                goal: myGoal,
                pct: myPct,
                metGoalToday: myPct >= 100
            },
            coopStreak,
            incomingRequests: me.incomingBuddyRequests || [],
            nudges,
            declineAlerts
        });

    } catch (err) {
        console.error("Buddy status error:", err);
        res.status(500).json({ error: "Failed to fetch buddy status." });
    }
});

// Robust fallback handler for non-API routes (Express 4 & 5 compatible)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API endpoint not found" });
    }
    const cleanPath = req.path.replace(/^\//, '');
    if (cleanPath && fs.existsSync(path.join(__dirname, cleanPath))) {
        return res.sendFile(path.join(__dirname, cleanPath));
    }
    if (cleanPath && fs.existsSync(path.join(__dirname, cleanPath + '.html'))) {
        return res.sendFile(path.join(__dirname, cleanPath + '.html'));
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 HydroTracker Server live on port ${PORT}`);
    startServerPushCron();
});


// --- SERVER-SIDE PUSH ALARM CRON JOB ---
// Runs every minute to send Push Notifications to users' devices (PC / Android)
// even when the browser or app is completely closed!
function startServerPushCron() {
    console.log("⏰ Server-side Web Push Cron Job Initialized");
    
    const hydrationMessages = [
        "Time to drink water! 💧",
        "Stay hydrated — your body needs it!",
        "Quick reminder: drink some water!",
        "Hydration check — have you had water recently?",
        "Keep that streak going — drink up! 🔥"
    ];

    cron.schedule('* * * * *', async () => {
        try {
            // Get current time in Indian Standard Time (IST - Asia/Kolkata) using robust Intl formatter
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            }).formatToParts(now);

            const hh = (parts.find(p => p.type === 'hour')?.value || '00').padStart(2, '0');
            const mm = (parts.find(p => p.type === 'minute')?.value || '00').padStart(2, '0');
            const currentTime = `${hh}:${mm}`;

            // Find all users who have active push subscriptions
            const users = await User.find({ "pushSubscriptions.0": { $exists: true } });


            for (const user of users) {
                if (!user.pushSubscriptions || user.pushSubscriptions.length === 0) continue;

                let shouldNotify = false;
                let notifTitle = "💧 HydroTracker Reminder";
                let notifBody = "Time to stay hydrated!";

                // 1. Check Specific-Time Reminders
function formatTo12HrServer(time24) {
    if (!time24) return "";
    let parts = String(time24).split(':');
    if (parts.length < 2) return time24;
    let hours = parseInt(parts[0], 10);
    let minutes = parts[1];
    if (isNaN(hours)) return time24;
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

                if (Array.isArray(user.reminders)) {
                    for (let i = user.reminders.length - 1; i >= 0; i--) {
                        const r = user.reminders[i];
                        if (r && r.active !== false && r.time === currentTime) {
                            shouldNotify = true;
                            const randomMsg = hydrationMessages[Math.floor(Math.random() * hydrationMessages.length)];
                            notifTitle = "💧 Hydration Reminder";
                            notifBody = `🔔 ${formatTo12HrServer(r.time)} — ${randomMsg}`;

                            if (r.source === 'coach') {
                                user.reminders.splice(i, 1);
                                user.markModified('reminders');
                                await user.save();
                            }
                            break;
                        }
                    }
                }

                // 2. Check Post-Meal Reminders (+30m after meals)
                if (!shouldNotify && user.postMealEnabled && user.mealTimes) {
                    const mealKeys = ['bfast', 'lunch', 'dinner'];
                    const mealNames = { bfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

                    for (const key of mealKeys) {
                        const mealTime = user.mealTimes[key];
                        if (mealTime) {
                            let [hours, minutes] = mealTime.split(':').map(Number);
                            minutes += 30;
                            if (minutes >= 60) { hours = (hours + 1) % 24; minutes -= 60; }
                            const triggerTime = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');

                            if (triggerTime === currentTime) {
                                shouldNotify = true;
                                notifTitle = "🥗 Post-Meal Reminder";
                                notifBody = `30 mins since ${mealNames[key]} — time to hydrate!`;
                                break;
                            }
                        }
                    }
                }

                // If an alarm triggered, send web-push notification to all stored device subscriptions
                if (shouldNotify) {
                    const payload = JSON.stringify({
                        title: notifTitle,
                        body: notifBody,
                        icon: 'icon-192x192.png',
                        badge: 'icon-192x192.png'
                    });

                    const validSubs = [];
                    for (const sub of user.pushSubscriptions) {
                        try {
                            await webpush.sendNotification(sub, payload);
                            validSubs.push(sub);
                        } catch (pushErr) {
                            // If status is 410 (Gone) or 404 (Not Found), subscription expired/unregistered
                            if (pushErr.statusCode !== 410 && pushErr.statusCode !== 404) {
                                validSubs.push(sub);
                            }
                        }
                    }

                    // Update subscriptions array to remove expired endpoints
                    if (validSubs.length !== user.pushSubscriptions.length) {
                        await User.findByIdAndUpdate(user._id, { pushSubscriptions: validSubs });
                    }
                }
            }
        } catch (err) {
            console.error("Cron Push Error:", err.message);
        }
    });
}
