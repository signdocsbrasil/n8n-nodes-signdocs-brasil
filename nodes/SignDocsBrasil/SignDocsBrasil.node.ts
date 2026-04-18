import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getClient, parseMetadata } from './GenericFunctions';
import { signingSessionOperations, signingSessionFields } from './descriptions/SigningSessionDescription';
import { envelopeOperations, envelopeFields } from './descriptions/EnvelopeDescription';
import { evidenceOperations, evidenceFields } from './descriptions/EvidenceDescription';
import { documentOperations, documentFields } from './descriptions/DocumentDescription';
import { webhookOperations, webhookFields } from './descriptions/WebhookDescription';

export class SignDocsBrasil implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SignDocs Brasil',
		name: 'signDocsBrasil',
		icon: 'file:signdocs.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send documents for electronic signature via SignDocs Brasil',
		defaults: { name: 'SignDocs Brasil' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'signDocsBrasilApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Document', value: 'document' },
					{ name: 'Envelope', value: 'envelope' },
					{ name: 'Evidence', value: 'evidence' },
					{ name: 'Signing Session', value: 'signingSession' },
					{ name: 'Webhook', value: 'webhook' },
				],
				default: 'signingSession',
			},
			...signingSessionOperations,
			...signingSessionFields,
			...envelopeOperations,
			...envelopeFields,
			...evidenceOperations,
			...evidenceFields,
			...documentOperations,
			...documentFields,
			...webhookOperations,
			...webhookFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const client = await getClient.call(this);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let output: unknown;

				if (resource === 'signingSession') {
					output = await executeSigningSession.call(this, client, operation, i);
				} else if (resource === 'envelope') {
					output = await executeEnvelope.call(this, client, operation, i);
				} else if (resource === 'evidence') {
					output = await executeEvidence.call(this, client, operation, i);
				} else if (resource === 'document') {
					output = await executeDocument.call(this, client, operation, i);
				} else if (resource === 'webhook') {
					output = await executeWebhook.call(this, client, operation, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, { itemIndex: i });
				}

				returnData.push({ json: output as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

function buildSigningUrl(url: string, clientSecret: string): string {
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}cs=${encodeURIComponent(clientSecret)}`;
}

async function executeSigningSession(
	this: IExecuteFunctions,
	client: Awaited<ReturnType<typeof getClient>>,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'create') {
		const purpose = this.getNodeParameter('purpose', i) as 'DOCUMENT_SIGNATURE' | 'ACTION_AUTHENTICATION';
		const policyProfile = this.getNodeParameter('policyProfile', i) as string;
		const signerName = this.getNodeParameter('signerName', i) as string;
		const signerExternalId = this.getNodeParameter('signerExternalId', i) as string;
		const documentSource = this.getNodeParameter('documentSource', i) as string;
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as Record<string, unknown>;

		const request: Record<string, unknown> = {
			purpose,
			policy: { profile: policyProfile },
			signer: {
				name: signerName,
				userExternalId: signerExternalId,
				...(additionalFields.signerEmail ? { email: additionalFields.signerEmail } : {}),
				...(additionalFields.signerPhone ? { phone: additionalFields.signerPhone } : {}),
				...(additionalFields.signerCpf ? { cpf: additionalFields.signerCpf } : {}),
				...(additionalFields.signerCnpj ? { cnpj: additionalFields.signerCnpj } : {}),
				...(additionalFields.signerBirthDate ? { birthDate: additionalFields.signerBirthDate } : {}),
				...(additionalFields.otpChannel ? { otpChannel: additionalFields.otpChannel } : {}),
			},
		};

		if (documentSource === 'binary') {
			const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
			const filename = this.getNodeParameter('filename', i) as string;
			const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
			request.document = { content: binaryData.toString('base64'), filename };
		} else if (documentSource === 'base64') {
			const content = this.getNodeParameter('documentContent', i) as string;
			const filename = this.getNodeParameter('filename', i) as string;
			request.document = { content, filename };
		}

		if (purpose === 'ACTION_AUTHENTICATION' && additionalFields.actionType) {
			request.action = {
				type: additionalFields.actionType,
				description: (additionalFields.actionDescription as string) ?? '',
				...(additionalFields.actionReference ? { reference: additionalFields.actionReference } : {}),
			};
		}

		if (additionalFields.returnUrl) request.returnUrl = additionalFields.returnUrl;
		if (additionalFields.cancelUrl) request.cancelUrl = additionalFields.cancelUrl;
		if (additionalFields.locale) request.locale = additionalFields.locale;
		if (additionalFields.expiresInMinutes) request.expiresInMinutes = additionalFields.expiresInMinutes;
		const metadata = parseMetadata(additionalFields.metadata as string | undefined);
		if (metadata) request.metadata = metadata;

		const idempotencyKey = additionalFields.idempotencyKey as string | undefined;
		const session = await client.signingSessions.create(request as never, idempotencyKey);
		return { ...session, signingUrl: buildSigningUrl(session.url, session.clientSecret) };
	}

	if (operation === 'getStatus') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		return client.signingSessions.getStatus(sessionId);
	}

	if (operation === 'cancel') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		return client.signingSessions.cancel(sessionId);
	}

	if (operation === 'waitForCompletion') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		const pollIntervalMs = this.getNodeParameter('pollIntervalMs', i, 3000) as number;
		const timeoutMs = this.getNodeParameter('timeoutMs', i, 300000) as number;
		return client.signingSessions.waitForCompletion(sessionId, { pollIntervalMs, timeoutMs });
	}

	throw new NodeOperationError(this.getNode(), `Unknown signing-session operation: ${operation}`, { itemIndex: i });
}

async function executeEnvelope(
	this: IExecuteFunctions,
	client: Awaited<ReturnType<typeof getClient>>,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'create') {
		const signingMode = this.getNodeParameter('signingMode', i) as 'PARALLEL' | 'SEQUENTIAL';
		const totalSigners = this.getNodeParameter('totalSigners', i) as number;
		const documentSource = this.getNodeParameter('documentSource', i) as string;
		const filename = this.getNodeParameter('filename', i) as string;
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as Record<string, unknown>;

		let documentContent: string;
		if (documentSource === 'binary') {
			const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
			const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
			documentContent = binaryData.toString('base64');
		} else {
			documentContent = this.getNodeParameter('documentContent', i) as string;
		}

		const request: Record<string, unknown> = {
			signingMode,
			totalSigners,
			document: { content: documentContent, filename },
		};
		if (additionalFields.returnUrl) request.returnUrl = additionalFields.returnUrl;
		if (additionalFields.cancelUrl) request.cancelUrl = additionalFields.cancelUrl;
		if (additionalFields.locale) request.locale = additionalFields.locale;
		if (additionalFields.expiresInMinutes) request.expiresInMinutes = additionalFields.expiresInMinutes;
		const metadata = parseMetadata(additionalFields.metadata as string | undefined);
		if (metadata) request.metadata = metadata;

		return client.envelopes.create(request as never, additionalFields.idempotencyKey as string | undefined);
	}

	if (operation === 'get') {
		const envelopeId = this.getNodeParameter('envelopeId', i) as string;
		return client.envelopes.get(envelopeId);
	}

	if (operation === 'addSession') {
		const envelopeId = this.getNodeParameter('envelopeId', i) as string;
		const signerIndex = this.getNodeParameter('signerIndex', i) as number;
		const signerName = this.getNodeParameter('signerName', i) as string;
		const signerExternalId = this.getNodeParameter('signerExternalId', i) as string;
		const policyProfile = this.getNodeParameter('policyProfile', i) as string;
		const additional = this.getNodeParameter('additionalSignerFields', i, {}) as Record<string, unknown>;

		const request: Record<string, unknown> = {
			signerIndex,
			policy: { profile: policyProfile },
			signer: {
				name: signerName,
				userExternalId: signerExternalId,
				...(additional.signerEmail ? { email: additional.signerEmail } : {}),
				...(additional.signerPhone ? { phone: additional.signerPhone } : {}),
				...(additional.signerCpf ? { cpf: additional.signerCpf } : {}),
				...(additional.signerCnpj ? { cnpj: additional.signerCnpj } : {}),
				...(additional.signerBirthDate ? { birthDate: additional.signerBirthDate } : {}),
				...(additional.otpChannel ? { otpChannel: additional.otpChannel } : {}),
			},
		};
		if (additional.returnUrl) request.returnUrl = additional.returnUrl;
		if (additional.cancelUrl) request.cancelUrl = additional.cancelUrl;
		const metadata = parseMetadata(additional.metadata as string | undefined);
		if (metadata) request.metadata = metadata;

		const session = await client.envelopes.addSession(envelopeId, request as never);
		return { ...session, signingUrl: buildSigningUrl(session.url, session.clientSecret) };
	}

	if (operation === 'combinedStamp') {
		const envelopeId = this.getNodeParameter('envelopeId', i) as string;
		return client.envelopes.combinedStamp(envelopeId);
	}

	throw new NodeOperationError(this.getNode(), `Unknown envelope operation: ${operation}`, { itemIndex: i });
}

async function executeEvidence(
	this: IExecuteFunctions,
	client: Awaited<ReturnType<typeof getClient>>,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'get') {
		const transactionId = this.getNodeParameter('transactionId', i) as string;
		return client.evidence.get(transactionId);
	}
	throw new NodeOperationError(this.getNode(), `Unknown evidence operation: ${operation}`, { itemIndex: i });
}

async function executeDocument(
	this: IExecuteFunctions,
	client: Awaited<ReturnType<typeof getClient>>,
	operation: string,
	i: number,
): Promise<unknown> {
	const transactionId = this.getNodeParameter('transactionId', i) as string;

	if (operation === 'upload') {
		const documentSource = this.getNodeParameter('documentSource', i) as string;
		const filename = this.getNodeParameter('filename', i) as string;
		let content: string;
		if (documentSource === 'binary') {
			const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
			const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
			content = binaryData.toString('base64');
		} else {
			content = this.getNodeParameter('documentContent', i) as string;
		}
		return client.documents.upload(transactionId, { content, filename });
	}

	if (operation === 'download') {
		return client.documents.download(transactionId);
	}

	throw new NodeOperationError(this.getNode(), `Unknown document operation: ${operation}`, { itemIndex: i });
}

async function executeWebhook(
	this: IExecuteFunctions,
	client: Awaited<ReturnType<typeof getClient>>,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'register') {
		const url = this.getNodeParameter('url', i) as string;
		const events = this.getNodeParameter('events', i) as string[];
		return client.webhooks.register({ url, events: events as never });
	}
	if (operation === 'list') {
		return client.webhooks.list();
	}
	if (operation === 'delete') {
		const webhookId = this.getNodeParameter('webhookId', i) as string;
		await client.webhooks.delete(webhookId);
		return { webhookId, deleted: true };
	}
	if (operation === 'test') {
		const webhookId = this.getNodeParameter('webhookId', i) as string;
		return client.webhooks.test(webhookId);
	}
	throw new NodeOperationError(this.getNode(), `Unknown webhook operation: ${operation}`, { itemIndex: i });
}
