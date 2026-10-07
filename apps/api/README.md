# ScamBreak API

The API is a modular Express/Mongoose monolith. It intentionally treats submitted evidence as hostile and potentially sensitive.

## Run locally

1. Copy `.env.example` to `.env` and replace both secrets before using a non-development environment.
2. Start MongoDB (or configure `MONGODB_URI` for MongoDB Atlas).
3. From the repository root, install workspace dependencies and run the API development script.

`GET /healthz` reports process liveness. `GET /readyz` only returns success once MongoDB is connected. The API never reports an unverified organization or external reputation result as a fact.

## Security posture

- Authentication is an HttpOnly, SameSite cookie containing a signed, short-lived JWT. Browser clients must first request `GET /api/auth/csrf` and send the returned value in `X-CSRF-Token` on unsafe requests.
- Secrets only come from environment variables. Production rejects development defaults, weak secrets, non-HTTPS CORS origins, and wildcard origins.
- API response DTOs use explicit allowlists; never serialize Mongoose documents directly to clients.
- Uploaded evidence and URL fetching belong to dedicated security-boundary modules and must not be handled by generic route code.

See the repository deployment documentation for production operations.
