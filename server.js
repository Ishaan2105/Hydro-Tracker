require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const path = require('path');
const webpush = require('web-push');
const cron = require('node-cron');

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
    leaderboardOptIn: { type: Boolean, default: true }
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

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '365d' });
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
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.id;
            } catch(e) {}
        }

        // Fetch users who have opted into the leaderboard (default: true)
        const users = await User.find({ leaderboardOptIn: { $ne: false } }).select('username goal intake streak lastLogDate');

        const rankedList = users.map(u => {
            const goal = u.goal || 2500;
            const intake = u.intake || 0;
            const pct = Math.round((intake / goal) * 100);

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
                intake: intake,
                goal: goal,
                streak: u.streak || 0,
                pct: pct,
                rankTitle: rankTitle,
                isCurrent: currentUserId ? (u._id.toString() === currentUserId.toString()) : false
            };
        });

        // Sort by Streak descending (1st priority), then Completion % descending (2nd priority), then Intake ml descending (3rd priority)
        rankedList.sort((a, b) => {
            if (b.streak !== a.streak) return b.streak - a.streak;
            if (b.pct !== a.pct) return b.pct - a.pct;
            return b.intake - a.intake;
        });

        // Add numerical rank (1-indexed)
        const finalLeaderboard = rankedList.map((item, index) => ({
            rank: index + 1,
            ...item
        }));

        res.json({ leaderboard: finalLeaderboard });
    } catch (err) {
        res.status(500).json({ error: "Failed to load leaderboard." });
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

const createTransporter = async () => {
    // 1. Gmail App Password authentication (Direct SSL on Port 465)
    if (process.env.GMAIL_APP_PASSWORD && process.env.EMAIL_USER) {
        return nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER.trim(),
                pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '')
            }
        });
    }

    // 2. Generic SMTP configuration (Host, Port, User, Pass)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // 3. OAuth2 authentication
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.EMAIL_USER) {
        const oauth2Client = new OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground"
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        const accessToken = await new Promise((resolve, reject) => {
            oauth2Client.getAccessToken((err, token) => {
                if (err) {
                    console.error("OAuth Token Error:", err.message || err);
                    reject(err);
                }
                resolve(token);
            });
        });

        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.EMAIL_USER,
                accessToken,
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN
            }
        });
    }

    throw new Error("No email credentials configured. Please set GMAIL_APP_PASSWORD & EMAIL_USER in server environment.");
};

// ── Debug Email Test Endpoint ──────────────────────────────
// GET /api/test-email  — tests credentials & sends a real email
app.get('/api/test-email', async (req, res) => {
    const hasAppPass = !!process.env.GMAIL_APP_PASSWORD;
    const emailUser  = process.env.EMAIL_USER || null;
    console.log('[test-email] EMAIL_USER:', emailUser, '| APP_PASS exists:', hasAppPass);

    if (!hasAppPass || !emailUser) {
        return res.json({ ok: false, reason: 'Missing GMAIL_APP_PASSWORD or EMAIL_USER env vars on this server.' });
    }

    try {
        const transporter = await createTransporter();
        const info = await transporter.sendMail({
            from: `HydroTracker <${emailUser}>`,
            to: emailUser,
            subject: '✅ HydroTracker Email Test',
            text: 'If you see this, email delivery from Render is working correctly!'
        });
        console.log('[test-email] SUCCESS:', info.response);
        res.json({ ok: true, accepted: info.accepted, response: info.response });
    } catch (err) {
        console.error('[test-email] FAIL:', err.message, err.code, err.responseCode);
        res.json({ ok: false, error: err.message, code: err.code, responseCode: err.responseCode });
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

        // 4. Try sending the email via Gmail / SMTP
        try {
            const transporter = await createTransporter();
            const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@hydrotracker.com";
            const mailOptions = {
                from: `HydroTracker <${senderEmail}>`,
                to: targetEmail,
                subject: "Your Temporary Password | HydroTracker",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e3f2fd; border-radius: 10px;">
                        <h2 style="color: #1565c0;">💧 HydroTracker Recovery</h2>
                        <p>Hello <strong>${user.username}</strong>,</p>
                        <p>You requested a password reset. Use your temporary password below to log in:</p>
                        <div style="background: #f0f4f8; padding: 15px; font-size: 1.4rem; font-weight: bold; text-align: center; border-radius: 5px; color: #1565c0; letter-spacing: 2px;">
                            ${tempPass}
                        </div>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 15px;">
                            Important: Please change your password immediately after logging in from the Settings page.
                        </p>
                    </div>
                `
            };
            await transporter.sendMail(mailOptions);
            res.json({ 
                success: true,
                emailSent: true,
                targetEmail: targetEmail,
                maskedEmail: masked,
                username: user.username,
                tempPass: tempPass,
                message: `📧 Temporary password sent to ${masked}! Please check your inbox (and Spam folder).`
            });
        } catch (emailErr) {
            console.error("⚠️ Email delivery failed (OAuth/SMTP):", emailErr.message || emailErr);
            // Fallback so password reset works even if email server is not configured
            res.json({ 
                success: true,
                emailSent: false,
                targetEmail: targetEmail,
                maskedEmail: masked,
                username: user.username,
                tempPass: tempPass,
                message: `🔑 Temp Pass: ${tempPass} (Email service offline. Use this password to log in!)`
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
                    for (const r of user.reminders) {
                        if (r && r.active !== false && r.time === currentTime) {
                            shouldNotify = true;
                            const randomMsg = hydrationMessages[Math.floor(Math.random() * hydrationMessages.length)];
                            notifTitle = "💧 Hydration Reminder";
                            notifBody = `🔔 ${formatTo12HrServer(r.time)} — ${randomMsg}`;
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
