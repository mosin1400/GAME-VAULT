import { buildApp, type AppDependencies } from './app';

export interface ListenOptions {
  host: string;
  port: number;
}

export async function startApi(dependencies: AppDependencies, options: ListenOptions) {
  const app = buildApp(dependencies);
  await app.listen({ host: options.host, port: options.port });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.GV_API_PORT ?? 8090);
  startApi({ config: { bodyLimit: 1024 * 1024 } }, { host: '127.0.0.1', port })
    .catch(() => { process.exitCode = 1; });
}
