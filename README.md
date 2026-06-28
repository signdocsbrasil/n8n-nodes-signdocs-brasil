# n8n-nodes-signdocs-brasil

[![npm version](https://img.shields.io/npm/v/n8n-nodes-signdocs-brasil.svg)](https://www.npmjs.com/package/n8n-nodes-signdocs-brasil)

Community [n8n](https://n8n.io) node for [SignDocs Brasil](https://signdocs.com.br) — electronic signatures with facial biometrics, OTP, clickwrap, and **ICP-Brasil A1/A3 digital certificates**, compliant with Brazilian legislation (MP 2.200-2).

Ships one **action node** (SignDocs Brasil) and one **trigger node** (SignDocs Brasil Trigger).

## Install

### n8n Cloud / self-hosted (Settings → Community Nodes)

Paste `n8n-nodes-signdocs-brasil` into the "Install a community node" dialog.

### Manual (self-hosted)

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-signdocs-brasil
```

Restart n8n.

## Credentials

Create credentials of type **SignDocs Brasil API**:

- **Environment** — `Production` or `Staging (HML)`
- **Authentication Method** — `Client Secret` (simplest) or `Private Key JWT (ES256)`
- **Client ID** + either `Client Secret` or `Private Key (PEM)` + `Key ID (kid)`

Obtain credentials from your SignDocs tenant admin portal.

> **Note on credential test:** The "Test" button performs a real OAuth2 `client_credentials` token exchange against `/oauth2/token`. This works for the Client Secret auth mode. For Private Key JWT mode the test cannot sign the ES256 assertion declaratively and will fail — validate those credentials by running a workflow instead.

## Action node — operations

| Resource | Operations |
|----------|-----------|
| Signing Session | Create, Get Status, Cancel |
| Trust Session | Create, Get Status, Cancel |
| Envelope | Create, Get, Add Session, Combined Stamp |
| Evidence | Get |
| Document | Upload, Download |
| Webhook | Register, List, Delete, Test |

### Signing Session vs Trust Session

Use **Signing Session** when the final artefact is a signed PDF — contracts, NDAs, terms of adhesion, anything where the document is the product.

Use **Trust Session** (Sessão de Confiança, `POST /v1/trust-sessions`) when you need to authenticate an *action* without a document — KYC, loan disbursement approval, telemedicine consent capture, escrow release, identity reverification for VASPs. The action is described in the required `Action Type` + `Action Description` fields; the evidence pack carries them in place of a document hash.

The two resources share the same hosted page, the same biometric / OTP / SERPRO step machine, and the same evidence-pack format. The form differs: the Trust Session resource hides document fields, requires `actionType` + `actionDescription`, and omits the `DIGITAL_CERT` profile (ICP-Brasil A1 signing inherently requires a document).

The tenant must have `featureFlags.trustSessionsEnabled = true` and a `monthlyTrustSessions` quota provisioned by your CS contact.

### Example: send a PDF for signing

```
Google Sheets (new row) → HTTP Request (download PDF) → SignDocs Brasil (Signing Session → Create)
                                                      → Gmail (send signing URL to signer)
```

The Create operation returns:
- `sessionId`, `transactionId`, `status`
- `url`, `clientSecret`, `expiresAt` (raw API fields)
- **`signingUrl`** — the combined link your signer should open. Pre-built as `{url}?cs={encodeURIComponent(clientSecret)}`. Share this in emails, WhatsApp, Slack — it's the only URL a signer needs.

Example downstream usage: `{{$json.signingUrl}}` in a Gmail or HTTP node.

### Example: authenticate a loan disbursement (no document)

```
Database (loan ready to disburse) → SignDocs Brasil (Trust Session → Create)
                                  → WhatsApp / SMS (deliver signingUrl to beneficiary)
                                  → SignDocs Brasil Trigger (wait for TRANSACTION.COMPLETED)
                                  → Database (execute disbursement using evidenceId)
```

Trust Session → Create fields for this example:
- **Policy Profile**: `BIOMETRIC_SERPRO` (atende IN 138/2022 do INSS)
- **Action Type**: `approve_payroll_loan_disbursement`
- **Action Description**: `Aprovar liberação de empréstimo consignado #INSS-2026-007482 — R$ 8.450,00 em 60 parcelas`
- **Signer Name** / **Signer External ID** / **Signer CPF** (mandatory) + **Signer Phone** + **OTP Channel: SMS**
- **Additional Fields → Metadata**: `{"regulation":"IN-138-2022","contract_id":"INSS-2026-007482","benefit_number":"1234567890"}`

The same response shape as Signing Session (sessionId + signingUrl + evidenceId on completion). The evidence pack returns with `document: null` and a populated `action` field that the INSS auditor can read directly from the public verifier.

## Trigger node

Receives webhook events from SignDocs with HMAC-SHA256 signature verification. Default event: `TRANSACTION.COMPLETED`.

On workflow activation the node registers a webhook with SignDocs automatically. On deactivation it deletes the webhook. The signing secret is stored per workflow in static data and never exposed.

### Available events
- `TRANSACTION.CREATED` / `COMPLETED` / `CANCELLED` / `FAILED` / `EXPIRED`
- `STEP.STARTED` / `COMPLETED` / `FAILED`

### Example: archive signed document to Drive

```
SignDocs Brasil Trigger (TRANSACTION.COMPLETED)
  → SignDocs Brasil (Evidence → Get)
  → SignDocs Brasil (Document → Download)
  → Google Drive (Upload)
```

## Development

```bash
npm install
npm run build
```

To test against a local n8n instance:

```bash
export N8N_CUSTOM_EXTENSIONS=/absolute/path/to/signdocs-n8n-node
n8n start
```

## Support

- Docs: https://docs.signdocs.com.br
- Issues: https://github.com/signdocsbrasil/n8n-nodes-signdocs-brasil/issues
- Email: dev@signdocs.com.br

## License

This community node is published under the MIT license — see `LICENSE`.

### A note on n8n's fair-code license

n8n core itself is **fair-code** (Sustainable Use License, derived from Elastic License 2.0), **not** OSI open source. The MIT license above covers only this node's own code; combining it with n8n inherits n8n's SUL constraints. In practice:

- ✅ **Allowed:** running this node inside your own n8n instance for internal automation, building workflows that call the SignDocs Brasil API, distributing free templates that include this node (with attribution preserved).
- ❌ **Not allowed under the SUL:** white-labelling n8n + this node and reselling it as a SaaS product, embedding the n8n runtime in a closed commercial product without a commercial license from n8n.io.

For commercial-redistribution arrangements that need SignDocs Brasil involvement, contact `enterprise@signdocs.com.br`. This restriction is on the n8n runtime; it does not affect direct use of the SignDocs Brasil API or our other SDKs (TypeScript, Python, Go, Java, PHP, .NET).

This guidance mirrors the [Política de Uso Aceitável (AUP)](https://www.signdocs.com.br/aup.html) §7-A on third-party low-code orchestration platforms.
