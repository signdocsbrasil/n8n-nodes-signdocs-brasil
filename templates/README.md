# SignDocs Brasil · n8n Workflow Templates

Ready-to-import workflow templates for the `n8n-nodes-signdocs-brasil` community node.

Import via n8n: **Workflows → Import from File** → select `.json`.

All templates need credentials replaced (placeholders marked `REPLACE` or `*_ID_AQUI`).

---

## Templates

| File | Use case | Node dependencies |
|---|---|---|
| `contrato-google-docs.json` | Planilha → contrato Google Docs → PDF → SignDocs → e-mail | Google Sheets, Google Docs, Google Drive, Gmail, SignDocs Brasil |
| `link-assinatura-whatsapp-telegram.json` | Endpoint HTTP que entrega o link de assinatura via WhatsApp, Telegram ou e-mail conforme o campo `channel` | SignDocs Brasil, WhatsApp Business, Telegram, Gmail |
| `pipeline-imobiliario.json` | Lead imobiliário → CRM → proposta Google Docs → PDF → SignDocs → WhatsApp | Google Sheets, Google Docs, Google Drive, WhatsApp Business, SignDocs Brasil |

## Notes

- `policyProfile` values available: `CLICK_ONLY`, `OTP`, `BIOMETRIC`, `CLICK_AND_OTP`, `CLICK_AND_BIOMETRIC`, `OTP_AND_BIOMETRIC`, `FULL`, `DIGITAL_CERT`, `CUSTOM`. For email vs SMS OTP, set `additionalFields.otpChannel` to `email` or `sms`. For A3/ICP-Brasil signing, use `DIGITAL_CERT` and let the signer pick A1 or A3 in the signing UI.
- The SignDocs node exposes a `signingUrl` field that already combines `session.url` + `?cs=<clientSecret>` — use `{{$node["SignDocs · Criar sessão"].json["signingUrl"]}}` directly in messaging nodes.
- For completion notifications, pair these flows with a separate workflow using the **SignDocs Brasil Trigger** node listening for `TRANSACTION.COMPLETED`.

## Publishing

These templates mirror to `sign-docs-site-marketing/templates/` for direct download on the marketing gallery page at `https://www.signdocs.com.br/templates-n8n.html`.
