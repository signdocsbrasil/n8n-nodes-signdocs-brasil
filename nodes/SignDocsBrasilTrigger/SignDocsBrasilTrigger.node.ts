import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';

import { apiRequest, verifyWebhookSignature } from '../SignDocsBrasil/GenericFunctions';
import { WEBHOOK_EVENT_OPTIONS } from '../SignDocsBrasil/descriptions/WebhookDescription';

export class SignDocsBrasilTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SignDocs Brasil Trigger',
		name: 'signDocsBrasilTrigger',
		icon: 'file:signdocs.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow on SignDocs Brasil events (HMAC-verified)',
		defaults: { name: 'SignDocs Brasil Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'signDocsBrasilApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: ['TRANSACTION.COMPLETED'],
				required: true,
				options: WEBHOOK_EVENT_OPTIONS,
				description: 'Which events should trigger this workflow',
			},
			{
				displayName: 'Signature Tolerance (Seconds)',
				name: 'toleranceSeconds',
				type: 'number',
				default: 300,
				description: 'Reject requests whose timestamp header deviates from now by more than this value',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				return Boolean(webhookData.webhookId);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];

				if (
					webhookUrl.includes('localhost') ||
					webhookUrl.includes('127.0.0.1') ||
					/\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(webhookUrl)
				) {
					throw new ApplicationError(
						`SignDocs Brasil cannot deliver webhooks to a private URL (${webhookUrl}). Set WEBHOOK_URL to a publicly reachable https:// endpoint (e.g., via a tunnel like cloudflared/ngrok/localtunnel).`,
					);
				}

				let response: { webhookId: string; secret: string };
				try {
					response = (await apiRequest.call(this, {
						method: 'POST',
						path: '/v1/webhooks',
						body: { url: webhookUrl, events },
					})) as { webhookId: string; secret: string };
				} catch (err) {
					const anyErr = err as { statusCode?: number; response?: { status?: number }; message?: string };
					const status = anyErr.statusCode ?? anyErr.response?.status;
					if (status === 403) {
						throw new ApplicationError(
							`SignDocs Brasil rejected the webhook URL (${webhookUrl}). The URL must be publicly reachable over https. If you are running n8n locally, set WEBHOOK_URL to a tunnel endpoint.`,
						);
					}
					throw err;
				}

				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookId = response.webhookId;
				staticData.secret = response.secret;
				staticData.events = events;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId as string | undefined;
				if (!webhookId) return true;

				try {
					await apiRequest.call(this, { method: 'DELETE', path: `/v1/webhooks/${webhookId}` });
				} catch {
					// best-effort cleanup — the webhook may have already been removed
				}
				delete staticData.webhookId;
				delete staticData.secret;
				delete staticData.events;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
		const bodyString = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);

		const signatureHeader = this.getHeaderData()['x-signdocs-signature'] as string | undefined;
		const timestampHeader = this.getHeaderData()['x-signdocs-timestamp'] as string | undefined;

		const staticData = this.getWorkflowStaticData('node');
		const secret = staticData.secret as string | undefined;
		const toleranceSeconds = this.getNodeParameter('toleranceSeconds', 300) as number;

		if (!signatureHeader || !timestampHeader || !secret) {
			const res = this.getResponseObject();
			res.status(401).json({ error: 'missing signature headers' });
			return { noWebhookResponse: true };
		}

		const valid = verifyWebhookSignature(bodyString, signatureHeader, timestampHeader, secret, {
			toleranceSeconds,
		});

		if (!valid) {
			const res = this.getResponseObject();
			res.status(401).json({ error: 'invalid signature' });
			return { noWebhookResponse: true };
		}

		const body = (req.body ?? {}) as IDataObject;
		return { workflowData: [[{ json: body }]] };
	}
}
