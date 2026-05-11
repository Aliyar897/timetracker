# ⏱️ Time Tracker (Offline‑First PWA)

A full‑stack **offline‑first time tracking application** built to solve a real problem:  
accurately tracking work hours during shift-based jobs — even without internet access.

This project is especially useful for people working **irregular shifts (UK-based roles or similar environments)** where reliable time tracking is essential.

---

## 🚀 Live Demo

👉 https://timetrakker.pythonanywhere.com

---

## 💡 Problem I Solved

While working shifts, I found it difficult to:
- Track work hours consistently
- Record time when offline
- Calculate earnings accurately
- Sync data across multiple devices

So I built a solution that works **offline-first**, then syncs automatically.

---

## ⚙️ Key Features

### ✅ Offline‑First Architecture
- Works without internet using **IndexedDB**
- Users can add/edit entries anytime

### ✅ Automatic Sync System
- Local entries are synced to the backend when online
- No manual intervention required

### ✅ Multi‑Device Consistency
- Add entries on mobile → view on laptop
- Server acts as **source of truth**

### ✅ Progressive Web App (PWA)
- Installable on mobile & desktop
- Works like a native app
- Supports offline usage

### ✅ Earnings Calculation
- Based on user-defined hourly rate
- Updates dynamically with filtered data

### ✅ Date Range Filtering
- Filter entries by start & end date
- Summary cards update based on filtered results

### ✅ Secure Authentication
- Django authentication system
- Password hashing (not stored in plaintext)

---

## 🛠️ Tech Stack

### Backend
- Django
- Django REST Framework

### Frontend
- Vanilla JavaScript
- Service Workers (PWA)
- IndexedDB (offline storage)

### Database
- PostgreSQL (production - Render / PythonAnywhere)
- SQLite (local development)

### Deployment
- Render / PythonAnywhere

---

## 🧠 Architecture Overview