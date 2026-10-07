# Architecture

ScamBreak is intentionally a modular monolith. Its modules have bounded responsibilities and communicate through typed service interfaces rather than a network hop for every operation.

```text
Browser
  -> React workspace / result / incident flows
  -> Express API (authentication, authorization, validation, request context)
      -> Evidence and analysis orchestration
          -> extraction -> deterministic signals -> pattern matching -> risk scoring
          -> URL parsing / provider abstraction
          -> optional AI structured-output provider
      -> persistence (MongoDB)
      -> optional storage, notification, intelligence providers
```

## Trust boundaries

1. **Untrusted evidence:** all submitted content, including text apparently addressed to the model and extracted OCR text, is data only.
2. **Application boundary:** request schemas, payload limits, authorization, anti-abuse controls and serialization allowlists are applied before and after business logic.
3. **Provider boundary:** AI, intelligence, DNS/reputation and object-storage providers are replaceable; their output is validated and cannot perform privileged actions.
4. **Presentation boundary:** private evidence and internal signals are never returned by a public identifier alone.

## Core analysis pipeline

`submit -> normalize evidence -> extract entities -> evaluate independent signals -> match taxonomy -> deterministic score -> explanations -> verification guidance -> action plan`

Risk and confidence answer different questions. Risk is a configurable policy score based on findings; confidence communicates how much usable evidence supports those findings. Neither is a guarantee or a calibrated fraud probability.

## Persistence strategy

The data model separates user/account records, analyses, evidence metadata/content references, normalized entities, findings and assessments. Private content is protected by ownership checks and response DTOs. Community intelligence is opt-in, redacted, moderated, and separate from an analysis. Shared identifiers may later create relationship edges for campaign clustering without exposing private evidence.

## Extension points

- AI providers emit schema-validated structured observations only.
- URL and threat-intelligence providers return explicit `available`, `unavailable`, or `unknown` states.
- trusted-entity sources are versioned and have a `lastVerifiedAt` field.
- pattern definitions are data, not route-handler conditionals.
- event/audit utilities can route to a durable queue later without changing the analysis API.
