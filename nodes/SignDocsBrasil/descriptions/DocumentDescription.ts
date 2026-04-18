import type { INodeProperties } from 'n8n-workflow';

export const documentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['document'] } },
		options: [
			{ name: 'Upload', value: 'upload', action: 'Upload a document to an existing transaction' },
			{ name: 'Download', value: 'download', action: 'Get a signed document download link' },
		],
		default: 'upload',
	},
];

export const documentFields: INodeProperties[] = [
	{
		displayName: 'Transaction ID',
		name: 'transactionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['document'] } },
	},
	{
		displayName: 'Document Source',
		name: 'documentSource',
		type: 'options',
		default: 'binary',
		options: [
			{ name: 'Binary Property (From Previous Node)', value: 'binary' },
			{ name: 'Base64 String', value: 'base64' },
		],
		displayOptions: { show: { resource: ['document'], operation: ['upload'] } },
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		displayOptions: { show: { resource: ['document'], operation: ['upload'], documentSource: ['binary'] } },
	},
	{
		displayName: 'Document Content (Base64)',
		name: 'documentContent',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: { show: { resource: ['document'], operation: ['upload'], documentSource: ['base64'] } },
	},
	{
		displayName: 'Filename',
		name: 'filename',
		type: 'string',
		default: 'document.pdf',
		displayOptions: { show: { resource: ['document'], operation: ['upload'] } },
	},
];
