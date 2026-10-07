# ScamBreak

ScamBreak is a privacy-first consumer safety platform for investigating suspicious digital communications. It combines deterministic scam signals, URL inspection, structured evidence extraction, explainable risk assessment, safe verification guidance, and incident-response steps. It is deliberately not a chatbot verdict generator.

## What v1 does

- accepts multiple evidence types in an analysis workspace: messages, copied emails, URLs, structured context, and images;
- extracts normalized identifiers and scam-relevant signals;
- calculates an explainable, configurable risk level without presenting it as a statistical probability;
- shows evidence-backed findings, limits, safe verification methods, and scenario-specific actions;
- supports authenticated private history, configurable deletion/retention controls, optional moderated community reports, incident response, pattern definitions, trusted entities, and admin-protected operations;
- keeps external intelligence and AI integrations behind safe provider interfaces. Local fallbacks never pretend external verification took place.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/api` | Express/Mongoose modular-monolith API, analysis engine, security controls and tests |
| `apps/web` | React + Vite responsive product interface |
| `docs` | architecture, deployment, privacy and operational guidance |

## Quick start

1. Install Node.js 20+ and MongoDB (or point to MongoDB Atlas).
2. Copy `apps/api/.env.example` to `apps/api/.env` and set strong secrets and allowed origins.
3. Run `npm install` from the repository root.
4. Run `npm run dev`.

The API defaults to port `4000` and the web app to `5173`. In production, build with `npm run build` and set `NODE_ENV=production`; secure cookies require HTTPS.

## Important safety boundary

Submitted messages, URLs, screenshots and metadata are untrusted evidence, never instructions. ScamBreak does not crawl user URLs from a request path, navigate users to them, execute uploaded files, or claim independent verification when no provider returned it. It cannot reverse a payment, recover an account, or establish that content is legitimate.

See [architecture](docs/ARCHITECTURE.md), [security controls](docs/SECURITY.md), [privacy and retention](docs/PRIVACY.md), and [deployment](docs/DEPLOYMENT.md).
