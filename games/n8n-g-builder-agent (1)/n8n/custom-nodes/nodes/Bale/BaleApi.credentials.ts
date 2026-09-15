import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class BaleApi implements ICredentialType {
  name = 'baleApi';
  displayName = 'Bale Messenger API';
  documentationUrl = 'https://developers.bale.ai/';
  properties: INodeProperties[] = [
    {
      displayName: 'Bot Token',
      name: 'botToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'The token provided by Bale BotFather.',
    },
  ];
}
