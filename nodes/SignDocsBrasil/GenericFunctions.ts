import type { ICredentialDataDecryptedObject, IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions, IWebhookFunctions } from 'n8n-workflow';
import { SignDocsBrasilClient } from '@signdocs-brasil/api';

const HML_BASE_URL = 'https://api-hml.signdocs.com.br';
const PROD_BASE_URL = 'https://api.signdocs.com.br';

export function getBaseUrl(environment: string): string {
	return environment === 'hml' ? HML_BASE_URL : PROD_BASE_URL;
}

export async function getClient(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions,
): Promise<SignDocsBrasilClient> {
	const credentials = (await this.getCredentials('signDocsBrasilApi')) as ICredentialDataDecryptedObject;
	return buildClient(credentials);
}

export function buildClient(credentials: ICredentialDataDecryptedObject): SignDocsBrasilClient {
	const authMode = (credentials.authMode as string) ?? 'clientSecret';
	const environment = (credentials.environment as string) ?? 'prod';
	const baseUrl = getBaseUrl(environment);

	if (authMode === 'privateKeyJwt') {
		return new SignDocsBrasilClient({
			clientId: credentials.clientId as string,
			privateKey: credentials.privateKey as string,
			kid: credentials.kid as string,
			baseUrl,
		});
	}

	return new SignDocsBrasilClient({
		clientId: credentials.clientId as string,
		clientSecret: credentials.clientSecret as string,
		baseUrl,
	});
}

export function parseMetadata(raw: string | undefined): Record<string, string> | undefined {
	if (!raw || !raw.trim()) return undefined;
	const parsed = JSON.parse(raw);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('metadata must be a JSON object with string values');
	}
	const result: Record<string, string> = {};
	for (const [k, v] of Object.entries(parsed)) {
		result[k] = String(v);
	}
	return result;
}
