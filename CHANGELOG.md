# Changelog

## 0.3.0 — 2026-04-23

- **Owner Email / Owner Name** fields added to Additional Fields on both `Signing Session > Create` and `Envelope > Create`. When set, SignDocs Brasil automatically emails the signer an invitation to sign (if their email differs from the owner's) and notifies the owner by email as each signer completes. Omit the fields to keep the traditional "deliver the signing URL yourself and poll/webhook for completion" behavior.
- **Expanded webhook event catalog** on the Trigger node and `Webhook > Register`: added the 10 events the API emits that were previously missing from the multi-select — `TRANSACTION.FALLBACK`, `TRANSACTION.DEADLINE_APPROACHING` (NT65), `STEP.PURPOSE_DISCLOSURE_SENT` (NT65), `SIGNING_SESSION.{CREATED,COMPLETED,CANCELLED,EXPIRED}`, `ENVELOPE.ALL_SIGNED`, `QUOTA.WARNING`, `API.DEPRECATION_NOTICE`. Events tagged `[NT65]` are only emitted for tenants with `nt65ComplianceEnabled` (INSS consignado flow).
- **Fix:** `Webhook > List` now returns a bare `Webhook[]` array instead of the raw `{webhooks, count}` envelope. Downstream n8n nodes that iterate over the list output used to trip on the object shape; they now work as expected.

## 0.2.4 — 2026-04-18

- Metadata-only: update package `author.email` to `administrativo@signdocs.com.br` so it matches the n8n Creator Portal account for the verification application.

## 0.2.3 — 2026-04-18

- No functional changes. First successful release published via GitHub Actions with npm provenance — required for verified community-node submissions after 2026-05-01.
- Fix CI: `npm ci --ignore-scripts` avoids a native-compile failure in `isolated-vm` (transitive dev dep of `n8n-workflow`) on Node 20+.

## 0.2.2 — 2026-04-18 (skipped)

- Tagged but GitHub Actions workflow run failed at `npm ci` due to `isolated-vm` native compile error. No npm release.

## 0.2.1 — 2026-04-18

- Remove `Wait for Completion` operation on Signing Session to comply with n8n community-node verification rules (no `setTimeout` in-process polling). Use the `SignDocs Brasil Trigger` node for completion events instead, or chain a `Wait` + `Get Status` manually.

## 0.2.0 — 2026-04-18

- Drop dependency on `@signdocs-brasil/api` SDK. HTTP, OAuth2 token exchange, ECDSA (ES256) JWT signing, and webhook HMAC verification are now inlined using only `n8n-workflow` and `node:crypto`. Enables verified community-node eligibility on n8n Cloud.
- Move OAuth2 token exchange into credential `preAuthentication` hook. API calls now use `httpRequestWithAuthentication` — no manual `Authorization: Bearer` headers anywhere in the node code.
- English-only interface and metadata (required for verification): `Staging (HML)` replaces `Homologação (HML)`, package description and keywords translated.

## 0.1.0 — 2026-04-18

- Initial release. Action node with Signing Session, Envelope, Document, Evidence, Webhook resources (15 operations). Trigger node with HMAC-SHA256 signature verification and auto register/delete lifecycle. OAuth2 `client_credentials` credentials supporting both client secret and ES256 private-key JWT.
