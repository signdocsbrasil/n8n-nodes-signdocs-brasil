# Changelog

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
