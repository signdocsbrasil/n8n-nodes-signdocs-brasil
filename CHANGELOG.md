# Changelog

## 0.4.0 — 2026-04-27

- **Webhook event catalog: added the two missing envelope events.** The Trigger node and `Webhook > Register` now expose `ENVELOPE.CREATED` (fires when a multi-signer envelope is created) and `ENVELOPE.EXPIRED` (fires when an envelope expires with one or more pending signatures). `ENVELOPE.ALL_SIGNED` was already in the list; with these two added, the n8n node now mirrors the full canonical `WebhookEventType` enum the API emits.
  - `ENVELOPE.EXPIRED` is brand new behavior shipped today: when every signer in an envelope expires without signing, the API now flips the envelope status to `EXPIRED` and fires this event. Previously envelopes stayed in `ACTIVE` indefinitely with all signers dead. Pair `ENVELOPE.ALL_SIGNED` (success) and `ENVELOPE.EXPIRED` (failure) as the two terminal states for any envelope-driven workflow.
  - `ENVELOPE.CREATED` was already being emitted by the API but missing from the n8n picker.
- No changes to node code, credentials, or templates.

## 0.3.1 — 2026-04-25

- **Templates fix:** all three workflow templates (`contrato-google-docs.json`, `link-assinatura-whatsapp-telegram.json`, `pipeline-imobiliario.json`) failed to execute in n8n because of invalid SignDocs node parameter values. Verified by importing each template into a clean n8n 2.17.7 instance with the community node loaded — every template raised `WorkflowHasIssuesError` before this release.
  - Replace `purpose: "SIGN_DOCUMENT"` with `"DOCUMENT_SIGNATURE"` (the only document-signing value the node accepts; `ACTION_AUTHENTICATION` is the other valid option).
  - Replace `policyProfile: "OTP_EMAIL"` / `"OTP_SMS"` with `"OTP"` plus `additionalFields.otpChannel: "email"` or `"sms"`. The node's policy enum is `CLICK_ONLY`, `OTP`, `BIOMETRIC`, `CLICK_AND_OTP`, `CLICK_AND_BIOMETRIC`, `OTP_AND_BIOMETRIC`, `FULL`, `DIGITAL_CERT`, `CUSTOM`.
  - `link-assinatura-whatsapp-telegram.json`: rewrite the broken "upload-then-reference-by-id" path. The previous design used `documentSource: "url"` on `Document > Upload` and `documentSource: "id"` on `Signing Session > Create`, neither of which the node supports (Document upload requires an existing `transactionId`; session create only accepts `binary` / `base64` / `none`). New design: stock `n8n-nodes-base.httpRequest` downloads the PDF as binary, then `Signing Session > Create` consumes it via `documentSource: "binary"`.
  - `contrato-google-docs.json` and `pipeline-imobiliario.json`: fix the Google Docs node parameters — field is `title`, not `name`; pipeline-imobiliario was also missing `operation: "create"`.
- **Templates README:** correct the `policyProfile` enum, which previously listed nonexistent values (`CLICKWRAP`, `OTP_EMAIL`, `OTP_SMS`, `BIOMETRIC_FACE`).
- No changes to node code or credentials.

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
