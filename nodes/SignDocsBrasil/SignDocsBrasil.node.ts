import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { apiRequest, buildSigningUrl, parseMetadata } from './GenericFunctions';
import { signingSessionOperations, signingSessionFields } from './descriptions/SigningSessionDescription';
import { trustSessionOperations, trustSessionFields } from './descriptions/TrustSessionDescription';
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
					{ name: 'Trust Session', value: 'trustSession' },
					{ name: 'Webhook', value: 'webhook' },
				],
				default: 'signingSession',
			},
			...signingSessionOperations,
			...signingSessionFields,
			...trustSessionOperations,
			...trustSessionFields,
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

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let output: unknown;

				if (resource === 'signingSession') {
					output = await executeSigningSession.call(this, operation, i);
				} else if (resource === 'trustSession') {
					output = await executeTrustSession.call(this, operation, i);
				} else if (resource === 'envelope') {
					output = await executeEnvelope.call(this, operation, i);
				} else if (resource === 'evidence') {
					output = await executeEvidence.call(this, operation, i);
				} else if (resource === 'document') {
					output = await executeDocument.call(this, operation, i);
				} else if (resource === 'webhook') {
					output = await executeWebhook.call(this, operation, i);
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

async function executeSigningSession(
	this: IExecuteFunctions,
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
		if (additionalFields.ownerEmail || additionalFields.ownerName) {
			request.owner = {
				...(additionalFields.ownerEmail ? { email: additionalFields.ownerEmail } : {}),
				...(additionalFields.ownerName ? { name: additionalFields.ownerName } : {}),
			};
		}
		const metadata = parseMetadata(additionalFields.metadata as string | undefined);
		if (metadata) request.metadata = metadata;

		const session = await apiRequest.call<
			IExecuteFunctions,
			[{ method: 'POST'; path: string; body: unknown; idempotencyKey?: string }],
			Promise<{ url: string; clientSecret: string; [k: string]: unknown }>
		>(this, {
			method: 'POST',
			path: '/v1/signing-sessions',
			body: request,
			idempotencyKey: additionalFields.idempotencyKey as string | undefined,
		});
		return { ...session, signingUrl: buildSigningUrl(session.url, session.clientSecret) };
	}

	if (operation === 'getStatus') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		return apiRequest.call(this, { method: 'GET', path: `/v1/signing-sessions/${sessionId}/status` });
	}

	if (operation === 'cancel') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		return apiRequest.call(this, { method: 'POST', path: `/v1/signing-sessions/${sessionId}/cancel` });
	}

	if (operation === 'link') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		// Returned as `signingUrl` as well as `url`, so a workflow can read the
		// same field here as after a create. It is NOT passed through
		// buildSigningUrl: this endpoint hands back a complete link with the
		// client secret already in the query string, and appending a second one
		// would break it.
		//
		// No idempotency key, deliberately. The link is single-use, so a retry
		// has to mint a fresh one — replaying a cached response would hand back
		// a URL that has already been consumed.
		const minted = (await apiRequest.call(this, {
			method: 'POST',
			path: `/v1/signing-sessions/${sessionId}/link`,
		})) as { url: string; [k: string]: unknown };
		return { ...minted, signingUrl: minted.url };
	}

	throw new NodeOperationError(this.getNode(), `Unknown signing-session operation: ${operation}`, { itemIndex: i });
}

/**
 * Trust Session (Sessão de Confiança) — POST /v1/trust-sessions and friends.
 * The endpoint is a thin facade over signing-sessions with
 * purpose=ACTION_AUTHENTICATION pre-set, document rejected, action required.
 * This handler mirrors that contract from the n8n side.
 */
async function executeTrustSession(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'create') {
		const policyProfile = this.getNodeParameter('policyProfile', i) as string;
		const actionType = this.getNodeParameter('actionType', i) as string;
		const actionDescription = this.getNodeParameter('actionDescription', i) as string;
		const signerName = this.getNodeParameter('signerName', i) as string;
		const signerExternalId = this.getNodeParameter('signerExternalId', i) as string;
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as Record<string, unknown>;

		const request: Record<string, unknown> = {
			policy: { profile: policyProfile },
			action: {
				type: actionType,
				description: actionDescription,
				...(additionalFields.actionReference ? { reference: additionalFields.actionReference } : {}),
			},
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

		if (additionalFields.returnUrl) request.returnUrl = additionalFields.returnUrl;
		if (additionalFields.cancelUrl) request.cancelUrl = additionalFields.cancelUrl;
		if (additionalFields.locale) request.locale = additionalFields.locale;
		if (additionalFields.expiresInMinutes) request.expiresInMinutes = additionalFields.expiresInMinutes;
		if (additionalFields.ownerEmail || additionalFields.ownerName) {
			request.owner = {
				...(additionalFields.ownerEmail ? { email: additionalFields.ownerEmail } : {}),
				...(additionalFields.ownerName ? { name: additionalFields.ownerName } : {}),
			};
		}
		const metadata = parseMetadata(additionalFields.metadata as string | undefined);
		if (metadata) request.metadata = metadata;

		const session = await apiRequest.call<
			IExecuteFunctions,
			[{ method: 'POST'; path: string; body: unknown; idempotencyKey?: string }],
			Promise<{ url: string; clientSecret: string; [k: string]: unknown }>
		>(this, {
			method: 'POST',
			path: '/v1/trust-sessions',
			body: request,
			idempotencyKey: additionalFields.idempotencyKey as string | undefined,
		});
		return { ...session, signingUrl: buildSigningUrl(session.url, session.clientSecret) };
	}

	if (operation === 'getStatus') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		return apiRequest.call(this, { method: 'GET', path: `/v1/trust-sessions/${sessionId}/status` });
	}

	if (operation === 'cancel') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		return apiRequest.call(this, { method: 'POST', path: `/v1/trust-sessions/${sessionId}/cancel` });
	}

	throw new NodeOperationError(this.getNode(), `Unknown trust-session operation: ${operation}`, { itemIndex: i });
}

async function executeEnvelope(
	this: IExecuteFunctions,
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
		if (additionalFields.ownerEmail || additionalFields.ownerName) {
			request.owner = {
				...(additionalFields.ownerEmail ? { email: additionalFields.ownerEmail } : {}),
				...(additionalFields.ownerName ? { name: additionalFields.ownerName } : {}),
			};
		}
		const metadata = parseMetadata(additionalFields.metadata as string | undefined);
		if (metadata) request.metadata = metadata;

		return apiRequest.call(this, {
			method: 'POST',
			path: '/v1/envelopes',
			body: request,
			idempotencyKey: additionalFields.idempotencyKey as string | undefined,
		});
	}

	if (operation === 'get') {
		const envelopeId = this.getNodeParameter('envelopeId', i) as string;
		return apiRequest.call(this, { method: 'GET', path: `/v1/envelopes/${envelopeId}` });
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

		const session = await apiRequest.call<
			IExecuteFunctions,
			[{ method: 'POST'; path: string; body: unknown; idempotencyKey?: string }],
			Promise<{ url: string; clientSecret: string; [k: string]: unknown }>
		>(this, {
			method: 'POST',
			path: `/v1/envelopes/${envelopeId}/sessions`,
			body: request,
			// Distinct per signer. The API scopes its cache by key and resolved
			// path, and every signer on an envelope shares that path, so one key
			// reused across signers would serve signer 2 the response cached for
			// signer 1 — and that response carries the only copy of signer 1's
			// clientSecret.
			idempotencyKey: additional.idempotencyKey as string | undefined,
		});
		return { ...session, signingUrl: buildSigningUrl(session.url, session.clientSecret) };
	}

	if (operation === 'combinedStamp') {
		const envelopeId = this.getNodeParameter('envelopeId', i) as string;
		return apiRequest.call(this, {
			method: 'POST',
			path: `/v1/envelopes/${envelopeId}/combined-stamp`,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown envelope operation: ${operation}`, { itemIndex: i });
}

async function executeEvidence(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'get') {
		const transactionId = this.getNodeParameter('transactionId', i) as string;
		return apiRequest.call(this, { method: 'GET', path: `/v1/transactions/${transactionId}/evidence` });
	}
	throw new NodeOperationError(this.getNode(), `Unknown evidence operation: ${operation}`, { itemIndex: i });
}

async function executeDocument(
	this: IExecuteFunctions,
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
		return apiRequest.call(this, {
			method: 'POST',
			path: `/v1/transactions/${transactionId}/document`,
			body: { content, filename },
		});
	}

	if (operation === 'download') {
		return apiRequest.call(this, {
			method: 'GET',
			path: `/v1/transactions/${transactionId}/download`,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown document operation: ${operation}`, { itemIndex: i });
}

async function executeWebhook(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<unknown> {
	if (operation === 'register') {
		const url = this.getNodeParameter('url', i) as string;
		const events = this.getNodeParameter('events', i) as string[];
		return apiRequest.call(this, {
			method: 'POST',
			path: '/v1/webhooks',
			body: { url, events },
		});
	}
	if (operation === 'list') {
		// GET /v1/webhooks returns { webhooks: Webhook[], count: number }.
		// Unwrap to a bare array so downstream n8n nodes can iterate directly;
		// accept a bare-array shape defensively for legacy test fixtures.
		const response = (await apiRequest.call(this, { method: 'GET', path: '/v1/webhooks' })) as
			| { webhooks?: unknown[]; count?: number }
			| unknown[];
		if (Array.isArray(response)) return response;
		return response?.webhooks ?? [];
	}
	if (operation === 'delete') {
		const webhookId = this.getNodeParameter('webhookId', i) as string;
		await apiRequest.call(this, { method: 'DELETE', path: `/v1/webhooks/${webhookId}` });
		return { webhookId, deleted: true };
	}
	if (operation === 'test') {
		const webhookId = this.getNodeParameter('webhookId', i) as string;
		return apiRequest.call(this, { method: 'POST', path: `/v1/webhooks/${webhookId}/test` });
	}
	throw new NodeOperationError(this.getNode(), `Unknown webhook operation: ${operation}`, { itemIndex: i });
}
