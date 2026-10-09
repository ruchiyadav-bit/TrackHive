# Developer Notes — Deployment & Maintenance

Deployment runbook for the self-hosted server. Read this before touching the
live server. For what the product *does*, see PROJECT.md.

Last updated: 2026-10-01

---

## Server at a glance

| | |
|---|---|
| Host | `5.161.98.12` — Ubuntu 24.04 |
| Panel | ServerAvatar |
| App directory | `/home/hXSnp3qglVV4bVzL/everflow/public_html` |
| Port | `3050` |
| Process manager | PM2, process name `trackhive`, **fork mode** |
| Domain | `https://trackgrowth.ilaunchigo.com` |
| Database | Local MongoDB, database name **`trackhive`** |
| Nginx (443) | `/etc/nginx/sites-available/everflow-ssl.conf` |
| Nginx (80) | `/etc/nginx/sites-available/everflow.conf` |
| Nginx backups | `/root/everflow-ssl.conf.backup`, `/root/everflow.conf.backup` |

`everflow.adslaunchigo.com` still points at the **old Render deployment**
(`216.24.57.x`). It has not been migrated. See "Cutover" below.

---

## Updating after a code change

Always over SSH. **Never use the ServerAvatar Deploy button** — see Warnings.

### Full update

```bash
cd /home/hXSnp3qglVV4bVzL/everflow/public_html
git pull
(cd server && npm install)
(cd client && NODE_ENV=development npm install && npm run build)
chown -R hXSnp3qglVV4bVzL:hXSnp3qglVV4bVzL .
pm2 restart trackhive
curl http://127.0.0.1:3050/api/health
```

Or just run the saved script:

```bash
bash /root/deploy-everflow.sh
```

### Shortcuts

| Changed | Command | Restart needed? |
|---|---|---|
| Frontend only (React, CSS, pages) | `git pull && (cd client && npm run build)` | **No** — Express reads `client/dist` from disk on every request |
| Backend only (server code) | `git pull && pm2 restart trackhive` | Yes, but no build |
| `.env` only | `pm2 restart trackhive` | Yes — env vars are read only at process start |

### Why the subshell parentheses matter

`(cd server && npm install) && (cd client && ...)` — the parentheses run each
`cd` in a subshell so the working directory returns to the repo root. Without
them the shell ends up inside `client/` and the next `cd client` fails.

### Why `NODE_ENV=development` on the client install

`vite` lives in `devDependencies`. If the deploy shell has
`NODE_ENV=production`, npm skips devDependencies and the build dies with
`vite: not found`. Alternative: `npm install --include=dev`.

---

## Health checks

```bash
# Is the app running and connected to Mongo?
curl -s http://127.0.0.1:3050/api/health

# Is nginx still proxying (not serving static files)?
curl -sk -H "Host: trackgrowth.ilaunchigo.com" https://127.0.0.1/api/health

# Is the nginx proxy config still intact? Should print 2.
grep -c proxy_pass /etc/nginx/sites-available/everflow-ssl.conf

# Process state
pm2 list
pm2 logs trackhive --lines 30 --nostream
```

A healthy response looks like:

```json
{"status":"ok","uptime":123,"mongo":"connected","commit":"unknown"}
```

`"mongo":"connected"` is the important part. `"commit":"unknown"` is normal
here — that field is only populated on Render.

---

## Warnings

### Do not press Deploy in the ServerAvatar panel

This application was created in **Static** mode, then fixed by hand. The panel
does not know the Node process exists. Pressing Deploy (or changing domain,
webroot, rendering type, or SSL from the panel) will **regenerate the nginx
config back to static serving** and take the site down — the homepage will
still load but every `/api`, `/click`, `/postback` and `/go` route will 404.

Recovery:

```bash
cp /root/everflow-ssl.conf.backup /etc/nginx/sites-available/everflow-ssl.conf
systemctl reload nginx
pm2 restart trackhive
```

These are safe and never touch nginx: `git pull`, `npm install`,
`npm run build`, `pm2 restart`, server reboot.

### The static-mode symptom

If the homepage loads but everything else 404s, nginx is serving files instead
of proxying. Check `grep -c proxy_pass` above.

---

## Gotchas found during deployment

**`dbName` is hardcoded.** `server/config/db.js` passes
`dbName: 'trackhive'` to `mongoose.connect()`, which **overrides the database
name in `MONGODB_URI`**. Whatever database you name in the connection string is
ignored. The database must be called `trackhive`, or that line must be removed.

Better fix (do this properly some day — commit it to GitHub, not just on the
server, or the next `git pull` reverts it):

```js
const conn = await mongoose.connect(uri, {
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
});
```

**PM2 cluster mode did not bind the port.** Started in cluster mode, PM2
reported `online` while nothing listened on 3050. Fork mode works. Start with
`pm2 start server/index.js --name trackhive`, not the ecosystem file.

**`NODE_ENV` must be `production`.** The static-serving block in
`server/index.js` is wrapped in `if (process.env.NODE_ENV === 'production')`.
In development mode the API runs but no frontend is served — a blank site with
no error anywhere.

**`.env` lives at the repo root**, loaded by `server/index.js` line 1 via
`dotenv`. It is gitignored, so it never arrives from GitHub. ServerAvatar's
panel variables are written into this file.

**`PORT=` may be empty.** Harmless — `process.env.PORT || 3050` falls back to
3050 because an empty string is falsy.

**Unused variables.** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`,
`POSTBACK_SECRET`, `ADMIN_NAME` appear in `.env.example` but are referenced
nowhere in the code. `.env.example` is out of date — do not use it as the list
of what to configure.

**Everyone is flagged as VPN behind Cloudflare.** `detectVpn()` flags any
request whose `x-forwarded-for` contains a comma, and Cloudflare always adds
one. VPN only sets a flag and never blocks, so traffic is unaffected — but the
`isVpn` field is meaningless in this deployment. (PROJECT.md Known Limitation #5.)

---

## Cloudflare

The domain is proxied through Cloudflare. Two settings matter:

1. **SSL/TLS mode must be `Full`.** `Flexible` breaks the dashboard's secure
   cookies. `Full (strict)` requires a valid (non-self-signed) origin
   certificate — that produces error 526 if the cert was never issued.
2. **Disable caching** for `/api/*`, `/click*`, `/postback*`, `/go/*` via a
   cache rule. A cached redirect serves one visitor's `click_id` to everybody
   and silently corrupts attribution.

Issuing a Let's Encrypt certificate while the orange cloud is on will fail —
the HTTP validation request never reaches the server. Temporarily set the DNS
record to **DNS only (grey cloud)**, issue the certificate, then turn the
proxy back on.

---

## Still outstanding

- [ ] `pm2 startup systemd` — **without this the app does not come back after a
      server reboot.** Run it, then run the command it prints, then `pm2 save`.
- [ ] Cloudflare cache rules for the tracking paths (above)
- [ ] Scheduled database backups — this is now self-hosted MongoDB, so
      **nothing is backing it up**
- [ ] Port 80 vhost still serves static; should redirect to HTTPS
- [ ] Second application (`redtrack` / KAP Tracker) — created in SSR mode,
      SSL 526 to resolve, and it needs `npm run seed` once or there is no login

---

## Cutover to everflow.adslaunchigo.com

Not done. The live tracking domain is still on Render. When moving it:

1. Lower the DNS TTL to 300s and wait for the old TTL to expire
2. Delete the CNAME (a CNAME and an A record cannot coexist), add
   `A → 5.161.98.12`
3. Issue SSL immediately — between the DNS switch and the certificate, every
   HTTPS postback fails
4. Keep Render running 24–48h as a rollback path

**The database was started fresh**, so offer IDs and advertiser postback
secrets on this server are different from Render's. Existing tracking links
will not resolve and advertisers will need re-registered postback URLs — unless
the Render data is migrated first with `mongodump` / `mongorestore`.

---

## Second application — redtrack / KAP Tracker

Different codebase, different conventions. Do not copy TrackHive's values.

| | |
|---|---|
| App directory | `/home/UUwuxvP9K7eB0Xch/redtrack-tracking/public_html` |
| Port | `3010` |
| Start command | `npm run serve` (**not** `npm start` — that runs PM2 inside PM2) |
| Install | `npm run install:all` |
| Build | `npm run build` |
| Database | `kaptracker` |
| Env var names | `MONGO_URI` and `BASE_URL` — **not** `MONGODB_URI` / `CLIENT_URL` |
| Health endpoint | `/health` — **not** `/api/health` |
| Seeding | `npm run seed`, once, or there is no admin user |

No hardcoded `dbName` in this app — the connection string's database name is
honoured.
