import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';
import * as crypto from 'crypto';

const HML_BASE_URL = 'https://api-hml.signdocs.com.br';
const PROD_BASE_URL = 'https://api.signdocs.com.br';

const DEFAULT_SCOPES = [
	'transactions:read',
	'transactions:write',
	'steps:write',
	'evidence:read',
	'webhooks:write',
];

function base64UrlEncode(input: Buffer | string): string {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function derEcdsaToJoseSignature(der: Buffer): Buffer {
	if (der[0] !== 0x30) throw new ApplicationError('Invalid ECDSA signature: expected DER sequence');
	let offset = 2;
	if (der[1] & 0x80) offset = 3;
	if (der[offset] !== 0x02) throw new ApplicationError('Invalid ECDSA signature: missing r INTEGER');
	const rLen = der[offset + 1];
	const rStart = offset + 2;
	let r = der.subarray(rStart, rStart + rLen);
	if (der[rStart + rLen] !== 0x02) throw new ApplicationError('Invalid ECDSA signature: missing s INTEGER');
	const sLen = der[rStart + rLen + 1];
	const sStart = rStart + rLen + 2;
	let s = der.subarray(sStart, sStart + sLen);
	const trim = (b: Buffer): Buffer => {
		let i = 0;
		while (i < b.length - 1 && b[i] === 0x00) i++;
		return b.subarray(i);
	};
	r = trim(r);
	s = trim(s);
	const pad = (b: Buffer): Buffer => {
		if (b.length > 32) throw new ApplicationError('Invalid ECDSA signature component length');
		if (b.length === 32) return b;
		const padded = Buffer.alloc(32);
		b.copy(padded, 32 - b.length);
		return padded;
	};
	return Buffer.concat([pad(r), pad(s)]);
}

function buildJwtAssertion(clientId: string, kid: string, privateKey: string, audience: string): string {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'ES256', typ: 'JWT', kid };
	const payload = {
		iss: clientId,
		sub: clientId,
		aud: audience,
		exp: now + 300,
		iat: now,
		jti: crypto.randomUUID(),
	};
	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const derSignature = crypto.sign('sha256', Buffer.from(signingInput), {
		key: privateKey,
		dsaEncoding: 'der',
	});
	return `${signingInput}.${base64UrlEncode(derEcdsaToJoseSignature(derSignature))}`;
}

export class SignDocsBrasilApi implements ICredentialType {
	name = 'signDocsBrasilApi';
	displayName = 'SignDocs Brasil API';
	// eslint-disable-next-line n8n-nodes-base/cred-class-field-documentation-url-miscased
	documentationUrl = 'https://docs.signdocs.com.br/#tag/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			default: 'prod',
			options: [
				{ name: 'Production', value: 'prod' },
				{ name: 'Staging (HML)', value: 'hml' },
			],
		},
		{
			displayName: 'Authentication Method',
			name: 'authMode',
			type: 'options',
			default: 'clientSecret',
			options: [
				{ name: 'Client Secret', value: 'clientSecret' },
				{ name: 'Private Key JWT (ES256)', value: 'privateKeyJwt' },
			],
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: { show: { authMode: ['clientSecret'] } },
		},
		{
			displayName: 'Private Key (PEM)',
			name: 'privateKey',
			type: 'string',
			typeOptions: { password: true, rows: 6 },
			default: '',
			description: 'ES256 private key in PEM format (-----BEGIN PRIVATE KEY-----…)',
			displayOptions: { show: { authMode: ['privateKeyJwt'] } },
		},
		{
			displayName: 'Key ID (Kid)',
			name: 'kid',
			type: 'string',
			default: '',
			description: 'The key identifier registered in the SignDocs tenant',
			displayOptions: { show: { authMode: ['privateKeyJwt'] } },
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'hidden',
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const environment = (credentials.environment as string) ?? 'prod';
		const baseUrl = environment === 'hml' ? HML_BASE_URL : PROD_BASE_URL;
		const tokenUrl = `${baseUrl}/oauth2/token`;
		const authMode = (credentials.authMode as string) ?? 'clientSecret';
		const clientId = credentials.clientId as string;

		const body: Record<string, string> = {
			grant_type: 'client_credentials',
			client_id: clientId,
			scope: DEFAULT_SCOPES.join(' '),
		};

		if (authMode === 'privateKeyJwt') {
			const privateKey = credentials.privateKey as string;
			const kid = credentials.kid as string;
			if (!privateKey || !kid) {
				throw new ApplicationError('privateKey and kid are required for Private Key JWT authentication');
			}
			body.client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
			body.client_assertion = buildJwtAssertion(clientId, kid, privateKey, tokenUrl);
		} else {
			const clientSecret = credentials.clientSecret as string;
			if (!clientSecret) {
				throw new ApplicationError('clientSecret is required for Client Secret authentication');
			}
			body.client_secret = clientSecret;
		}

		const formBody = Object.entries(body)
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&');

		const response = (await this.helpers.httpRequest({
			method: 'POST',
			url: tokenUrl,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: formBody,
			json: true,
		})) as { access_token: string };

		return { accessToken: response.access_token };
	}

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.environment === "hml" ? "https://api-hml.signdocs.com.br" : "https://api.signdocs.com.br"}}',
			url: '/health',
			method: 'GET',
		},
	};
}
