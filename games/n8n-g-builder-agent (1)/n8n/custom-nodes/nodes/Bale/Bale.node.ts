import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeApiError,
} from 'n8n-workflow';

export class Bale implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Bale Messenger',
    name: 'bale',
    icon: 'file:bale.svg',
    group: ['output'],
    version: 1,
    description: 'Send messages via Bale Messenger API',
    defaults: {
      name: 'Bale Messenger',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'baleApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Send Message',
            value: 'sendMessage',
            description: 'Send a text message',
            action: 'Send a text message',
          },
        ],
        default: 'sendMessage',
      },
      {
        displayName: 'Chat ID',
        name: 'chatId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['sendMessage'] },
        },
        description: 'Unique identifier for the target chat',
      },
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['sendMessage'] },
        },
        description: 'Text of the message to be sent',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('baleApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;

        if (operation === 'sendMessage') {
          const chatId = this.getNodeParameter('chatId', i) as string;
          const text = this.getNodeParameter('text', i) as string;

          const options = {
            method: 'POST',
            uri: `https://tapi.bale.ai/bot${credentials.botToken}/sendMessage`,
            body: {
              chat_id: chatId,
              text: text,
            },
            json: true,
          };

          const responseData = await this.helpers.request(options);
          returnData.push({ json: responseData });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message } });
          continue;
        }
        throw new NodeApiError(this.getNode(), error as any);
      }
    }

    return [returnData];
  }
}
