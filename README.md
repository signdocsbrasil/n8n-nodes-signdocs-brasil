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

- **Environment** — `Production` or `Homologação (HML)`
- **Authentication Method** — `Client Secret` (simplest) or `Private Key JWT (ES256)`
- **Client ID** + either `Client Secret` or `Private Key (PEM)` + `Key ID (kid)`

Obtain credentials from your SignDocs tenant admin portal.

> **Note on credential test:** The "Test" button performs a real OAuth2 `client_credentials` token exchange against `/oauth2/token`. This works for the Client Secret auth mode. For Private Key JWT mode the test cannot sign the ES256 assertion declaratively and will fail — validate those credentials by running a workflow instead.

## Action node — operations

| Resource | Operations |
|----------|-----------|
| Signing Session | Create, Get Status, Cancel, Wait for Completion |
| Envelope | Create, Get, Add Session, Combined Stamp |
| Evidence | Get |
| Document | Upload, Download |
| Webhook | Register, List, Delete, Test |

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

MIT
