# 🏏 FanPulse: Interactive Cricket Companion App

FanPulse is a real-time, second-screen interactive sports companion application designed to elevate the live cricket viewing experience. Built for a fast-paced, high-engagement audience, FanPulse allows fans to predict match outcomes ball-by-ball, vote on umpire decisions, and react to live events together.

> **⚠️ NOTE:** Currently, this prototype runs on an **AI Auto-Simulation Engine**. The system generates random ball-by-ball outcomes to simulate a live match environment. Integration with real-world, live cricket API data ("Live Match Sync") is currently a **Work In Progress**.

---

## ✨ Features

- **Call the Ball (Micro-Predictions):** Predict the outcome of the next delivery (Dot, Single, Boundary, Wicket) before it is bowled to earn points!
- **Live Crowd Pulse:** A global sentiment meter that tracks the mood of the audience in real-time. Spam the 🔥, 🤯, 😡, and 🥶 emojis to swing the meter!
- **Armchair Umpire (DRS System):** When a close call happens, the simulation pauses and hands the decision to the audience. Vote OUT or NOT OUT and watch the community consensus roll in.
- **Ephemeral Chat:** When a massive moment occurs (like a boundary), a temporary chat room slides onto the screen for 30 seconds, letting the audience react wildly before vanishing.
- **Glassmorphism UI:** A premium, modern, responsive design built with raw CSS and flexbox.

---

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (No frameworks)
- **Backend/Syncing:** Firebase Realtime Database
- **Hosting (Recommended):** Google Cloud / Firebase Hosting

---

## 🎮 How to Use (Multiplayer Modes)

Because the app is fully synchronized globally using Firebase, it relies on a "Host" vs "Audience" setup.

### 1. Admin/Host Access
To control the simulation, you must access the app using the admin flag in the URL:
`https://your-app-url.com/?admin=true`

**As the Admin, you can:**
- Edit the "Match Title" in the header (e.g., "IND vs AUS").
- Click **"Auto-Simulate Match"** to start the engine. Your browser will act as the server, simulating balls and pushing real-time updates to the Firebase database.
- Click **"Stop Sim"** to conclude the match early and push everyone to the Result Screen.

### 2. Audience/Viewer Access
Share the normal URL (without the `?admin=true` flag) with your friends, audience, or colleagues:
`https://your-app-url.com/`

**As the Audience:**
- When you load the page, you will see a waiting screen: **"⏳ Waiting for Admin to start the match..."**
- The moment the Admin clicks "Auto-Simulate" on their machine, your screen will instantly update to show a **"Join Simulation"** button.
- Click join, and your screen will sync perfectly with the live match. All your predictions, reactions, and chat messages will be broadcasted to the entire connected audience!

---

## 🚀 Setup & Installation

If you are cloning this repository, you must connect it to your own Firebase project:

1. Clone the repository.
2. Create a Firebase project and enable **Realtime Database** (Set rules to "Start in test mode").
3. Rename the provided `firebase-config.example.js` file to `firebase-config.js`.
4. Replace the placeholder values in `firebase-config.js` with your actual Firebase project keys.
5. Open `index.html` in your browser (or host it via Netlify/Firebase Hosting) to start playing!
