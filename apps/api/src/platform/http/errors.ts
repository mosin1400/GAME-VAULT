export interface ErrorBody {
  error: { code: 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'INTERNAL_ERROR'; message: string };
}

export function errorBody(code: ErrorBody['error']['code']): ErrorBody {
  const message = code === 'BAD_REQUEST'
    ? 'Bad request'
    : code === 'PAYLOAD_TOO_LARGE'
      ? 'Payload too large'
      : 'Internal server error';
  return { error: { code, message } };
}
