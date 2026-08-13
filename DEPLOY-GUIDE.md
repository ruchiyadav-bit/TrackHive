# TrackHive — GitHub + Render (Free) Deployment Guide

---

## PART 1: GitHub Pe Push Karna

### Step 1: GitHub Pe New Repo Banao

1. Browser: https://github.com/new
2. Repository name: `TrackHive` (already bana hai tumne)
3. README mat add karo
4. **Create repository**

### Step 2: Local Machine Se Push Karo

```bash
cd "C:\Users\dell\projects claude\kap-offer-tracker"

git add .
git commit -m "Initial commit - TrackHive"
git branch -M main
git remote add origin https://github.com/ruchiyadav-bit/TrackHive.git
git push -u origin main
```

> Agar remote already add hai toh `git remote add` wala step skip karo, seedha `git push -u origin main` karo.

---

## PART 2: Render Pe Deploy Karna (Single Service — Easy Way)

Dono backend + frontend EK hi service se chalenge. Free plan pe Redis nahi milta — koi dikkat nahi, code bina Redis ke bhi kaam karega.

### Step 3: Render Account

1. Jao: https://render.com
2. **Sign up with GitHub**

### Step 4: Web Service Banao

1. Render Dashboard → **New +** → **Web Service**
2. **Connect a repository** → `TrackHive` repo select karo
3. Settings:

```
Name:            trackhive
Branch:          main
Root Directory:  (blank chhodo)
Runtime:         Node
Build Command:   cd server && npm install && cd ../client && npm install && npm run build
Start Command:   cd server && node index.js
Plan:            Free
```

### Step 5: Environment Variables Set Karo

Web Service ke settings mein **Environment** tab pe jaake ye add karo:

```
NODE_ENV         = production
PORT             = 3050
MONGODB_URI      = mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET       = koi-bhi-lamba-random-string-daalo-32-char-min
ADMIN_EMAIL      = tumhara@email.com
ADMIN_PASSWORD   = tumhara-password-min-8-char
```

**MONGODB_URI kahan se milega:**
1. MongoDB Atlas → apna cluster → **Connect** button
2. **Drivers** select karo
3. Connection string copy karo
4. `<password>` ki jagah apna actual password daalo

**JWT_SECRET kaise banao:**
Kuch bhi random daalo, jaise: `mySuperSecret2024TrackHiveApp!@#xyz`

### Step 6: MongoDB Atlas Mein IP Allow Karo

**Ye step ZAROORI hai** — bina iske Render se MongoDB connect nahi hoga:

1. MongoDB Atlas → **Network Access** (left sidebar)
2. **Add IP Address** click karo
3. **Allow Access from Anywhere** click karo (ye `0.0.0.0/0` set karega)
4. **Confirm**

### Step 7: Deploy

- **Create Web Service** click karo
- 3-5 minute lagenge build hone mein
- Console mein ye dikhna chahiye:

```
MongoDB connected: ...
Redis: not configured, running without Redis (IP capping disabled)
Super admin seeded: tumhara@email.com
Server running on port 3050 in production mode
```

- Done! Tumhara app live hai: `https://trackhive.onrender.com`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| MongoDB connection failed | Atlas → Network Access → `0.0.0.0/0` allow karo |
| Login page blank / 404 on refresh | Server already handles this (`/*` → index.html) — redeploy karo |
| Super admin not seeded | Check ADMIN_EMAIL aur ADMIN_PASSWORD env vars set hain |
| Build failed | Console logs padhlo — usually npm install error hota hai |
| Site bahut slow load hota hai | Free tier pe 30-60 sec cold start normal hai — 15 min inactivity ke baad sleep hota hai |

---

## Baad Mein Code Update Kaise Karna

Jab bhi code change karo:

```bash
cd "C:\Users\dell\projects claude\kap-offer-tracker"
git add .
git commit -m "your change description"
git push
```

Render automatically detect karega aur redeploy kar dega.
