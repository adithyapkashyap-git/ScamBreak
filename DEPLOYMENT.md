# ScamBreak Deployment Guide

This guide details the steps to deploy the ScamBreak application to production.

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     Frontend (React + Vite)     │
│   Hosted on GitHub Pages        │
│   https://<user>.github.io/...  │
└────────────────┬────────────────┘
                 │ HTTPS (credentials: 'include')
                 ▼
┌─────────────────────────────────┐
│     Backend (Express + Node)    │
│   Hosted on Web Service         │
│   (Render, Railway, Fly.io, etc)│
└────────────────┬────────────────┘
                 │ Mongoose (TLS)
                 ▼
┌─────────────────────────────────┐
│          MongoDB Atlas          │
│   Managed Cloud Database        │
└─────────────────────────────────┘
```

- **Frontend**: Static SPA hosted on GitHub Pages with client-side routing and automated GitHub Actions builds.
- **Backend**: Containerized/Node.js web service listening on `0.0.0.0`, connected to MongoDB Atlas.
- **Database**: MongoDB Atlas cloud cluster accessed exclusively by the backend service. The frontend never receives or connects directly to MongoDB credentials.

---

## 1. Frontend Deployment (GitHub Pages)

### Automated GitHub Actions Workflow
The project includes a GitHub Actions workflow at [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml).

### Enabling GitHub Pages
1. Go to your repository on GitHub: `https://github.com/adithyapkashyap-git/ScamBreak`
2. Navigate to **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. Every push to the `main` branch will automatically trigger the build and deploy pipeline.

### Configuring the Production API URL
1. Navigate to **Settings** → **Secrets and variables** → **Actions** → **Variables**.
2. Click **New repository variable**.
3. Set the name to `VITE_API_BASE_URL`.
4. Set the value to your production backend URL (e.g., `https://scambreak-api.onrender.com`).
5. Re-run the deployment workflow to build with the backend URL.

---

## 2. Backend Deployment (Hosting Platform)

You can deploy the backend to any Node.js hosting platform (such as Render, Railway, Fly.io, AWS App Runner, or a VPS).

### Build & Start Commands
- **Root Directory**: `apps/api` (or repository root if running workspace commands)
- **Install Command**: `npm ci`
- **Build Command**: `npm run build --workspace=@scambreak/api`
- **Start Command**: `node apps/api/dist/server.js` (or `npm run start --workspace=@scambreak/api`)

### Health Check Probes
- **Liveness Probe**: `GET /healthz` (returns HTTP 200 `{ success: true, data: { status: "ok" } }`)
- **Readiness Probe**: `GET /readyz` (verifies active MongoDB connection, returns HTTP 200 when ready, HTTP 503 if connecting)

---

## 3. Environment Variables

### Backend Production Environment Variables

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Production mode | `production` |
| `HOST` | Interface to bind to | `0.0.0.0` |
| `PORT` | Listening port (often provided by host) | `4000` or `$PORT` |
| `APP_URL` | Public frontend URL | `https://adithyapkashyap-git.github.io/ScamBreak` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/scambreak?retryWrites=true&w=majority` |
| `AUTH_JWT_SECRET` | Secret for signing session JWTs (≥ 32 random chars) | *Generate random 64-char string* |
| `COOKIE_SIGNING_SECRET` | Secret for signing cookies (≥ 32 random chars) | *Generate random 64-char string* |
| `ENTITY_HASH_PEPPER` | Salt for hashing sensitive entities (≥ 32 random chars) | *Generate random 64-char string* |
| `CORS_ORIGINS` | Allowed frontend origin(s) | `https://adithyapkashyap-git.github.io` |
| `COOKIE_SAMESITE` | SameSite mode for cross-site cookies | `none` |
| `TRUST_PROXY` | Set true if behind reverse proxy/load balancer | `true` |

> [!TIP]
> Generate cryptographic secrets locally in your terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Frontend Environment Variables (GitHub Actions / Build Time)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Production backend API endpoint | `https://scambreak-api.onrender.com` |
| `VITE_BASE_PATH` | Base path for GitHub Pages | `/ScamBreak/` (default in workflow) |

---

## 4. MongoDB Atlas Configuration

1. In the [MongoDB Atlas Dashboard](https://cloud.mongodb.com/):
   - Create a database cluster.
   - Under **Database Access**, create a dedicated database user with `readWrite` access to the `scambreak` database.
   - Under **Network Access**, add the IP address of your backend host, or choose **Allow Access from Anywhere** (`0.0.0.0/0`) if using a platform with dynamic egress IPs (like Render or Railway).
2. Copy the SRV connection string into the backend's `MONGODB_URI` environment variable.

---

## 5. Security & Cross-Origin Cookies

Because the frontend (`https://adithyapkashyap-git.github.io`) and backend (e.g. `https://scambreak-api.onrender.com`) are on different domains:
1. **Credentials & CORS**: The API requires `credentials: true` and explicitly whitelisted origins in `CORS_ORIGINS`. Wildcards (`*`) are disallowed.
2. **Cross-Site Cookies**: For browsers to attach session cookies to cross-origin requests, cookies must have `SameSite=None` and `Secure=true`. Set `COOKIE_SAMESITE=none` in production.
3. **Double-Submit CSRF**: The API issues a CSRF token upon request which the frontend attaches via the `X-CSRF-Token` header for all state-changing requests.

---

## 6. Deployment Troubleshooting

### 1. `CORS_ORIGIN_DENIED` (HTTP 403)
- Verify `CORS_ORIGINS` in your backend environment contains the exact protocol and origin of your frontend: `https://adithyapkashyap-git.github.io` (no trailing slash).

### 2. Session Cookie Not Persisting / Login Loop
- Ensure your backend uses `HTTPS`. Modern browsers will silently reject `SameSite=None` cookies over plain HTTP.
- Confirm `COOKIE_SAMESITE=none` is set on the backend.
- If deployed behind a reverse proxy (e.g., Render/Railway/Heroku), ensure `TRUST_PROXY=true` so Express recognizes the connection as secure HTTPS.

### 3. Page Refresh Returns 404 on GitHub Pages
- GitHub Pages is a static host. The repository includes [apps/web/public/404.html](./apps/web/public/404.html) and a redirect restore script in [`apps/web/index.html`](./apps/web/index.html) to handle deep links and direct page reloads cleanly.
