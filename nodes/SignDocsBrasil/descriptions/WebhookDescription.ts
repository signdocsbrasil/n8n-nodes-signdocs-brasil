import type { INodeProperties } from 'n8n-workflow';

export const WEBHOOK_EVENT_OPTIONS = [
	{ name: 'Transaction Created', value: 'TRANSACTION.CREATED' },
	{ name: 'Transaction Completed', value: 'TRANSACTION.COMPLETED' },
	{ name: 'Transaction Cancelled', value: 'TRANSACTION.CANCELLED' },
	{ name: 'Transaction Failed', value: 'TRANSACTION.FAILED' },
	{ name: 'Transaction Expired', value: 'TRANSACTION.EXPIRED' },
	{ name: 'Step Started', value: 'STEP.STARTED' },
	{ name: 'Step Completed', value: 'STEP.COMPLETED' },
	{ name: 'Step Failed', value: 'STEP.FAILED' },
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
