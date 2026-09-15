import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await db.execute(sql`select 1`);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            🤖 Automation Builder Agent
          </h1>
          <p className="mt-4 text-xl text-gray-500">
            A self-evolving n8n-based system that translates natural language requests into fully functional workflows.
          </p>
        </header>

        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              System Architecture
            </h2>
          </div>
          <div className="p-6 prose prose-indigo max-w-none">
            <p>
              This system consists of 4 main layers running in a Dockerized n8n environment:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-4 text-gray-700">
              <li><strong>Input Layer:</strong> Receives natural language via Bale Webhook or Web Form.</li>
              <li><strong>Agent Core:</strong> An n8n AI Agent using <code>@chrishdx/n8n-nodes-codex-cli-lm</code>.</li>
              <li><strong>Builder Tool:</strong> A custom node that translates AI JSON output into a real n8n workflow.</li>
              <li><strong>Executor:</strong> Activates the workflow and returns the status.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Input Layer (Test Web Form)
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Simulate sending a message from Bale to the Agent Webhook.
            </p>
          </div>
          <div className="p-6">
            <form className="space-y-4" action="/api/webhook-proxy" method="POST">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                  Your Request
                </label>
                <div className="mt-1">
                  <textarea
                    id="prompt"
                    name="prompt"
                    rows={4}
                    className="shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                    placeholder="یک بات بله بساز که به کدکس وصله باشه و هر چی بگم رو ترجمه کنه..."
                    defaultValue="یک بات بله بساز که به کدکس وصله باشه و هر چی بگم رو ترجمه کنه"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Send to Agent
              </button>
            </form>
          </div>
        </section>

        <section className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Local Setup Instructions
            </h2>
          </div>
          <div className="p-6 prose prose-indigo max-w-none">
            <ol className="list-decimal pl-5 space-y-2 text-gray-700">
              <li>Make sure you have Docker installed.</li>
              <li>Navigate to the <code>n8n</code> directory in the project root.</li>
              <li>Run <code>docker-compose up -d</code> to start n8n and build the custom nodes.</li>
              <li>Log in to n8n at <a href="http://localhost:5678" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">http://localhost:5678</a>.</li>
              <li>Import the template workflow from <code>n8n/workflows/template.json</code>.</li>
              <li>Configure your Bale API Token and n8n API Key in the credentials.</li>
              <li>Activate the workflow!</li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
