import type { INodeProperties } from 'n8n-workflow';

// Canonical set of webhook events — keep in lockstep with openapi.yaml
// `WebhookEventType` enum. Events tagged [NT65] are only emitted for
// tenants with `nt65ComplianceEnabled` (INSS consignado flow).
export const WEBHOOK_EVENT_OPTIONS = [
	// Transaction events
	{ name: 'Transaction Created', value: 'TRANSACTION.CREATED' },
	{ name: 'Transaction Completed', value: 'TRANSACTION.COMPLETED' },
	{ name: 'Transaction Cancelled', value: 'TRANSACTION.CANCELLED' },
	{ name: 'Transaction Failed', value: 'TRANSACTION.FAILED' },
	{ name: 'Transaction Expired', value: 'TRANSACTION.EXPIRED' },
	{ name: 'Transaction Fallback', value: 'TRANSACTION.FALLBACK' },
	{ name: 'Transaction Deadline Approaching [NT65]', value: 'TRANSACTION.DEADLINE_APPROACHING' },
	// Step events
	{ name: 'Step Started', value: 'STEP.STARTED' },
	{ name: 'Step Completed', value: 'STEP.COMPLETED' },
	{ name: 'Step Failed', value: 'STEP.FAILED' },
	{ name: 'Step Purpose Disclosure Sent [NT65]', value: 'STEP.PURPOSE_DISCLOSURE_SENT' },
	// Signing session events
	{ name: 'Signing Session Created', value: 'SIGNING_SESSION.CREATED' },
	{ name: 'Signing Session Completed', value: 'SIGNING_SESSION.COMPLETED' },
	{ name: 'Signing Session Cancelled', value: 'SIGNING_SESSION.CANCELLED' },
	{ name: 'Signing Session Expired', value: 'SIGNING_SESSION.EXPIRED' },
	// Envelope events
	{ name: 'Envelope All Signed', value: 'ENVELOPE.ALL_SIGNED' },
	// Operational events
	{ name: 'Quota Warning', value: 'QUOTA.WARNING' },
	{ name: 'API Deprecation Notice', value: 'API.DEPRECATION_NOTICE' },
];

export const webhookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['webhook'] } },
		options: [
			{ name: 'Register', value: 'register', action: 'Register a webhook' },
			{ name: 'List', value: 'list', action: 'List registered webhooks' },
			{ name: 'Delete', value: 'delete', action: 'Delete a webhook' },
			{ name: 'Test', value: 'test', action: 'Send a test event to a webhook' },
		],
		default: 'register',
	},
];

export const webhookFields: INodeProperties[] = [
	{
		displayName: 'Webhook URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['webhook'], operation: ['register'] } },
	},
	{
		displayName: 'Events',
		name: 'events',
		type: 'multiOptions',
		default: ['TRANSACTION.COMPLETED'],
		required: true,
		options: WEBHOOK_EVENT_OPTIONS,
		displayOptions: { show: { resource: ['webhook'], operation: ['register'] } },
	},
	{
		displayName: 'Webhook ID',
		name: 'webhookId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['webhook'], operation: ['delete', 'test'] } },
	},
];
