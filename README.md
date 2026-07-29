💧 HydroTrack
HydroTrack is a high-performance, interactive MERN stack web application designed to help users track their daily water intake, set personalized goals, and stay consistent with smart notifications. It features a gamified experience with hydration ranks and visual trends.

🚀 Features
Personalized Goal Setting: Calculate your ideal daily intake based on weight and height using integrated health formulas.
Real-time Analytics: Visualize your 7-day hydration trends with dynamic, cloud-synced bar graphs.
Gamified Experience: Earn "Hydration Ranks" (from Desert Dweller to Ocean Master) and unlock badges for consistency.
Smart Reminders: Automated notifications for specific times, intervals, or post-meal intervals (30-minute delay).
Secure Recovery: Password recovery system powered by Nodemailer and Gmail OAuth2.
Interactive UI: Features a "Magnetic Rain" login screen and Perlin-noise-driven water wave effects.

🛠️ Tech Stack
Frontend: HTML5, CSS3, JavaScript (Vanilla), OGL (for WebGL effects).
Backend: Node.js, Express.js.

Database: MongoDB Atlas.

Authentication: JSON Web Tokens (JWT) & BcryptJS.

Mailing: Nodemailer with Google OAuth2.

📦 Installation & Setup
Clone the repository:

Bash
git clone https://github.com/ishaanhingway/HydroTrack.git
cd HydroTrack
Install dependencies:

Bash
npm install
Environment Variables:
Create a .env file in the root directory and add the following:

Code snippet
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
PORT=5000
EMAIL_USER=your_email@gmail.com
GMAIL_CLIENT_ID=your_id
GMAIL_CLIENT_SECRET=your_secret
GMAIL_REFRESH_TOKEN=your_token
Run the application:

Bash
# For production
npm start

# For development (requires nodemon)
npm run dev
📱 Progressive Web App (PWA)
HydroTrack is PWA-ready. You can "Install" it on your mobile device via the browser to get a native-app feel, including a standalone display and custom theme colors.