import type {
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';
import * as crypto from 'crypto';

const HML_BASE_URL = 'https://api-hml.signdocs.com.br';
const PROD_BASE_URL = 'https://api.signdocs.com.br';

export function getBaseUrl(environment: string): string {
	return environment === 'hml' ? HML_BASE_URL : PROD_BASE_URL;
}

export interface ApiRequestOptions {
	method: IHttpRequestMethods;
	path: string;
	body?: unknown;
	qs?: Record<string, string | number | boolean | undefined>;
	idempotencyKey?: string;
}

export async function apiRequest<T = unknown>(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions,
	options: ApiRequestOptions,
): Promise<T> {
	const credentials = await this.getCredentials('signDocsBrasilApi');
	const baseUrl = getBaseUrl((credentials.environment as string) ?? 'prod');

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (options.body !== undefined) headers['Content-Type'] = 'application/json';
	if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url: `${baseUrl}${options.path}`,
		headers,
		json: true,
	};
	if (options.body !== undefined) requestOptions.body = options.body;
	if (options.qs !== undefined) {
		const cleanQs: Record<string, string | number | boolean> = {};
		for (const [k, v] of Object.entries(options.qs)) {
			if (v !== undefined) cleanQs[k] = v;
		}
		if (Object.keys(cleanQs).length > 0) requestOptions.qs = cleanQs;
	}

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'signDocsBrasilApi',
			requestOptions,
		)) as T;
	} catch (err) {
		const anyErr = err as {
			statusCode?: number;
			response?: { status?: number; body?: unknown; data?: unknown };
		};
		const status = anyErr.statusCode ?? anyErr.response?.status;
		if (status === 403) {
			const bodyContent = anyErr.response?.body ?? anyErr.response?.data;
			const bodySnippet = typeof bodyContent === 'string' ? bodyContent : '';
			if (bodySnippet.includes('CloudFront')) {
				throw new ApplicationError(
					'SignDocs Brasil rejected the request (CloudFront 403). If this is a webhook registration, the URL must be publicly reachable over https — not localhost or a private IP.',
				);
			}
		}
		throw err;
	}
}

export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export function verifyWebhookSignature(
	body: string,
	signatureHeader: string,
	timestampHeader: string,
	secret: string,
	options?: { toleranceSeconds?: number },
): boolean {
	const tolerance = options?.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS;
	const timestamp = parseInt(timestampHeader, 10);
	if (isNaN(timestamp)) return false;

	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestamp) > tolerance) return false;

	const signingInput = `${timestamp}.${body}`;
	const expected = crypto.createHmac('sha256', secret).update(signingInput).digest('hex');

	const sigBuf = Buffer.from(signatureHeader);
	const expBuf = Buffer.from(expected);
	if (sigBuf.length !== expBuf.length) return false;
	return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function parseMetadata(raw: string | undefined): Record<string, string> | undefined {
	if (!raw || !raw.trim()) return undefined;
	const parsed = JSON.parse(raw);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new ApplicationError('metadata must be a JSON object with string values');
	}
	const result: Record<string, string> = {};
	for (const [k, v] of Object.entries(parsed)) {
		result[k] = String(v);
	}
	return result;
}

export function buildSigningUrl(url: string, clientSecret: string): string {
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}cs=${encodeURIComponent(clientSecret)}`;
}

