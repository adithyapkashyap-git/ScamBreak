# Privacy and retention

Evidence frequently contains personal messages, payment details and account information. ScamBreak stores only data required to provide the analysis selected by the user.

| Classification | Examples | Handling |
| --- | --- | --- |
| Private | uploaded screenshot, raw message, incident answers | account owner only; never public via an analysis ID |
| Restricted | extracted phone/email/payment identifier | minimized, access-controlled, redacted in logs and UI where possible |
| Internal | rule IDs, abuse signals, audit metadata | staff/service access only |
| Community | opt-in, anonymized and moderated report fields | no raw evidence; publication requires moderation |

## User control

Authenticated users can review their analysis history, delete an analysis immediately, select an account-level retention period, and turn off optional community-report prompts. Deletion removes private evidence bytes where available, scrubs stored evidence fields, removes derived analysis records, and leaves only a minimal deleted-analysis tombstone needed to prevent accidental reappearance. Minimal security/audit events may be retained for the documented compliance window without raw evidence.

## Default retention

New accounts inherit `ANALYSIS_RETENTION_DAYS` (default 90) and users can narrow or extend it within the product. The in-process privacy maintenance task always deletes expired **unattached** image-upload bytes before their staging metadata; it intentionally does not rely on a MongoDB TTL index, which could orphan a private object.

Automatic analysis deletion is controlled by `RETENTION_ENFORCEMENT_ENABLED`. Set it to `true` only after documenting the deployment’s legal basis, user notice, backups, and recovery policy. `PRIVACY_MAINTENANCE_SWEEP_HOURS` controls the bounded maintenance cadence (default 1 hour). In a horizontally scaled deployment, run this task in one designated worker or use a distributed lock. Backup retention follows the hosting provider’s documented lifecycle.

## Community intelligence

Making a report is separate from analyzing content. The report form explicitly describes which normalized, non-sensitive fields may be submitted. It does not automatically publish screenshots, message bodies, account details, personal claims or direct accusations.
