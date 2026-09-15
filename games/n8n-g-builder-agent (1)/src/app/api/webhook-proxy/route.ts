import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;

    // In a real environment, this would hit the n8n webhook URL
    // For this preview, we will just return a simulated successful response
    // because n8n is not actually running in the same Docker network for this preview.
    
    // const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/automation-request';
    // const response = await fetch(n8nWebhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ message: prompt, chatId: 'test-user-123' }),
    // });
    
    // Simulated delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      message: 'Request sent to n8n Webhook successfully.',
      prompt: prompt,
      status: 'Workflow generated and activated (Simulation).'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy request to n8n' }, { status: 500 });
  }
}
