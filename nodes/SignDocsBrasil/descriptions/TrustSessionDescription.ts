import type { INodeProperties } from 'n8n-workflow';

/**
 * Trust Session (Sessão de Confiança) — authenticate a digital action without
 * a document. Hits POST /v1/trust-sessions (thin facade over Signing Sessions
 * with purpose=ACTION_AUTHENTICATION pre-set). Use this resource when the
 * thing being authenticated is an action (KYC, loan approval, telemedicine
 * consent, escrow release) rather than a PDF.
 *
 * Differences from the Signing Session resource:
 *   - No document upload (Source/Binary/Content/Filename fields hidden)
 *   - Action Type + Action Description are required top-level fields
 *   - DIGITAL_CERT profile is omitted — DIGITAL_SIGN_A1 requires a document
 *   - Endpoints target /v1/trust-sessions/{id}/... (registered in
 *     TrustSessionsHandlersStack on the backend)
 */
export const trustSessionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['trustSession'] } },
		options: [
			{ name: 'Cancel', value: 'cancel', action: 'Cancel a trust session' },
			{
				name: 'Create',
				value: 'create',
				action: 'Create a trust session',
				description: 'Authenticate an action (KYC, approval, consent, escrow) without a document. Returns a hosted URL the end user opens to complete biometric/OTP/SERPRO steps.',
			},
			{ name: 'Get Status', value: 'getStatus', action: 'Get trust session status' },
		],
		default: 'create',
	},
];

export const trustSessionFields: INodeProperties[] = [
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['trustSession'], operation: ['getStatus', 'cancel'] } },
	},
	{
		displayName: 'Policy Profile',
		name: 'policyProfile',
		type: 'options',
		default: 'BIOMETRIC',
		description:
			'Authentication strength. DIGITAL_CERT is intentionally absent — the ICP-Brasil A1 step requires a document and is incompatible with trust sessions.',
		options: [
			{ name: 'Biometric (Facial)', value: 'BIOMETRIC' },
			{ name: 'Biometric + SERPRO Cross-Check', value: 'BIOMETRIC_SERPRO' },
			{ name: 'Biometric SERPRO (Auto Fallback)', value: 'BIOMETRIC_SERPRO_AUTO_FALLBACK' },
			{ name: 'Biometric With Document Photo Fallback', value: 'BIOMETRIC_DOCUMENT_FALLBACK' },
			{ name: 'Click + Biometric', value: 'CLICK_AND_BIOMETRIC' },
			{ name: 'Click + OTP', value: 'CLICK_AND_OTP' },
			{ name: 'Click Only (Clickwrap)', value: 'CLICK_ONLY' },
			{ name: 'Custom', value: 'CUSTOM' },
			{ name: 'Full (Click + OTP + Biometric)', value: 'FULL' },
			{ name: 'OTP (Email or SMS)', value: 'OTP' },
			{ name: 'OTP + Biometric', value: 'OTP_AND_BIOMETRIC' },
		],
		displayOptions: { show: { resource: ['trustSession'], operation: ['create'] } },
	},
	{
		displayName: 'Action Type',
		name: 'actionType',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'approve_disbursement',
		description:
			'Machine-readable identifier for what is being authenticated. Used in the evidence pack and in your audit trail. Examples: approve_payroll_loan_disbursement, vasp_quarterly_reverification, telemedicine_consultation_consent.',
		displayOptions: { show: { resource: ['trustSession'], operation: ['create'] } },
	},
	{
		displayName: 'Action Description',
		name: 'actionDescription',
		type: 'string',
		default: '',
		required: true,
		typeOptions: { rows: 2 },
		placeholder: 'Aprovar liberação de empréstimo consignado #INSS-2026-007482 — R$ 8.450,00',
		description:
			'Human-readable description shown to the signer on the hosted page and captured in the evidence pack. Should stand alone for a judge or auditor reading it later.',
		displayOptions: { show: { resource: ['trustSession'], operation: ['create'] } },
	},
	{
		displayName: 'Signer Name',
		name: 'signerName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['trustSession'], operation: ['create'] } },
	},
	{
		displayName: 'Signer External ID',
		name: 'signerExternalId',
		type: 'string',
		default: '',
		required: true,
		description: "Your system's identifier for this signer (e.g., user ID). Used for audit trails.",
		displayOptions: { show: { resource: ['trustSession'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['trustSession'], operation: ['create'] } },
		options: [
			{
				displayName: 'Action Reference',
				name: 'actionReference',
				type: 'string',
				default: '',
				description: 'Optional internal correlation ID surfaced alongside Action Type in the evidence pack',
			},
			{ displayName: 'Cancel URL', name: 'cancelUrl', type: 'string', default: '' },
			{ displayName: 'Expires In (Minutes)', name: 'expiresInMinutes', type: 'number', default: 60 },
			{ displayName: 'Idempotency Key', name: 'idempotencyKey', type: 'string', typeOptions: { password: true }, default: '' },
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'options',
				default: 'pt-BR',
				options: [
					{ name: 'Portuguese (Brasil)', value: 'pt-BR' },
					{ name: 'English', value: 'en' },
					{ name: 'Spanish', value: 'es' },
				],
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Key-value pairs with string values. Common keys: regulation (IN-138-2022 / Lei-14478-2022 / CFM-2314-2022), contract_id, consultation_id.',
			},
			{
				displayName: 'OTP Channel',
				name: 'otpChannel',
				type: 'options',
				default: 'email',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'SMS', value: 'sms' },
				],
			},
			{
				displayName: 'Owner Email',
				name: 'ownerEmail',
				type: 'string',
				default: '',
				placeholder: 'requester@example.com',
				description:
					'If set, SignDocs sends an invitation to Signer Email (when it differs) and a completion notification to this address. Omit to deliver the URL yourself + rely on webhooks.',
			},
			{
				displayName: 'Owner Name',
				name: 'ownerName',
				type: 'string',
				default: '',
				placeholder: 'Maria Souza',
				description: 'Shown in the invite email footer and the completion-notification greeting',
			},
			{ displayName: 'Return URL', name: 'returnUrl', type: 'string', default: '' },
			{ displayName: 'Signer Birth Date', name: 'signerBirthDate', type: 'string', default: '', placeholder: 'YYYY-MM-DD' },
			{ displayName: 'Signer CNPJ', name: 'signerCnpj', type: 'string', default: '' },
			{ displayName: 'Signer CPF', name: 'signerCpf', type: 'string', default: '' },
			{ displayName: 'Signer Email', name: 'signerEmail', type: 'string', default: '', placeholder: 'user@example.com' },
			{ displayName: 'Signer Phone', name: 'signerPhone', type: 'string', default: '', placeholder: '+5511999999999' },
		],
	},
];
