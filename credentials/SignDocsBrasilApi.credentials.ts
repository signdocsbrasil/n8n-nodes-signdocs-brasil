import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

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
				{ name: 'Homologação (HML)', value: 'hml' },
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
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.environment === "hml" ? "https://api-hml.signdocs.com.br" : "https://api.signdocs.com.br"}}',
			url: '/oauth2/token',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: '={{"grant_type=client_credentials&client_id=" + encodeURIComponent($credentials.clientId) + "&client_secret=" + encodeURIComponent($credentials.clientSecret || "") + "&scope=transactions:read"}}',
		},
	};
}
