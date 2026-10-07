# Security controls

ScamBreak processes hostile and sensitive input. Security is part of its primary product behavior, not an optional deployment layer.

## Request and account protection

- Helmet headers, explicit CORS origins, request IDs, safe error envelopes and structured redacted logs.
- HttpOnly cookies with `Secure` in production and a constrained `SameSite` policy. Authentication tokens are never put in browser storage.
- short-lived access token plus revocable refresh/session record; role and permission checks on protected operations.
- request validation, payload limits, rate limiting and abuse/audit hooks.
- state-changing cookie-authenticated routes require an origin/CSRF check.

## Evidence and URL protection

- Evidence is treated as private by default and served only through authenticated, owner-authorized DTOs.
- Images are restricted by byte size and verified content type; executable and document formats are not accepted in v1. Image processing must happen in a hardened worker or library before external use.
- User-controlled URLs are parsed and normalized, never fetched by the user-facing request path. Any later fetcher must resolve DNS and reject loopback, link-local, private, multicast and reserved targets before every redirect.
- Short links and redirects are marked as needing verification; a URL is never automatically opened in the user browser.

## AI safety

The prompt boundary clearly labels evidence as untrusted data. Structured output is schema-validated, normalized, length-limited and merged as advisory observations. It cannot call tools, override application policy, read internal prompts, execute actions or change a verdict by itself.

## Operations

- Secrets exist only in environment variables or a managed secret store.
- Logs must omit raw evidence, OTPs, passwords, payment credentials, session tokens and cookies.
- Update dependencies promptly and run audits in CI.
- Admin accounts require an explicit role and should additionally require MFA at the identity provider/deployment layer.

Report a potential vulnerability privately to the deployment owner. Do not submit exploit payloads to public community reporting.
