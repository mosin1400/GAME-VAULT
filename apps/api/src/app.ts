import Fastify, { type FastifyInstance } from 'fastify';
import { type ApiConfig, validateApiConfig } from './platform/config';
import { errorBody } from './platform/http/errors';

export interface AppDependencies {
  config: ApiConfig;
  isReady?: () => Promise<boolean>;
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const config = validateApiConfig(dependencies.config);
  const app = Fastify({ logger: false, bodyLimit: config.bodyLimit });
  const isReady = dependencies.isReady ?? (async () => true);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  app.get('/health/live', async () => ({ status: 'live' }));
  app.get('/health/ready', async (_request, reply) => {
    if (await isReady()) return { status: 'ready' };
    return reply.code(503).send({ status: 'not_ready' });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
  app.setErrorHandler((error, _request, reply) => {
    if (error.code === 'FST_ERR_CTP_INVALID_JSON') return reply.code(400).send(errorBody('BAD_REQUEST'));
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send(errorBody('PAYLOAD_TOO_LARGE'));
    if (error.statusCode && error.statusCode < 500) return reply.code(error.statusCode).send(errorBody('BAD_REQUEST'));
    return reply.code(500).send(errorBody('INTERNAL_ERROR'));
  });
  return app;
}
