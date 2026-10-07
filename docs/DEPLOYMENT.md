# Deployment guide

## Required environment

Configure `NODE_ENV=production`, a MongoDB Atlas connection string, a long random JWT secret, a distinct refresh/session secret, an HTTPS application URL, and a comma-separated allowlist of browser origins. Copy the API `.env.example`; do not deploy its placeholder values.

## Production checklist

- Serve the web app and API over HTTPS only.
- Configure a reverse proxy to pass the real client IP safely and set `TRUST_PROXY` appropriately.
- Use MongoDB Atlas network restrictions, encryption at rest, backups and least-privilege database credentials.
- Use a private object store with server-side encryption for future evidence uploads; do not make uploads public.
- Set `RETENTION_ENFORCEMENT_ENABLED=true` only after approving the retention policy. One API instance (or a designated maintenance worker) should run the privacy maintenance sweep; it removes expired unattached upload bytes before deleting metadata and applies each account's analysis retention period.
- Set external providers only when vetted and configured. An unavailable provider must remain visibly unavailable.
- Run `npm ci`, `npm run build`, `npm test`, and dependency vulnerability scanning in CI.
- Monitor `/healthz` for liveness and `/readyz` for database readiness.
- Rotate secrets and revoke compromised sessions through the configured session store.

## Simple v1 topology

One Node API process and one static web deployment are sufficient initially. A managed MongoDB cluster is the only required stateful dependency. Add a queue/worker only when image processing, retention jobs, or external reputation lookups require asynchronous execution at scale.
