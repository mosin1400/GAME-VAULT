import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class N8nApi implements ICredentialType {
  name = 'n8nApi';
  displayName = 'n8n API';
  documentationUrl = 'https://docs.n8n.io/api/';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:5678/api/v1',
      required: true,
    },
  ];
}
