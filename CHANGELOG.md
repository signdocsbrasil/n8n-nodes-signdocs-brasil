# Changelog

## 0.6.0 — 2026-08-20

**npm went straight from 0.4.0 to this release.** 0.5.0 and 0.5.1 were tagged and built but never
reached the registry — the publish workflow's `NPM_TOKEN` had expired and the failure showed up
only as a red check on a tag push. So installing 0.6.0 also brings everything listed under 0.5.0
and 0.5.1 below.

### Fixed

- **The Trigger could no longer be re-activated once its registration was lost.** The API now
  refuses to register a webhook URL it already holds, so that a re-clicked or retried registration
  cannot permanently double a tenant's inbound event volume. The Trigger registered blindly on
  every activation and only ever consulted n8n's own static data to decide whether it had one
  already — so re-importing a workflow, moving it between instances, or a cleanup that failed
  server-side left a row on the tenant with the local copy gone, and activation then failed with a
  409 and no way out from inside n8n.

  It now recognises that 409 and replaces the stale registration. The old one cannot be adopted:
  the API returns its id but never its secret, which is issued once and is what this node verifies
  incoming signatures with — adopting it would mean accepting deliveries it could not
  authenticate. The URL carries this node's own identifier, so the row being replaced is always
  this node's own. If the API declines to say which registration collided, the error now tells you
  to remove it from the dashboard rather than failing opaquely.

- **`Envelope > Add Session` accepts an Idempotency Key.** It is the call that spends quota, and
  its response carries the only copy of that signer's client secret, but it was the one create in
  the node that sent no key — so retrying a failed step added a second signer, charged again and
  sent a second invitation. Use a **different key for every signer**: the API scopes its cache by
  key and resolved path, and all signers on an envelope share that path, so one key reused across
  them returns the first signer's session — including their client secret — for all of them.

### Added

- **`Signing Session > Link`** — `POST /v1/signing-sessions/{sessionId}/link`. Issues a fresh
  signing URL for a session that is still active, without creating another transaction and
  **without spending quota**. Signing links are single-use, so this is the way to reach a signer
  whose link was consumed, lost, or never delivered — previously the only option was to cancel and
  recreate, which cost quota and invalidated the original.
  - Works for standalone and envelope sessions alike.
  - The session must be active; a completed or cancelled one returns 409, since a link to a
    finished session would authenticate nothing.
  - The returned `url` is already complete — the client secret is in the query string — so it is
    surfaced as-is under both `url` and `signingUrl`. Do not append `cs=` to it.
  - It authorises the tenant, not an end user. If your workflow serves several people from one
    SignDocs tenant, decide who is entitled to a link before minting it: the API cannot.

### Note

- `Webhook > Register` can now return 409 when the URL is already registered. The API's message
  names the existing `webhookId` and n8n surfaces it unchanged; use `Webhook > Delete` first, or
  register a different URL.

## 0.5.1 — 2026-07-12

- **Fix: Policy Profile dropdowns sent values the API rejects.** Signing Session, Envelope (Add Session) and Trust Session offered `OTP`, `CLICK_AND_OTP`, `CLICK_AND_BIOMETRIC`, `OTP_AND_BIOMETRIC`, `FULL` and `DIGITAL_CERT`, but the API's `policy.profile` only accepts `CLICK_ONLY`, `CLICK_PLUS_OTP`, `BIOMETRIC`, `BIOMETRIC_PLUS_OTP`, `DIGITAL_CERTIFICATE`, `BIOMETRIC_SERPRO`, `BIOMETRIC_SERPRO_AUTO_FALLBACK`, `BIOMETRIC_DOCUMENT_FALLBACK` and `CUSTOM` — every non-canonical choice failed with HTTP 400 "Invalid policy profile". Dropdowns now use the canonical values; `CLICK_AND_BIOMETRIC` and `FULL` were removed (no API equivalent — compose via `CUSTOM`).
- **Fix: bundled workflow templates defaulted to `policyProfile: "OTP"`** and failed on execution; all three now use `CLICK_PLUS_OTP`.
- Workflows saved with the old values keep failing until the profile is re-selected — open the node, pick the profile again, save.

## 0.5.0 — 2026-06-28

- **New resource: Trust Session (Sessão de Confiança).** Wraps `POST /v1/trust-sessions` — authenticate a digital action without a document. Operations: Create, Get Status, Cancel.
  - Use for KYC, loan disbursement approval (IN 138/2022 INSS consignado), VASP KYC reverification (Lei 14.478/2022), telemedicine consent (CFM 2.314/2022), notarial remote acts (Provimento 149/2023 CNJ), HR compliance acknowledgments, escrow release, transaction approval in ERPs/CRMs.
  - Same hosted page, same biometric/OTP/SERPRO step machine, same evidence pack format as Signing Session — the page just shows "Sessão de Confiança" badge + the human-readable action description in place of a PDF preview.
  - The form requires `Action Type` + `Action Description` (the thing being authenticated, surfaced to the signer and captured in the evidence pack), and hides all document-related fields. The `DIGITAL_CERT` profile is intentionally absent — ICP-Brasil A1 signing requires a document.
  - Requires `featureFlags.trustSessionsEnabled = true` on the tenant + a `monthlyTrustSessions` quota, both provisioned per contract by SignDocs.

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
