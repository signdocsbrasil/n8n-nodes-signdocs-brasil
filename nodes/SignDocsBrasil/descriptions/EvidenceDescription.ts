import type { INodeProperties } from 'n8n-workflow';

export const evidenceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['evidence'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get evidence for a transaction' },
		],
		default: 'get',
	},
];

export const evidenceFields: INodeProperties[] = [
	{
		displayName: 'Transaction ID',
		name: 'transactionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['evidence'], operation: ['get'] } },
	},
];
