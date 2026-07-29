require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const allowedOrigins = [
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
        default: { bfast: "08:30", lunch: "13:30", dinner: "20:30" }
    },
    badges: { type: Array, default: [] },
    postMealEnabled: { type: Boolean, default: false },
    notes: { type: Map, of: String, default: {} }
});

const User = mongoose.model('User', UserSchema);

// --- 3. AUTHENTICATION ROUTES ---

// Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ 
            username, 
            email, 
            password: hashedPassword,
            lastLogDate: new Date().toISOString().split('T')[0],
            goal: 2500,
            reminders: [
                { time: "08:00", daily: true, active: true },
                { time: "12:00", daily: true, active: true },
                { time: "18:00", daily: true, active: true },
                { time: "21:00", daily: true, active: true }
            ],
            mealTimes: { bfast: "08:30", lunch: "13:30", dinner: "20:30" },
            postMealEnabled: false
        });

        await newUser.save();
        res.status(201).json({ message: "User created!" });
    } catch (err) {
        res.status(400).json({ error: "Username or Email already exists." });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
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
        
        const todayISO = new Date().toISOString().split('T')[0];

        // --- SERVER-SIDE DAILY RESET LOGIC ---
        if (user.lastLogDate !== todayISO) {
            // 1. Archive previous day's data into the History Map
            const historyEntry = {
                total: user.intake || 0,
                logs: user.currentLogs || []
            };

            // 2. Perform the update in MongoDB
            user = await User.findByIdAndUpdate(decoded.id, {
                $set: { 
                    [`history.${user.lastLogDate}`]: historyEntry,
                    intake: 0,
                    currentLogs: [],
                    lastLogDate: todayISO
                }
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

const createTransporter = async () => {
    // 1. App Password authentication (Recommended - Never expires)
    if (process.env.GMAIL_APP_PASSWORD) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '')
            }
        });
    }

    // 2. OAuth2 authentication
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
};

// Forgot Password Route
app.post('/api/auth/recover', async (req, res) => {
    const { email } = req.body;
    try {
        // 1. Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "No account found with this email." });
        }

        // 2. Generate temp password
        const tempPass = "TEMP-" + Math.floor(1000 + Math.random() * 9000);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPass, salt);

        // 3. Always update user's password in DB so temp password works for login
        await User.findByIdAndUpdate(user._id, { password: hashedPassword });

        // 4. Try sending the email via Gmail OAuth
        try {
            const transporter = await createTransporter();
            const mailOptions = {
                from: `HydroTrack <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Your Temporary Password | HydroTrack",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e3f2fd; border-radius: 10px;">
                        <h2 style="color: #1565c0;">💧 HydroTrack Recovery</h2>
                        <p>You requested a password reset. Use the temporary password below to log in:</p>
                        <div style="background: #f0f4f8; padding: 15px; font-size: 1.2rem; font-weight: bold; text-align: center; border-radius: 5px; color: #333;">
                            ${tempPass}
                        </div>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 15px;">
                            Important: Please change your password immediately after logging in from the Settings page.
                        </p>
                    </div>
                `
            };
            await transporter.sendMail(mailOptions);
            res.json({ message: "Temporary password sent to your email!" });
        } catch (emailErr) {
            console.error("⚠️ Email delivery failed (OAuth/SMTP):", emailErr.message || emailErr);
            // Fallback so password reset works even if OAuth credentials are invalid or expired
            res.json({ 
                message: `Temp Pass generated: ${tempPass} (Email sending failed. Please use this temporary password to log in!)`
            });
        }

    } catch (error) {
        console.error("Recovery Route Error:", error);
        res.status(500).json({ error: "Server error during recovery. Please try again." });
    }
});





const path = require('path');

// 1. Serve static files (HTML, CSS, JS, Images, Icons, Manifest, SW)
app.use(express.static(path.join(__dirname)));

// 2. Route clean URLs without .html extension
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, 'history.html')));
app.get('/insights', (req, res) => res.sendFile(path.join(__dirname, 'insights.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'settings.html')));

// 3. Fallback route for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 HydroTrack Server live on port ${PORT}`));
