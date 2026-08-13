# TrackHive — GitHub + Render Deployment Guide

---

## PART 1: GitHub Pe Push Karna

### Step 1: GitHub Pe New Repo Banao

1. Browser mein jao: https://github.com/new
2. Repository name: `trackhive`
3. Private ya Public — jo chahiye select karo
4. README mat add karo (already code hai)
5. **Create repository** click karo
6. Page pe jo URL aaye wo copy karo, kuch aisa hoga:
   ```
   https://github.com/TUMHARA-USERNAME/trackhive.git
   ```

### Step 2: Local Machine Pe Git Init Karo

Terminal (CMD / PowerShell / Git Bash) kholo aur ye commands run karo:

```bash
cd "C:\Users\dell\projects claude\kap-offer-tracker"

git init
git add .
git commit -m "Initial commit - TrackHive"
git branch -M main
git remote add origin https://github.com/TUMHARA-USERNAME/trackhive.git
git push -u origin main
```

> **Note:** `TUMHARA-USERNAME` ki jagah apna GitHub username daalo.

Agar GitHub credentials maange toh:
- Username = GitHub username
- Password = Personal Access Token (GitHub Settings → Developer Settings → Personal Access Tokens → Generate New Token, `repo` scope select karo)

---

## PART 2: Render Pe Redis Add Karna

Redis pehle banana padega kyunki backend ko iski zaroorat hai start hone ke liye.

### Step 3: Render Account Banao

1. Jao: https://render.com
2. **Sign up with GitHub** — GitHub se connect karo
3. Dashboard pe aa jaoge

### Step 4: Redis Instance Banao

1. Render Dashboard pe **New +** click karo → **Redis**
2. Settings:
   - **Name:** `trackhive-redis`
   - **Region:** Oregon (US West) — ya jo tumhe paas lage
   - **Plan:** Free (ya Starter agar free nahi dikhta)
3. **Create Redis** click karo
4. Create hone ke baad page pe ye dikhega:
   - **Internal Redis URL** — ye copy karo, kuch aisa hoga:
     ```
     redis://red-xxxxxxxxxxxxx:6379
     ```
   - **External Redis URL** — ye bhi note karo (testing ke liye)

> **Important:** Internal URL use karenge kyunki backend aur Redis dono Render pe honge.

---

## PART 3: Backend Deploy Karna (Web Service)

### Step 5: Backend Web Service Banao

1. Render Dashboard → **New +** → **Web Service**
2. **Connect a repository** — apna `trackhive` repo select karo
3. Settings fill karo:

| Setting | Value |
|---------|-------|
| **Name** | `trackhive-api` |
| **Region** | Same as Redis (Oregon) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Plan** | Free (ya jo chahiye) |

4. **Environment Variables** section mein ye add karo (ek ek karke):

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3050` |
| `MONGODB_URI` | `tumhara-mongodb-atlas-connection-string` |
| `JWT_SECRET` | `koi-bhi-lamba-random-string-daalo-idhar` |
| `ADMIN_EMAIL` | `tumhara@email.com` |
| `ADMIN_PASSWORD` | `tumhara-password` (min 8 chars) |
| `CLIENT_URL` | `https://trackhive-web.onrender.com` |
| `REDIS_HOST` | (neeche dekho) |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | (neeche dekho) |

**Redis values kaise nikalein:**

Tumhara Internal Redis URL kuch aisa hoga:
```
redis://red-abc123xyz:6379
```
ya password wala:
```
redis://default:PASSWORD@red-abc123xyz:6379
```

Isme se:
- `REDIS_HOST` = `red-abc123xyz` (hostname part)
- `REDIS_PORT` = `6379`
- `REDIS_PASSWORD` = `PASSWORD` (agar hai toh, nahi toh blank chhodo)

> Redis ke dashboard pe jaake "Internal Redis URL" se ye values easily mil jaayengi.

5. **Create Web Service** click karo

Deploy hone mein 2-3 minute lagenge. Console mein dekhna:
```
MongoDB connected: ...
Redis connected
Super admin seeded: tumhara@email.com
Server running on port 3050 in production mode
```

---

## PART 4: Frontend Deploy Karna (Static Site)

### Step 6: Frontend Static Site Banao

1. Render Dashboard → **New +** → **Static Site**
2. Same `trackhive` repo select karo
3. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `trackhive-web` |
| **Branch** | `main` |
| **Root Directory** | `client` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

4. **Environment Variables** add karo:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://trackhive-api.onrender.com` |

5. **Create Static Site** click karo

### Step 7: Frontend API Client Update Karo

Ye step ZAROORI hai — abhi frontend `/api` pe call karta hai jo sirf dev proxy mein kaam karta hai. Production mein backend alag URL pe hai.

Apne local code mein ye file edit karo:

**File:** `client/src/api/client.js`

Puraana code:
```js
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});
```

Naya code:
```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  headers: { 'Content-Type': 'application/json' },
});
```

Phir push karo:
```bash
cd "C:\Users\dell\projects claude\kap-offer-tracker"
git add .
git commit -m "Add production API URL support"
git push
```

Render automatically re-deploy karega dono services ko.

### Step 8: Rewrite Rules Add Karo (React Router ke liye)

Static site mein React Router kaam kare iske liye:

1. `client` folder mein ek file banao: `public/_redirects`
   ```
   /*    /index.html   200
   ```

Ya Render dashboard pe:
1. Static Site settings → **Redirects/Rewrites**
2. Add rule:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`
3. Save karo

---

## PART 5: Backend Ko Full-Stack Serve Karna (ALTERNATIVE — Easier)

**Agar tum dono ko ek hi service se chalana chahte ho** (recommended — simpler, no CORS issues):

### Step A: Server ko frontend bhi serve karne do

Server mein ye already hai (`server/index.js` line 105-110):
```js
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}
```

### Step B: Single Web Service Banao

1. Render Dashboard → **New +** → **Web Service**
2. Settings:

| Setting | Value |
|---------|-------|
| **Name** | `trackhive` |
| **Root Directory** | *(blank — root of repo)* |
| **Build Command** | `cd server && npm install && cd ../client && npm install && npm run build` |
| **Start Command** | `cd server && node index.js` |
| **Plan** | Free ya Starter |

3. Environment Variables — same as Step 5 (but `CLIENT_URL` nahi chahiye)

4. Isme frontend ka `client/src/api/client.js` change karne ki zaroorat NAHI — `/api` as-is kaam karega.

Ye approach simple hai — ek URL, no CORS, no separate static site.

---

## SUMMARY — Kya Karna Hai

```
1. GitHub pe repo banao → code push karo
2. Render pe Redis banao → Internal URL note karo
3. Option A (Easy): Single Web Service banao — backend + frontend ek mein
   Option B (Separate): Backend Web Service + Frontend Static Site
4. Environment variables set karo
5. Deploy ho jaayega automatically
```

## Live URLs

Deploy ke baad:

- **Single service:** `https://trackhive.onrender.com`
- **Separate services:**
  - Backend: `https://trackhive-api.onrender.com`
  - Frontend: `https://trackhive-web.onrender.com`

## Troubleshooting

- **"MongoDB connection failed"** → Atlas mein Network Access pe jaake `0.0.0.0/0` allow karo (Render ka IP fixed nahi hota)
- **"Redis error"** → Check karo Redis host/port/password sahi hai, aur same region mein hai
- **Login page blank** → Rewrites check karo (Step 8)
- **API calls fail** → CORS: backend ke `CLIENT_URL` env var mein frontend ka exact URL daalo
- **Free tier slow** → Pehli baar 30-60 sec lagta hai cold start mein (normal hai)
