import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeApiError,
} from 'n8n-workflow';

export class WorkflowBuilder implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Workflow Builder Tool',
    name: 'workflowBuilder',
    icon: 'file:builder.svg',
    group: ['transform'],
    version: 1,
    description: 'Creates and activates n8n workflows programmatically',
    defaults: {
      name: 'Workflow Builder',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'n8nApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Workflow JSON',
        name: 'workflowJson',
        type: 'string',
        default: '',
        required: true,
        description: 'The JSON representation of the workflow to create',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('n8nApi');

    for (let i = 0; i < items.length; i++) {
      try {
        let workflowJsonString = this.getNodeParameter('workflowJson', i) as string;
        let workflowData;
        try {
          workflowData = JSON.parse(workflowJsonString);
        } catch (e) {
          throw new Error('Invalid JSON provided for workflow.');
        }

        const baseUrl = credentials.baseUrl as string;
        const apiKey = credentials.apiKey as string;

        // 1. Create Workflow
        const createOptions = {
          method: 'POST',
          uri: `${baseUrl}/workflows`,
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: workflowData,
          json: true,
        };

        const createdWorkflow = await this.helpers.request(createOptions);
        
        // 2. Activate Workflow
        if (createdWorkflow && createdWorkflow.id) {
          const activateOptions = {
            method: 'POST',
            uri: `${baseUrl}/workflows/${createdWorkflow.id}/activate`,
            headers: {
              'X-N8N-API-KEY': apiKey,
            },
            json: true,
          };
          await this.helpers.request(activateOptions);
          createdWorkflow.active = true;
        }

        returnData.push({ json: createdWorkflow });
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
