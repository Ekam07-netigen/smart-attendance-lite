# Smart Attendance Lite (University-style Prototype)

This is an **offline-first attendance system** designed to replace slow roll-calls.

## What it does

- **Teacher PIN mode** (protected actions)
- **Multiple courses/subjects**
- Teacher creates a session → **6-digit code + QR**
- **Geo-fence** (optional): requires students to be near the classroom location
- **Roster upload** (`roll,name`) to validate roll numbers
- **Reports**: export session CSV + course attendance % / defaulter list CSV
- Optional **Google Sheets sync** via a Web App webhook

> Data is stored in the browser (localStorage). For full university rollout, add a real backend + logins.

## How to run

### Option A: Open directly
Open `index.html` in a browser.

### Option B: Local server (recommended)
```bash
python -m http.server 8000
```
Then open: `http://localhost:8000`

## How to demo (2 minutes)

1. In **Teacher Mode**, set a new PIN and unlock.
2. Add a **course** and (optionally) import a roster CSV (`roll,name`).
3. Click **Create session** → show QR + code on screen.
4. Student: enter roll + code → allow location → check-in.
5. Export CSV + export course report (defaulter list).

## Google Sheets Sync (optional)

This needs a Google Apps Script Web App URL. Basic steps:

1. Create a Google Sheet (e.g., “Attendance”).
2. Open **Extensions → Apps Script** and create a Web App that accepts POST JSON and appends rows.
3. Deploy as **Web App** (Execute as: you, Access: anyone with the link).
4. Paste the Web App URL into **Google Sheets Sync → Webhook URL** and click Save.

The app will POST fields like: roll, name, courseName, subject, sessionCode, sessionName, timestampIso, distanceM.

## Next upgrades (real deployment)

- Proper student login (college email) + OTP
- Central database (Supabase/Firebase) + teacher/admin roles
- Camera-based QR scanning inside the app
- Timetable integration + automatic session scheduling
