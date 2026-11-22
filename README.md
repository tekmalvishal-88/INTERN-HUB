# InternHub

**Your skills. Your opportunities. Your career.**

InternHub is a full-stack internship, hackathon, faculty approval, and career guidance platform for **Learners (Students)**, **Faculty Coordinators**, and **Organizers (Companies & Recruiters)** — ready to unzip and deploy locally on Windows, macOS, Linux, Docker, or mobile LAN.

---

## Option 1: One-Click Local Deploy (Recommended from ZIP)

Unzip the downloaded folder, open a terminal inside it, and run:

- **Windows**: Double-click `start-local.bat` (or run `start-local.bat` in Command Prompt / PowerShell)
- **macOS / Linux**:
  ```bash
  bash start-local.sh
  ```

The script automatically:
1. Creates `.env` from `.env.example` if missing
2. Installs dependencies (`npm install`)
3. Compiles the production bundle (`npm run build`)
4. Launches InternHub at **`http://localhost:3000`** (and prints your Wi-Fi LAN URL so you can open it from your phone)

---

## Option 2: Manual Local Terminal Deploy

Requires **Node.js 20+** (Node 22+ recommended):

```bash
# 1. Install packages
npm install

# 2. Create your local environment file and add your Gemini key (optional)
cp .env.example .env

# 3. Build the frontend + PWA assets
npm run build

# 4. Start the local production server (cross-platform)
npm run start:local
```

> Want live development reload while editing code? Run `npm run dev` instead of `npm run start:local`.

### Environment Variables (`.env`)
- `GEMINI_API_KEY` — Enables the **AI & Calm Voice Assistant** and **AI Smart Picker**. All dashboards, 164+ opportunities, Kanban tracker, multi-resume vault, faculty digital signatures, and student schedules work offline/locally even before adding a key.
- `PORT` — Optional server port (defaults to `3000`).

---

## Option 3: Local Docker Deploy

```bash
docker build -t internhub .
docker run -d -p 3000:3000 --env-file .env --name internhub-app internhub
```

Then open **`http://localhost:3000`**.

---

## Mobile / Android App & APK Setup

InternHub includes a complete Progressive Web App (`manifest.webmanifest`, Workbox Service Worker, standalone display, and mobile bottom navigation):

- **Direct Phone Install (LAN or HTTPS)**: Open InternHub on your phone browser, tap **App / APK** (or **Install App**) in the top-right header, or use Chrome **⋮ → Add to Home screen / Install App**.
- **Export Android `.apk`**:
  1. Deploy InternHub locally or to a URL and open **App / APK → Package .APK on PWABuilder**, **or**
  2. Package locally from this folder via Capacitor:
     ```bash
     npm run build
     npm install @capacitor/core @capacitor/cli @capacitor/android
     npx cap init InternHub app.internhub.career --web-dir=dist
     npx cap add android && npx cap sync android && npx cap open android
     ```
     Then build the `.apk` in Android Studio (**Build → Build APK(s)**).

---

## Key Features
- **Top-Corner Role & Faculty View Switcher**: Switch instantly between **Student**, **Faculty View**, and **Organizer** from the top-right header without signing out.
- **Faculty Portal**: Digital `<canvas>` signature pad for student internship/OD leave approvals, student roster with daily internship timings & event dates, and monthly events calendar.
- **Urgency Color-Coded Deadline Calendar**: Red (`< 3 days`), Orange (`1–2 weeks`), Green (`> 2 weeks`).
- **Opportunity Hub (164+ Real Listings) + AI Smart Picker**: Filter by domain, mode, stipend, skills, and exam clashes.
- **My Applications + Multi-Resume Vault + Faculty Leave Passes**: Store 3+ tailored resumes, track stages across Kanban & Timeline, and submit leave requests directly to faculty.
- **Calm, Friendly AI & Voice Assistant**: Powered by `gemini-3.1-flash-lite` with gentle conversational voice selection, microphone input, and ~5s voice playback.
