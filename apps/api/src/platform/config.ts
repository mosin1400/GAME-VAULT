export interface ApiConfig {
  bodyLimit: number;
}

export function validateApiConfig(config: ApiConfig): ApiConfig {
  if (!Number.isSafeInteger(config.bodyLimit) || config.bodyLimit < 1) {
    throw new Error('INVALID_API_BODY_LIMIT');
  }
  return config;
}
